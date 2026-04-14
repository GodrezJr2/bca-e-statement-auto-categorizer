def test_flow_schemas_importable():
    from models.schemas import FlowNode, FlowLink, FlowMetadata, FlowsResponse
    node = FlowNode(id="Income", value=1000000, type="source", color="#10B981")
    assert node.id == "Income"
    link = FlowLink(source="Income", target="Food", value=500000, transactions=5)
    assert link.value == 500000
    meta = FlowMetadata(total_transactions=5, total_amount=500000, period="2026-03-01 – 2026-03-31")
    assert meta.total_transactions == 5
    resp = FlowsResponse(nodes=[node], links=[link], metadata=meta)
    assert len(resp.nodes) == 1


import pytest

ROWS = [
    {"transaction_date": "2026-03-01", "amount": -500000, "categories": {"name": "Food"}},
    {"transaction_date": "2026-03-02", "amount": -300000, "categories": {"name": "Food"}},
    {"transaction_date": "2026-03-03", "amount": -200000, "categories": {"name": "Transport"}},
    {"transaction_date": "2026-03-04", "amount":  1000000, "categories": {"name": "Income"}},  # credit — must be ignored
    {"transaction_date": "2026-03-05", "amount": -150000, "categories": None},  # no category → "Other"
]


def test_aggregator_builds_income_source_node():
    from services.flow_aggregator import aggregate_category_flow
    resp = aggregate_category_flow(ROWS)
    ids = [n.id for n in resp.nodes]
    assert "Income" in ids


def test_aggregator_builds_category_nodes():
    from services.flow_aggregator import aggregate_category_flow
    resp = aggregate_category_flow(ROWS)
    ids = [n.id for n in resp.nodes]
    assert "Food" in ids
    assert "Transport" in ids
    assert "Other" in ids


def test_aggregator_ignores_credits():
    from services.flow_aggregator import aggregate_category_flow
    resp = aggregate_category_flow(ROWS)
    credit_targets = [l for l in resp.links if l.source != "Income"]
    assert len(credit_targets) == 0


def test_aggregator_sums_food_amount():
    from services.flow_aggregator import aggregate_category_flow
    resp = aggregate_category_flow(ROWS)
    food_link = next(l for l in resp.links if l.target == "Food")
    assert food_link.value == 800000
    assert food_link.transactions == 2


def test_aggregator_null_category_becomes_other():
    from services.flow_aggregator import aggregate_category_flow
    resp = aggregate_category_flow(ROWS)
    other_link = next((l for l in resp.links if l.target == "Other"), None)
    assert other_link is not None
    assert other_link.value == 150000


def test_aggregator_filters_by_min_amount():
    from services.flow_aggregator import aggregate_category_flow
    resp = aggregate_category_flow(ROWS, min_amount=300000)
    targets = [l.target for l in resp.links]
    assert "Food" in targets
    assert "Transport" not in targets
    assert "Other" not in targets


def test_aggregator_empty_rows_returns_empty():
    from services.flow_aggregator import aggregate_category_flow
    resp = aggregate_category_flow([])
    assert resp.nodes == []
    assert resp.links == []


def test_aggregator_metadata_totals():
    from services.flow_aggregator import aggregate_category_flow
    resp = aggregate_category_flow(ROWS, start_date="2026-03-01", end_date="2026-03-31")
    assert resp.metadata.total_amount == 1_150_000
    assert resp.metadata.total_transactions == 4
    assert "2026-03-01" in resp.metadata.period


def test_aggregator_food_node_color():
    from services.flow_aggregator import aggregate_category_flow
    resp = aggregate_category_flow(ROWS)
    food_node = next(n for n in resp.nodes if n.id == "Food")
    assert food_node.color == "#F97316"


def test_aggregator_income_node_value_matches_total_spending():
    from services.flow_aggregator import aggregate_category_flow
    resp = aggregate_category_flow(ROWS)
    income_node = next(n for n in resp.nodes if n.id == "Income")
    total_link_value = sum(l.value for l in resp.links)
    assert income_node.value == total_link_value
