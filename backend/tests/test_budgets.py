import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

BUDGET_ROWS = [
    {"category": "Food",      "monthly_limit": 500000},
    {"category": "Transport", "monthly_limit": 200000},
]


def test_budget_schemas_importable():
    from models.schemas import BudgetItem, BudgetsResponse, BudgetUpsertRequest
    item = BudgetItem(category="Food", monthly_limit=500000)
    assert item.category == "Food"
    assert item.monthly_limit == 500000


@pytest.fixture
def client():
    with patch("routers.budgets._get_supabase") as mock_supa:
        mock_user = MagicMock()
        mock_user.user.id = "user-abc"
        mock_supa.return_value.auth.get_user.return_value = mock_user

        chain = MagicMock()
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.execute.return_value = MagicMock(data=BUDGET_ROWS)
        mock_supa.return_value.table.return_value.select.return_value = chain

        from main import app
        yield TestClient(app)


def test_get_budgets_returns_list(client):
    resp = client.get("/api/budgets", headers={"Authorization": "Bearer fake-jwt"})
    assert resp.status_code == 200
    body = resp.json()
    assert "budgets" in body
    assert len(body["budgets"]) == 2
    assert body["budgets"][0]["category"] == "Food"
    assert body["budgets"][0]["monthly_limit"] == 500000


def test_get_budgets_missing_auth_returns_422():
    with patch("routers.budgets._get_supabase"):
        from main import app
        tc = TestClient(app)
        resp = tc.get("/api/budgets")
        assert resp.status_code == 422


@pytest.fixture
def put_client():
    """Separate fixture for PUT tests — upsert returns one row."""
    with patch("routers.budgets._get_supabase") as mock_supa:
        mock_user = MagicMock()
        mock_user.user.id = "user-abc"
        mock_supa.return_value.auth.get_user.return_value = mock_user

        upsert_chain = MagicMock()
        upsert_chain.execute.return_value = MagicMock(
            data=[{"category": "Food", "monthly_limit": 600000}]
        )
        mock_supa.return_value.table.return_value.upsert.return_value = upsert_chain

        from main import app
        yield TestClient(app)


def test_put_budget_creates_entry(put_client):
    resp = put_client.put(
        "/api/budgets/Food",
        json={"monthly_limit": 600000},
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["category"] == "Food"
    assert body["monthly_limit"] == 600000


def test_put_budget_invalid_category(put_client):
    resp = put_client.put(
        "/api/budgets/InvalidCat",
        json={"monthly_limit": 100000},
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 422


def test_put_budget_zero_limit_returns_422(put_client):
    resp = put_client.put(
        "/api/budgets/Food",
        json={"monthly_limit": 0},
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 422


def test_put_budget_negative_limit_returns_422(put_client):
    resp = put_client.put(
        "/api/budgets/Food",
        json={"monthly_limit": -1000},
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 422