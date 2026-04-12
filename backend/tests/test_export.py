import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# IMPORTANT: GET /api/transactions/export must be declared in statements.py
# BEFORE the PATCH /api/transactions/{transaction_id} route. FastAPI matches
# routes in declaration order; if the parameterized route comes first, the
# string "export" is captured as `transaction_id` and returns 405.


@pytest.fixture
def client():
    with patch("routers.statements._get_supabase") as mock_supa:
        mock_user = MagicMock()
        mock_user.user.id = "user-123"
        mock_supa.return_value.auth.get_user.return_value = mock_user

        # Transactions returned for the queried month
        mock_chain = MagicMock()
        mock_chain.eq.return_value = mock_chain
        mock_chain.gte.return_value = mock_chain
        mock_chain.lt.return_value = mock_chain
        mock_chain.execute.return_value.data = [
            {
                "transaction_date": "2024-03-05",
                "description": "Supermarket ABC",
                "amount": -150000,
                "categories": {"name": "Food"},
            },
            {
                "transaction_date": "2024-03-10",
                "description": "Salary",
                "amount": 5000000,
                "categories": {"name": "Income"},
            },
        ]
        mock_supa.return_value.table.return_value.select.return_value = mock_chain

        from main import app
        yield TestClient(app)


def test_export_returns_csv(client):
    resp = client.get(
        "/api/transactions/export?month=2024-03",
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert 'attachment; filename="statement-2024-03.csv"' in resp.headers["content-disposition"]
    lines = resp.text.strip().splitlines()
    assert lines[0] == "Date,Description,Amount (IDR),Category"
    assert "Supermarket ABC" in resp.text
    assert "Salary" in resp.text


def test_export_csv_values(client):
    resp = client.get(
        "/api/transactions/export?month=2024-03",
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 200
    lines = resp.text.strip().splitlines()
    # First data row: expense is negative
    assert lines[1] == "2024-03-05,Supermarket ABC,-150000,Food"
    # Second data row: income is positive
    assert lines[2] == "2024-03-10,Salary,5000000,Income"


def test_export_invalid_month_format_returns_422(client):
    resp = client.get(
        "/api/transactions/export?month=March-2024",
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 422


def test_export_missing_auth_returns_422(client):
    resp = client.get("/api/transactions/export?month=2024-03")
    assert resp.status_code == 422
