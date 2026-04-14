from models.schemas import FlowNode, FlowLink, FlowMetadata, FlowsResponse

_CAT_COLORS: dict[str, str] = {
    "Food":          "#F97316",
    "Shopping":      "#8B5CF6",
    "Transport":     "#06B6D4",
    "Entertainment": "#EC4899",
    "Health":        "#10B981",
    "Utilities":     "#F59E0B",
    "Subscription":  "#6366F1",
    "Other":         "#94A3B8",
}


def aggregate_category_flow(
    rows: list[dict],
    min_amount: float = 0,
    start_date: str = "",
    end_date: str = "",
) -> FlowsResponse:
    """Aggregate raw transaction rows into Sankey nodes and links.

    Each debit (amount < 0) becomes a flow: Income → <category>.
    Credits are ignored. `None` category maps to "Other".
    """
    cat_totals: dict[str, float] = {}
    cat_counts: dict[str, int] = {}

    for row in rows:
        amt = row.get("amount", 0)
        if amt >= 0:
            continue  # skip credits/income transactions
        cat = (row.get("categories") or {}).get("name") or "Other"
        cat_totals[cat] = cat_totals.get(cat, 0.0) + abs(amt)
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    links: list[FlowLink] = []
    total_amount = 0.0
    total_tx = 0
    cats_used: list[str] = []

    for cat, total in sorted(cat_totals.items(), key=lambda x: -x[1]):
        if total < min_amount:
            continue
        links.append(FlowLink(
            source="Income",
            target=cat,
            value=round(total),
            transactions=cat_counts[cat],
        ))
        total_amount += total
        total_tx += cat_counts[cat]
        cats_used.append(cat)

    if not links:
        return FlowsResponse(
            nodes=[],
            links=[],
            metadata=FlowMetadata(
                total_transactions=0,
                total_amount=0,
                period=f"{start_date} – {end_date}",
            ),
        )

    nodes: list[FlowNode] = [
        FlowNode(id="Income", value=round(total_amount), type="source", color="#10B981"),
    ]
    for cat in cats_used:
        nodes.append(FlowNode(
            id=cat,
            value=round(cat_totals[cat]),
            type="category",
            color=_CAT_COLORS.get(cat, "#94A3B8"),
        ))

    return FlowsResponse(
        nodes=nodes,
        links=links,
        metadata=FlowMetadata(
            total_transactions=total_tx,
            total_amount=round(total_amount),
            period=f"{start_date} – {end_date}",
        ),
    )
