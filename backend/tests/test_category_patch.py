import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.fixture
def client():
    with patch("routers.statements._get_supabase") as mock_supa:
        mock_user = MagicMock()
        mock_user.user.id = "user-123"
        mock_supa.return_value.auth.get_user.return_value = mock_user

        # Simulate category lookup returning {name: id}
        mock_supa.return_value.table.return_value.select.return_value.execute.return_value.data = [
            {"id": "cat-food-uuid", "name": "Food"},
            {"id": "cat-other-uuid", "name": "Other"},
        ]

        # Simulate the update chain returning 1 updated row
        mock_update = MagicMock()
        mock_update.eq.return_value = mock_update
        mock_update.execute.return_value.data = [{"id": "txn-uuid", "category_id": "cat-food-uuid"}]
        mock_supa.return_value.table.return_value.update.return_value = mock_update

        from main import app
        yield TestClient(app)


def test_patch_valid_category(client):
    resp = client.patch(
        "/api/transactions/txn-uuid",
        headers={"Authorization": "Bearer fake-jwt"},
        json={"category_name": "Food"},
    )
    assert resp.status_code == 200
    assert resp.json()["category_name"] == "Food"


def test_patch_invalid_category_returns_422(client):
    resp = client.patch(
        "/api/transactions/txn-uuid",
        headers={"Authorization": "Bearer fake-jwt"},
        json={"category_name": "NotACategory"},
    )
    assert resp.status_code == 422


def test_patch_missing_auth_returns_422(client):
    resp = client.patch(
        "/api/transactions/txn-uuid",
        json={"category_name": "Food"},
    )
    assert resp.status_code == 422  # FastAPI 422 for missing required header
