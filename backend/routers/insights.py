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


@router.get("/insights", response_model=InsightsResponse)
async def get_insights(month: str, authorization: str = Header(...)):
    raise HTTPException(status_code=501, detail="Not implemented yet.")
