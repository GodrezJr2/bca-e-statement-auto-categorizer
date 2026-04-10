import os
import json
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv
from models.schemas import Transaction, CategorizedTransaction

_logger = logging.getLogger(__name__)

# Load .env from the backend directory regardless of cwd
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH)

_GEMINI_API_KEY: str | None = os.environ.get("GEMINI_API_KEY")

# Fallback chain: try each model in order until one succeeds.
# Override the first model via GEMINI_MODEL env var; the rest are fixed fallbacks.
_PRIMARY_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
_MODEL_FALLBACK_CHAIN: list[str] = [
    _PRIMARY_MODEL,
    "gemini-2.5-pro",      # untouched quota, same API key
    "gemini-2.0-flash",    # lower RPD but worth trying
    "gemma-3-27b-it",      # 14.4K RPD — Gemma via same Gemini API key
]
# Deduplicate while preserving order
_seen: set[str] = set()
_MODEL_FALLBACK_CHAIN = [m for m in _MODEL_FALLBACK_CHAIN if not (m in _seen or _seen.add(m))]  # type: ignore[func-returns-value]

CATEGORIES = [
    "Food", "Transport", "Utilities", "Shopping",
    "Subscription", "Health", "Entertainment", "Transfer", "Income", "Other"
]

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
  shell, spbu, busway, kereta, commuter, mrt, lrt, transjakarta, damri, bus, angkot.
- Utilities: listrik, pln, air, pdam, gas, pgn, telkom, wifi, internet, indihome,
  firstmedia, phone credit, pulsa, token, tagihan.
- Shopping: tokopedia, shopee, lazada, bukalapak, blibli, tiktok shop, zalora,
  alfamart, indomaret, hypermart, carrefour, giant, hero, supermarket, minimarket,
  clothes, fashion, elektronik, hp, laptop.
- Subscription: netflix, spotify, youtube, disney, apple, google play, icloud,
  microsoft, adobe, canva, zoom, chatgpt, openai.
- Health: apotek, farmasi, klinik, rumah sakit, rs, dokter, lab, kimia farma,
  century, guardian, watsons, dental, mata, optic.
- Entertainment: bioskop, cinema, xxi, cgv, cineplex, karaoke, game, steam,
  playstation, konser, tiket, event.
- Transfer: TRSF, transfer, kirim uang, BI-FAST, RTGS, SKN, top up, flip,
  dana, ovo, gopay, linkaja, jenius — when money moves between accounts.
- Income: salary, gaji, bonus, THR, dividen, bunga, credit incoming (CR) from employer.
- Other: fees, admin, biaya, charges, ATM, withdrawal, or anything not matching above.

Important: BCA descriptions often follow "TRANSAKSI DEBIT TGL: DD/MM | MERCHANT NAME".
The merchant name after "|" is the key signal. Use it to categorize."""

_BATCH_SIZE = 50  # stay within token limits


async def _call_gemini_with_model(descriptions: list[str], model_name: str) -> list[str]:
    import google.generativeai as genai
    import re
    if not _GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set. Check backend/.env.")
    genai.configure(api_key=_GEMINI_API_KEY)

    # Gemma models don't support response_mime_type JSON mode
    is_gemma = model_name.startswith("gemma")
    generation_config = {} if is_gemma else {"response_mime_type": "application/json"}

    model = genai.GenerativeModel(
        model_name=model_name,
        generation_config=generation_config,
    )
    prompt = _SYSTEM_PROMPT + "\n\nDescriptions:\n" + json.dumps(descriptions, ensure_ascii=False)
    loop = asyncio.get_running_loop()
    response = await asyncio.wait_for(
        loop.run_in_executor(None, model.generate_content, prompt),
        timeout=45.0,
    )
    text = response.text.strip()

    # For Gemma (plain text), extract the JSON array from the response
    if is_gemma:
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if not match:
            raise ValueError(f"No JSON array found in Gemma response: {text[:200]}")
        text = match.group(0)

    result = json.loads(text)
    if isinstance(result, list):
        return result
    return result.get("categories", [])


async def _call_gemini(descriptions: list[str]) -> list[str]:
    """Try each model in the fallback chain; raise only if all fail."""
    last_exc: Exception = RuntimeError("No models configured.")
    for model_name in _MODEL_FALLBACK_CHAIN:
        try:
            result = await _call_gemini_with_model(descriptions, model_name)
            if model_name != _MODEL_FALLBACK_CHAIN[0]:
                _logger.info("Used fallback model: %s", model_name)
            return result
        except Exception as e:
            _logger.warning("Model %s failed (%s), trying next...", model_name, e)
            last_exc = e
    raise last_exc


_VALID = set(CATEGORIES)  # derived from CATEGORIES — do not maintain separately


async def categorize_transactions(
    transactions: list[Transaction],
) -> list[CategorizedTransaction]:
    """
    Send transaction descriptions to Gemini in batches.
    Returns CategorizedTransaction list in the same order.
    """
    all_categories: list[str] = []

    for i in range(0, len(transactions), _BATCH_SIZE):
        batch = transactions[i: i + _BATCH_SIZE]
        descs = [t.description for t in batch]
        try:
            cats = await _call_gemini(descs)
        except Exception as e:
            _logger.warning(
                "Gemini batch %d failed, falling back to 'Other': %s",
                i // _BATCH_SIZE + 1, e, exc_info=True,
            )
            cats = []

        # Safety: wrong length or bad values → fall back to "Other"
        if len(cats) != len(batch):
            cats = ["Other"] * len(batch)

        all_categories.extend(c if c in _VALID else "Other" for c in cats)

    return [
        CategorizedTransaction(
            transaction_date=t.transaction_date,
            description=t.description,
            amount=t.amount,
            category_name=cat,
        )
        for t, cat in zip(transactions, all_categories)
    ]
