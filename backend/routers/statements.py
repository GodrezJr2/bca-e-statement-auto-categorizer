import csv
import io
import os
import re
import time
import logging
from collections import defaultdict
from fastapi import APIRouter, File, Form, UploadFile, HTTPException, Header
from fastapi.responses import StreamingResponse
from supabase import create_client, Client
from dotenv import load_dotenv
from services.pdf_parser import extract_transactions
from services.categorizer import categorize_transactions
from models.schemas import UploadResponse, CategorizedTransaction, CategoryUpdateRequest, TransactionUpdateResponse

load_dotenv()

router = APIRouter()

_logger = logging.getLogger(__name__)


# Service role key is required to call auth.get_user() and to insert rows
# on behalf of the authenticated user (RLS is enforced via user_id from JWT).
_supabase: Client | None = None

# In-memory rate limit: max 10 uploads per user per hour.
# Resets naturally on container restart (acceptable for single-user home server).
_upload_counts: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_MAX    = 10
_RATE_LIMIT_WINDOW = 3600  # seconds


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _supabase


@router.post("/upload-statement", response_model=UploadResponse)
async def upload_statement(
    file: UploadFile = File(...),
    password: str = Form(""),          # empty string = no password
    authorization: str = Header(...),  # Bearer <supabase JWT>
):
    # 1. Authenticate user via Supabase JWT
    supabase = _get_supabase()
    jwt = authorization.removeprefix("Bearer ").strip()
    user_resp = supabase.auth.get_user(jwt)
    if not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid auth token.")
    user_id = str(user_resp.user.id)

    # Rate limit check
    now = time.time()
    _upload_counts[user_id] = [t for t in _upload_counts[user_id] if now - t < _RATE_LIMIT_WINDOW]
    if len(_upload_counts[user_id]) >= _RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Upload limit reached. Max 10 uploads per hour.")
    _upload_counts[user_id].append(now)

    # 2. Read PDF bytes in memory — never write to disk
    pdf_bytes = await file.read()

    # 2a. Validate MIME type
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # 2b. Validate magic bytes (%PDF-)
    if pdf_bytes[:5] != b"%PDF-":
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF.")

    # 2c. Validate file size (10 MB max)
    if len(pdf_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds the 10 MB limit.")

    # 3. Decrypt + parse
    try:
        transactions = extract_transactions(pdf_bytes, password or None)
    except ValueError as e:
        msg = str(e)
        if "password" in msg.lower():
            raise HTTPException(status_code=422, detail="Incorrect PDF password.")
        raise HTTPException(status_code=422, detail="Could not parse the PDF. Check the file format.")
    except Exception as e:
        _logger.warning("PDF parser raised unexpected exception: %s", e)
        raise HTTPException(status_code=422, detail="Could not parse the PDF. Check the file format.")

    # 4. Auto-categorize
    categorized = await categorize_transactions(transactions)

    # 5. Look up category UUIDs from DB
    cats_resp = supabase.table("categories").select("id, name").execute()
    cat_map: dict[str, str] = {row["name"]: row["id"] for row in cats_resp.data}
    other_id = cat_map.get("Other")
    if other_id is None:
        raise HTTPException(status_code=500, detail="Category table is missing the 'Other' seed row.")

    # 6. Delete existing transactions for the same months, then insert fresh.
    # This makes re-uploading the same PDF idempotent (no duplicates).
    months_in_upload = list({str(ct.transaction_date)[:7] for ct in categorized})  # ["YYYY-MM", ...]
    for month in months_in_upload:
        month_start = f"{month}-01"
        # last day of month via next-month trick
        y, m = int(month[:4]), int(month[5:7])
        if m == 12:
            month_end = f"{y + 1}-01-01"
        else:
            month_end = f"{y}-{m + 1:02d}-01"
        supabase.table("transactions").delete().eq("user_id", user_id).gte(
            "transaction_date", month_start
        ).lt("transaction_date", month_end).execute()

    rows = [
        {
            "user_id":          user_id,
            "transaction_date": str(ct.transaction_date),
            "description":      ct.description,
            "amount":           ct.amount,
            "category_id":      cat_map.get(ct.category_name, other_id),
        }
        for ct in categorized
    ]
    supabase.table("transactions").insert(rows).execute()

    return UploadResponse(inserted=len(rows), transactions=categorized)


VALID_CATEGORIES = {
    "Food", "Transport", "Utilities", "Shopping", "Subscription",
    "Health", "Entertainment", "Transfer", "Income", "Other",
}


@router.get("/transactions/export")
async def export_transactions(
    month: str,
    authorization: str = Header(...),
):
    # Validate month format YYYY-MM and valid month range
    if not re.fullmatch(r"\d{4}-\d{2}", month) or not (1 <= int(month[5:7]) <= 12):
        raise HTTPException(status_code=422, detail="month must be in YYYY-MM format.")

    supabase = _get_supabase()
    jwt = authorization.removeprefix("Bearer ").strip()
    user_resp = supabase.auth.get_user(jwt)
    if not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid auth token.")
    user_id = str(user_resp.user.id)

    # Compute date range for the month
    y, m = int(month[:4]), int(month[5:7])
    month_start = f"{month}-01"
    if m == 12:
        month_end = f"{y + 1}-01-01"
    else:
        month_end = f"{y}-{m + 1:02d}-01"

    try:
        result = (
            supabase.table("transactions")
            .select("transaction_date, description, amount, categories(name)")
            .eq("user_id", user_id)
            .gte("transaction_date", month_start)
            .lt("transaction_date", month_end)
            .order("transaction_date")
            .execute()
        )
    except Exception as exc:
        _logger.error("Supabase query failed in export_transactions: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve transactions.")

    def generate():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["Date", "Description", "Amount (IDR)", "Category"])
        for row in result.data:
            cat_name = (row.get("categories") or {}).get("name", "Other")
            writer.writerow([
                row.get("transaction_date", ""),
                row.get("description", ""),
                int(row["amount"]) if row.get("amount") is not None else 0,
                cat_name,
            ])
        buf.seek(0)
        yield buf.read()

    return StreamingResponse(
        generate(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="statement-{month}.csv"'},
    )


@router.patch("/transactions/{transaction_id}", response_model=TransactionUpdateResponse)
async def update_transaction_category(
    transaction_id: str,
    body: CategoryUpdateRequest,
    authorization: str = Header(...),
):
    if body.category_name not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid category. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}"
        )

    supabase = _get_supabase()
    jwt = authorization.removeprefix("Bearer ").strip()
    user_resp = supabase.auth.get_user(jwt)
    if not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid auth token.")
    user_id = str(user_resp.user.id)

    # Look up category UUID
    cats_resp = supabase.table("categories").select("id, name").execute()
    cat_map: dict[str, str] = {row["name"]: row["id"] for row in cats_resp.data}
    cat_id = cat_map.get(body.category_name)
    if not cat_id:
        raise HTTPException(status_code=422, detail=f"Category '{body.category_name}' not found in DB.")

    # Update — filter by both id AND user_id so users can't edit others' transactions
    result = (
        supabase.table("transactions")
        .update({"category_id": cat_id})
        .eq("id", transaction_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    return TransactionUpdateResponse(id=transaction_id, category_name=body.category_name)
