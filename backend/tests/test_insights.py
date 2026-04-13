import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Two months of fake transaction data.
# March 2024: Food 300k + 100k = 400k, Transport 200k, Other 900k (big tx)
# Feb 2024 (prior): Food 200k, Transport 200k
MARCH_ROWS = [
    {"transaction_date": "2024-03-01", "amount": -300000, "categories": {"name": "Food"}},
    {"transaction_date": "2024-03-05", "amount": -100000, "categories": {"name": "Food"}},
    {"transaction_date": "2024-03-10", "amount": -200000, "categories": {"name": "Transport"}},
    {"transaction_date": "2024-03-15", "amount": -900000, "categories": {"name": "Other"}},
    {"transaction_date": "2024-03-20", "amount":  5000000, "categories": {"name": "Income"}},
]
FEB_ROWS = [
    {"transaction_date": "2024-02-01", "amount": -200000, "categories": {"name": "Food"}},
    {"transaction_date": "2024-02-10", "amount": -200000, "categories": {"name": "Transport"}},
]


@pytest.fixture
def client():
    with patch("routers.insights._get_supabase") as mock_supa:
        mock_user = MagicMock()
        mock_user.user.id = "user-123"
        mock_supa.return_value.auth.get_user.return_value = mock_user

        call_count = {"n": 0}

        def execute_side_effect():
            n = call_count["n"]
            call_count["n"] += 1
            result = MagicMock()
            result.data = MARCH_ROWS if n == 0 else FEB_ROWS
            return result

        chain = MagicMock()
        chain.eq.return_value = chain
        chain.gte.return_value = chain
        chain.lt.return_value = chain
        chain.execute.side_effect = execute_side_effect
        mock_supa.return_value.table.return_value.select.return_value = chain

        from main import app
        yield TestClient(app)


def test_insights_returns_list(client):
    resp = client.get(
        "/api/insights?month=2024-03",
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "insights" in body
    assert "month" in body
    assert body["month"] == "2024-03"
    assert isinstance(body["insights"], list)


def test_insights_includes_largest_category(client):
    resp = client.get(
        "/api/insights?month=2024-03",
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 200
    text = " ".join(resp.json()["insights"])
    # Other (900k) is the largest expense category
    assert "Other" in text


def test_insights_detects_food_increase(client):
    resp = client.get(
        "/api/insights?month=2024-03",
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 200
    text = " ".join(resp.json()["insights"])
    # Food went from 200k to 400k = +100% → should be reported as "up"
    assert "Food" in text and "up" in text


def test_insights_invalid_month_returns_422(client):
    resp = client.get(
        "/api/insights?month=bad-month",
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 422


def test_insights_missing_auth_returns_422():
    # No fixture needed — FastAPI rejects missing required Header before route runs
    with patch("routers.insights._get_supabase"):
        from main import app
        test_client = TestClient(app)
        resp = test_client.get("/api/insights?month=2024-03")
        assert resp.status_code == 422


def test_insights_empty_month_returns_empty_list():
    """When current month has no transactions, insights list is empty."""
    with patch("routers.insights._get_supabase") as mock_supa:
        mock_user = MagicMock()
        mock_user.user.id = "user-123"
        mock_supa.return_value.auth.get_user.return_value = mock_user

        call_count = {"n": 0}

        def execute_side_effect():
            call_count["n"] += 1
            result = MagicMock()
            result.data = []  # both months empty
            return result

        chain = MagicMock()
        chain.eq.return_value = chain
        chain.gte.return_value = chain
        chain.lt.return_value = chain
        chain.execute.side_effect = execute_side_effect
        mock_supa.return_value.table.return_value.select.return_value = chain

        from main import app
        test_client = TestClient(app)
        resp = test_client.get(
            "/api/insights?month=2024-03",
            headers={"Authorization": "Bearer fake-jwt"},
        )
        assert resp.status_code == 200
        assert resp.json()["insights"] == []


def test_insights_large_tx_uses_prior_month_baseline():
    """A single transaction > 2x the prior month's category average is flagged."""
    # Prior month: Food average = 100k (one 100k transaction)
    # Current month: Food = 300k (one transaction, 3x the prior avg → flagged)
    prior = [{"transaction_date": "2024-02-01", "amount": -100000, "categories": {"name": "Food"}}]
    current = [{"transaction_date": "2024-03-01", "amount": -300000, "categories": {"name": "Food"}}]

    with patch("routers.insights._get_supabase") as mock_supa:
        mock_user = MagicMock()
        mock_user.user.id = "user-123"
        mock_supa.return_value.auth.get_user.return_value = mock_user

        call_count = {"n": 0}

        def execute_side_effect():
            n = call_count["n"]
            call_count["n"] += 1
            result = MagicMock()
            result.data = current if n == 0 else prior
            return result

        chain = MagicMock()
        chain.eq.return_value = chain
        chain.gte.return_value = chain
        chain.lt.return_value = chain
        chain.execute.side_effect = execute_side_effect
        mock_supa.return_value.table.return_value.select.return_value = chain

        from main import app
        test_client = TestClient(app)
        resp = test_client.get(
            "/api/insights?month=2024-03",
            headers={"Authorization": "Bearer fake-jwt"},
        )
        assert resp.status_code == 200
        text = " ".join(resp.json()["insights"])
        assert "transaction" in text  # the large-tx insight fired
