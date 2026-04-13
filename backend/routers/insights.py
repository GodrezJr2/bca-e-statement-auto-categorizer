import os
import re
import logging
from fastapi import APIRouter, HTTPException, Header
from supabase import create_client, Client
from dotenv import load_dotenv
from models.schemas import InsightsResponse

load_dotenv()

router = APIRouter()
_logger = logging.getLogger(__name__)

_supabase: Client | None = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _supabase


def _month_boundaries(month: str) -> tuple[str, str]:
    y, m = int(month[:4]), int(month[5:7])
    start = f"{month}-01"
    end = f"{y + 1}-01-01" if m == 12 else f"{y}-{m + 1:02d}-01"
    return start, end


def _prior_month(month: str) -> str:
    y, m = int(month[:4]), int(month[5:7])
    if m == 1:
        return f"{y - 1}-12"
    return f"{y}-{m - 1:02d}"


def _category_totals(rows: list[dict]) -> dict[str, float]:
    totals: dict[str, float] = {}
    for row in rows:
        if row.get("amount", 0) >= 0:
            continue
        cat = (row.get("categories") or {}).get("name", "Other")
        totals[cat] = totals.get(cat, 0.0) + abs(row["amount"])
    return totals


def _compute_insights(current_rows: list[dict], prior_rows: list[dict]) -> list[str]:
    insights: list[str] = []

    expense_rows = [r for r in current_rows if r.get("amount", 0) < 0]
    current_cat = _category_totals(current_rows)
    prior_cat = _category_totals(prior_rows)

    # 1. Largest expense category
    if current_cat:
        top_cat, top_val = max(current_cat.items(), key=lambda x: x[1])
        formatted = f"Rp {round(top_val):,}".replace(",", ".")
        insights.append(f"Largest category this month: {top_cat} ({formatted})")

    # 2. Category changes vs prior month (only report >= 10% moves)
    for cat, curr_val in sorted(current_cat.items(), key=lambda x: -x[1]):
        if cat not in prior_cat:
            continue
        prev_val = prior_cat[cat]
        if prev_val <= 0:
            continue
        pct = (curr_val - prev_val) / prev_val * 100
        if abs(pct) < 10:
            continue
        direction = "up" if pct > 0 else "down"
        insights.append(f"{cat} spending {direction} {abs(pct):.0f}% vs last month")

    # 3. Unusually large transactions (> 2x prior month's per-category average)
    # Using prior month as baseline so single-transaction months can still be flagged.
    prior_cat_sum: dict[str, float] = {}
    prior_cat_counts: dict[str, int] = {}
    for row in [r for r in prior_rows if r.get("amount", 0) < 0]:
        cat = (row.get("categories") or {}).get("name", "Other")
        prior_cat_sum[cat] = prior_cat_sum.get(cat, 0.0) + abs(row.get("amount", 0))
        prior_cat_counts[cat] = prior_cat_counts.get(cat, 0) + 1
    prior_cat_avg = {
        cat: prior_cat_sum[cat] / prior_cat_counts[cat] for cat in prior_cat_sum
    }

    large_count = 0
    for row in expense_rows:
        cat = (row.get("categories") or {}).get("name", "Other")
        if cat in prior_cat_avg and abs(row.get("amount", 0)) > 2 * prior_cat_avg[cat]:
            large_count += 1

    if large_count > 0:
        word = "transaction" if large_count == 1 else "transactions"
        insights.append(f"{large_count} {word} more than 2\u00d7 their category average this month")

    return insights


@router.get("/insights", response_model=InsightsResponse)
async def get_insights(month: str, authorization: str = Header(...)):
    if not re.fullmatch(r"\d{4}-\d{2}", month) or not (1 <= int(month[5:7]) <= 12):
        raise HTTPException(status_code=422, detail="month must be in YYYY-MM format.")

    supabase = _get_supabase()
    jwt = authorization.removeprefix("Bearer ").strip()
    try:
        user_resp = supabase.auth.get_user(jwt)
    except Exception as exc:
        _logger.warning("auth.get_user failed in get_insights: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid auth token.")
    if not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid auth token.")
    user_id = str(user_resp.user.id)

    month_start, month_end = _month_boundaries(month)
    prior = _prior_month(month)
    prior_start, prior_end = _month_boundaries(prior)

    try:
        current_result = (
            supabase.table("transactions")
            .select("transaction_date, amount, categories(name)")
            .eq("user_id", user_id)
            .gte("transaction_date", month_start)
            .lt("transaction_date", month_end)
            .execute()
        )
        prior_result = (
            supabase.table("transactions")
            .select("transaction_date, amount, categories(name)")
            .eq("user_id", user_id)
            .gte("transaction_date", prior_start)
            .lt("transaction_date", prior_end)
            .execute()
        )
    except Exception as exc:
        _logger.error("Supabase query failed in get_insights: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve transactions.")

    insights = _compute_insights(current_result.data, prior_result.data)
    return InsightsResponse(month=month, insights=insights)
