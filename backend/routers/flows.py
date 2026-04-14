import os
import re
import logging
from datetime import date
from fastapi import APIRouter, HTTPException, Header
from supabase import create_client, Client
from dotenv import load_dotenv
from models.schemas import FlowsResponse
from services.flow_aggregator import aggregate_category_flow

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


def _auth_user_id(supabase: Client, authorization: str) -> str:
    jwt = authorization.removeprefix("Bearer ").strip()
    try:
        user_resp = supabase.auth.get_user(jwt)
    except Exception as exc:
        _logger.warning("auth.get_user failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid auth token.")
    if not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid auth token.")
    return str(user_resp.user.id)


def _validate_date(s: str, field: str) -> None:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        raise HTTPException(status_code=400, detail=f"{field} must be YYYY-MM-DD.")
    try:
        date.fromisoformat(s)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field} is not a valid date.")


@router.get("/flows", response_model=FlowsResponse)
async def get_flows(
    start_date: str,
    end_date: str,
    min_amount: float = 0,
    authorization: str = Header(...),
):
    _validate_date(start_date, "start_date")
    _validate_date(end_date, "end_date")
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be <= end_date.")
    if min_amount < 0:
        raise HTTPException(status_code=400, detail="min_amount must be >= 0.")

    supabase = _get_supabase()
    user_id = _auth_user_id(supabase, authorization)

    try:
        result = (
            supabase.table("transactions")
            .select("transaction_date, amount, categories(name)")
            .eq("user_id", user_id)
            .gte("transaction_date", start_date)
            .lte("transaction_date", end_date)
            .execute()
        )
    except Exception as exc:
        _logger.error("Supabase query failed in get_flows: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve transactions.")

    return aggregate_category_flow(
        rows=result.data,
        min_amount=min_amount,
        start_date=start_date,
        end_date=end_date,
    )
