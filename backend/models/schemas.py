from pydantic import BaseModel
from datetime import date
from typing import Optional


class Transaction(BaseModel):
    transaction_date: date
    description: str
    amount: float           # negative = debit, positive = credit
    balance: Optional[float] = None


class CategorizedTransaction(Transaction):
    category_name: str


class UploadResponse(BaseModel):
    inserted: int
    transactions: list[CategorizedTransaction]

class CategoryUpdateRequest(BaseModel):
    category_name: str

class TransactionUpdateResponse(BaseModel):
    id: str
    category_name: str
