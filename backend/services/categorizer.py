import os
import re
import json
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv
from models.schemas import Transaction, CategorizedTransaction

_logger = logging.getLogger(__name__)

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH)

_OPENROUTER_API_KEY: str | None = os.environ.get("OPENROUTER_API_KEY")

# Free models on OpenRouter — tried in order until one succeeds.
# Verified working as of 2026-04 with this API key.
_MODEL_FALLBACK_CHAIN: list[str] = [
    "openai/gpt-oss-120b:free",               # 120B, excellent JSON + instruction following
    "nvidia/nemotron-3-super-120b-a12b:free", # 120B MoE, strong multilingual
    "google/gemma-3-27b-it:free",             # Gemma 27B fallback
    "meta-llama/llama-3.3-70b-instruct:free", # Llama 70B last resort
]

CATEGORIES = [
    "Food", "Transport", "Utilities", "Shopping",
    "Subscription", "Health", "Entertainment", "Transfer", "Income", "Other"
]

# ---------------------------------------------------------------------------
# Rule-based pre-filter — handles obvious patterns without calling the LLM.
# Returns a category string or None (meaning: send to LLM).
# ---------------------------------------------------------------------------
_TRANSFER_PREFIXES = ("TRSF E-BANKING", "BI-FAST", "RTGS", "SKN ONLINE")
_FOOD_KW = (
    "KFC", "MCDONALD", "BURGER", "PIZZA", "BAKSO", "MIE ", "KWETIAU",
    "NASI", "SOTO", "WARTEG", "WARUNG", "CAFE", "KOPI", "BOBA",
    "RICHEESE", "STARBUCKS", "CHATIME", "SUSHI", "MARTABAK",
    "KETOPMIE", "KETO MIE", "AYAM", "BEBEK", "PADANG", "PECEL",
    "GOFOOD", "GRABFOOD", "SHOPEEFOOD", "TUXEDO", "RESTO", "RESTORAN",
    "SEAFOOD", "SATE ", "RENDANG", "BATAGOR", "SIOMAY", "GADO",
    "LUIGI", "PANTAI",  # likely food/restaurant names from your data
)
_SHOPPING_KW = (
    "SHOPEE", "TOKOPEDIA", "LAZADA", "BUKALAPAK", "BLIBLI",
    "INDOMARET", "ALFAMART", "IDM INDOM", "MINIMARKET", "SUPERMARKET",
    "HYPERMART", "CARREFOUR", "JNE", "SICEPAT", "ANTERAJA", "TIKI",
)
_TRANSPORT_KW = (
    "FLAZZ", "E-TOLL", "ETOLL", "GOJEK", "GRAB", "OJEK",
    "PARKIR", "BENSIN", "PERTAMINA", "SPBU", "SHELL",
)
_UTILITIES_KW = (
    "TELKOMSEL", "MYTELKOMSEL", "TELKOM", "PLN ", "LISTRIK", "PDAM",
    "INDIHOME", "FIRSTMEDIA", "PULSA", "TOKEN LISTRIK", "XL AXIATA",
    "INDOSAT", "SMARTFREN",
)
_SUBSCRIPTION_KW = (
    "NETFLIX", "SPOTIFY", "YOUTUBE", "DISNEY", "APPLE.COM",
    "GOOGLE PLAY", "ICLOUD", "MICROSOFT", "ADOBE", "CANVA",
    "CHATGPT", "OPENAI", "ZOOM",
)
_HEALTH_KW = (
    "APOTEK", "FARMASI", "KLINIK", "RUMAH SAKIT", " RS ", "DOKTER",
    "KIMIA FARMA", "CENTURY", "GUARDIAN", "WATSONS", "DENTAL", "OPTIK",
)


def _rule_category(description: str) -> str | None:
    d = description.upper()

    # Transfer: check full description
    if any(d.startswith(p) or p in d for p in _TRANSFER_PREFIXES):
        # DB/debit = Transfer out, CR/credit = still Transfer (between accounts)
        return "Transfer"

    # For BCA "TRANSAKSI DEBIT TGL: DD/MM | MERCHANT" — use merchant part
    merchant = d.split("|", 1)[1].strip() if "|" in d else d

    for kw in _FOOD_KW:
        if kw in merchant:
            return "Food"
    for kw in _SHOPPING_KW:
        if kw in merchant:
            return "Shopping"
    for kw in _TRANSPORT_KW:
        if kw in merchant:
            return "Transport"
    for kw in _UTILITIES_KW:
        if kw in merchant:
            return "Utilities"
    for kw in _SUBSCRIPTION_KW:
        if kw in merchant:
            return "Subscription"
    for kw in _HEALTH_KW:
        if kw in merchant:
            return "Health"

    return None  # unknown — send to LLM

