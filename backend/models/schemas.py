from pydantic import BaseModel
from datetime import date
from typing import Optional


class Transaction(BaseModel):
    transaction_date: date
    description: str
    amount: float           # negative = debit, positive = credit
    balance: Optional[float] = None


class CategorizedTransaction(BaseModel):
    transaction_date: date
    description: str
    amount: float
    category_name: str


class UploadResponse(BaseModel):
    inserted: int
    transactions: list[CategorizedTransaction]
