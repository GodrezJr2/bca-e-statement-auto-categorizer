import os
import json
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from models.schemas import Transaction, CategorizedTransaction

# Load .env from the backend directory regardless of cwd
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH)

CATEGORIES = [
    "Food", "Transport", "Utilities", "Shopping",
    "Subscription", "Health", "Entertainment", "Transfer", "Income", "Other"
]

_SYSTEM_PROMPT = (
    "You are a financial transaction categorizer for Indonesian bank statements. "
    "Given a JSON array of transaction descriptions, return a JSON array of category strings. "
    "Each element must be exactly one of: " + ", ".join(CATEGORIES) + ". "
    "The output array must have exactly the same length as the input array. "
    "Respond with ONLY the JSON array — no explanation, no markdown, no code block."
)

_BATCH_SIZE = 50  # stay within token limits


async def _call_gemini(descriptions: list[str]) -> list[str]:
    import google.generativeai as genai
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config={"response_mime_type": "application/json"},
    )
    prompt = _SYSTEM_PROMPT + "\n\nDescriptions:\n" + json.dumps(descriptions, ensure_ascii=False)
    # Run blocking SDK call in thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(None, model.generate_content, prompt)
    result = json.loads(response.text)
    if isinstance(result, list):
        return result
    # Some models wrap in {"categories": [...]}
    return result.get("categories", [])


_VALID = set(CATEGORIES)


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
            print(f"[categorizer] Gemini batch {i//50 + 1} failed: {e}. Falling back to 'Other'.")
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