_SYSTEM_PROMPT = """You are a financial transaction categorizer for Indonesian BCA bank statements.
Given a JSON array of transaction descriptions, return a JSON array of category strings.
Each element must be exactly one of: Food, Transport, Utilities, Shopping, Subscription, Health, Entertainment, Transfer, Income, Other.
The output array must have exactly the same length as the input array.
Respond with ONLY the JSON array — no explanation, no markdown, no code block.

Category rules (use the MOST SPECIFIC match):
- Food: restaurants, cafes, food stalls, delivery apps, any Indonesian food keyword.
  Keywords: makan, mie, bakso, nasi, ayam, soto, kwetiau, batagor, siomay, warteg, warung,
  restoran, cafe, kopi, pizza, burger, sushi, indomaret (food), alfamart (food), grabfood,
  gofood, shopeefood, kfc, mcdonald, starbucks, chatime, boba, martabak, sate, rendang,
  gudeg, gado, pecel, lalapan, seafood, ikan, udang, kepiting, bebek, padang.
- Transport: ojek, gojek, grab (non-food), taxi, parkir, tol, bensin, bbm, pertamina,
  shell, spbu, busway, kereta, commuter, mrt, lrt, transjakarta, damri, bus, angkot, flazz.
- Utilities: listrik, pln, air, pdam, gas, pgn, telkom, wifi, internet, indihome,
  firstmedia, phone credit, pulsa, token, tagihan.
- Shopping: tokopedia, shopee, lazada, bukalapak, blibli, tiktok shop, zalora,
  alfamart, indomaret, hypermart, carrefour, giant, hero, supermarket, minimarket.
- Subscription: netflix, spotify, youtube, disney, apple, google play, icloud,
  microsoft, adobe, canva, zoom, chatgpt, openai.
- Health: apotek, farmasi, klinik, rumah sakit, rs, dokter, lab, kimia farma,
  century, guardian, watsons, dental, mata, optic.
- Entertainment: bioskop, cinema, xxi, cgv, cineplex, karaoke, game, steam,
  playstation, konser, tiket, event.
- Transfer: TRSF, BI-FAST, transfer, kirim uang, RTGS, SKN, top up, flip,
  dana, ovo, gopay, linkaja, jenius — money moving between accounts.
- Income: salary, gaji, bonus, THR, dividen, bunga, incoming credit from employer.
- Other: fees, admin, biaya, charges, ATM, withdrawal, or anything not matching above.

Important: BCA descriptions often follow "TRANSAKSI DEBIT TGL: DD/MM | MERCHANT NAME".
The merchant name after "|" is the key signal. Use it to categorize."""

_BATCH_SIZE = 50
_VALID = set(CATEGORIES)


def _make_openrouter_client():
    from openai import AsyncOpenAI
    if not _OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not set. Add it to backend/.env.")
    return AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=_OPENROUTER_API_KEY,
    )


async def _call_model(descriptions: list[str], model: str) -> list[str]:
    client = _make_openrouter_client()
    response = await asyncio.wait_for(
        client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": json.dumps(descriptions, ensure_ascii=False)},
            ],
            temperature=0,
        ),
        timeout=45.0,
    )
    text = response.choices[0].message.content or ""
    text = text.strip()

    # Strip markdown code fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    # Extract JSON array
    match = re.search(r'\[.*\]', text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON array in response: {text[:300]}")
    result = json.loads(match.group(0))
    if isinstance(result, list):
        return result
    return result.get("categories", [])


async def _call_with_fallback(descriptions: list[str]) -> list[str]:
    last_exc: Exception = RuntimeError("No models configured.")
    for model in _MODEL_FALLBACK_CHAIN:
        try:
            result = await _call_model(descriptions, model)
            if model != _MODEL_FALLBACK_CHAIN[0]:
                _logger.info("Used fallback model: %s", model)
            return result
        except Exception as e:
            _logger.warning("Model %s failed: %s", model, e)
            last_exc = e
    raise last_exc


async def categorize_transactions(
    transactions: list[Transaction],
) -> list[CategorizedTransaction]:
    # Step 1: apply rule-based filter first
    pre: list[str | None] = [_rule_category(t.description) for t in transactions]

    # Step 2: only send unknowns to LLM
    unknown_indices = [i for i, cat in enumerate(pre) if cat is None]
    unknown_descs  = [transactions[i].description for i in unknown_indices]

    llm_results: list[str] = []
    for i in range(0, len(unknown_descs), _BATCH_SIZE):
        batch_descs = unknown_descs[i: i + _BATCH_SIZE]
        try:
            cats = await _call_with_fallback(batch_descs)
        except Exception as e:
            _logger.warning("All models failed for batch %d: %s", i // _BATCH_SIZE + 1, e)
            cats = []
        if len(cats) != len(batch_descs):
            cats = ["Other"] * len(batch_descs)
        llm_results.extend(c if c in _VALID else "Other" for c in cats)

    # Step 3: merge results back
    llm_iter = iter(llm_results)
    all_categories = [cat if cat is not None else next(llm_iter) for cat in pre]

    rule_count = sum(1 for c in pre if c is not None)
    _logger.info("Categorized %d via rules, %d via LLM", rule_count, len(unknown_indices))

    return [
        CategorizedTransaction(
            transaction_date=t.transaction_date,
            description=t.description,
            amount=t.amount,
            category_name=cat,
        )
        for t, cat in zip(transactions, all_categories)
    ]
