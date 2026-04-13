import os
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header
from supabase import create_client, Client
from dotenv import load_dotenv
from models.schemas import BudgetItem, BudgetsResponse, BudgetUpsertRequest

load_dotenv()

router = APIRouter()
_logger = logging.getLogger(__name__)

_supabase: Client | None = None

_VALID_BUDGET_CATS = {
    "Food", "Transport", "Utilities", "Shopping",
    "Subscription", "Health", "Entertainment", "Other",
}


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _supabase


def _auth_user_id(supabase: Client, authorization: str) -> str:
    """Validate Bearer token and return user_id, or raise 401."""
    jwt = authorization.removeprefix("Bearer ").strip()
    try:
        user_resp = supabase.auth.get_user(jwt)
    except Exception as exc:
        _logger.warning("auth.get_user failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid auth token.")
    if not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid auth token.")
    return str(user_resp.user.id)


@router.get("/budgets", response_model=BudgetsResponse)
async def get_budgets(authorization: str = Header(...)):
    supabase = _get_supabase()
    user_id = _auth_user_id(supabase, authorization)

    try:
        result = (
            supabase.table("budgets")
            .select("category, monthly_limit")
            .eq("user_id", user_id)
            .order("category")
            .execute()
        )
    except Exception as exc:
        _logger.error("Supabase query failed in get_budgets: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve budgets.")

    return BudgetsResponse(budgets=[BudgetItem(**row) for row in result.data])


@router.put("/budgets/{category}", response_model=BudgetItem)
async def upsert_budget(
    category: str,
    body: BudgetUpsertRequest,
    authorization: str = Header(...),
):
    if category not in _VALID_BUDGET_CATS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid category. Must be one of: {sorted(_VALID_BUDGET_CATS)}",
        )

    supabase = _get_supabase()
    user_id = _auth_user_id(supabase, authorization)

    try:
        result = (
            supabase.table("budgets")
            .upsert(
                {
                    "user_id": user_id,
                    "category": category,
                    "monthly_limit": body.monthly_limit,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="user_id,category",
            )
            .execute()
        )
    except Exception as exc:
        _logger.error("Supabase upsert failed in upsert_budget: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to save budget.")

    row = result.data[0]
    return BudgetItem(category=row["category"], monthly_limit=row["monthly_limit"])