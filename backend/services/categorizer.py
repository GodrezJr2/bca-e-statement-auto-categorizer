from models.schemas import Transaction, CategorizedTransaction


async def categorize_transactions(
    transactions: list[Transaction],
) -> list[CategorizedTransaction]:
    """Stub: categorizes all transactions as 'Other'. Replaced in Phase 3."""
    return [
        CategorizedTransaction(
            transaction_date=t.transaction_date,
            description=t.description,
            amount=t.amount,
            category_name="Other",
        )
        for t in transactions
    ]
