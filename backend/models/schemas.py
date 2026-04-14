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

class InsightsResponse(BaseModel):
    month: str
    insights: list[str]


from pydantic import Field as _Field

class BudgetItem(BaseModel):
    category: str
    monthly_limit: int

class BudgetsResponse(BaseModel):
    budgets: list[BudgetItem]

class BudgetUpsertRequest(BaseModel):
    monthly_limit: int = _Field(gt=0, description="Monthly spending limit in IDR, must be > 0")

class FlowNode(BaseModel):
    id: str
    value: int
    type: str   # "source" | "category"
    color: str

class FlowLink(BaseModel):
    source: str
    target: str
    value: int
    transactions: int

class FlowMetadata(BaseModel):
    total_transactions: int
    total_amount: int
    period: str

class FlowsResponse(BaseModel):
    nodes: list[FlowNode]
    links: list[FlowLink]
    metadata: FlowMetadata
