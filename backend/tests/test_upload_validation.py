import io
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# We patch auth + DB so tests run without real credentials
@pytest.fixture
def client():
    with patch("routers.statements._get_supabase") as mock_supa:
        mock_user = MagicMock()
        mock_user.user.id = "test-user-id"
        mock_supa.return_value.auth.get_user.return_value = mock_user
        from main import app
        yield TestClient(app)


def _upload(client, content: bytes, filename: str = "test.pdf", content_type: str = "application/pdf"):
    return client.post(
        "/api/upload-statement",
        headers={"Authorization": "Bearer fake-jwt"},
        files={"file": (filename, io.BytesIO(content), content_type)},
        data={"password": ""},
    )


def test_rejects_file_over_10mb(client):
    big = b"%PDF-" + b"A" * (10 * 1024 * 1024 + 1)
    resp = _upload(client, big)
    assert resp.status_code == 400
    assert "10 MB" in resp.json()["detail"]


def test_rejects_wrong_mime_type(client):
    resp = _upload(client, b"%PDF-fake", content_type="image/png")
    assert resp.status_code == 400
    assert "PDF" in resp.json()["detail"]


def test_rejects_bad_magic_bytes(client):
    resp = _upload(client, b"PK\x03\x04fake-zip-data")
    assert resp.status_code == 400
    assert "PDF" in resp.json()["detail"]


def test_accepts_valid_pdf_mime_and_magic(client):
    # Should pass validation (will fail later at PDF parsing, that's fine)
    resp = _upload(client, b"%PDF-1.4 fake content")
    # Not a 400 from our validation — could be 422 from parser, that's ok
    assert resp.status_code != 400


import time as time_module

def test_rate_limit_blocks_after_10_uploads(client):
    from routers.statements import _upload_counts
    user_id = "test-user-id"
    now = time_module.time()
    # Pre-fill 10 recent uploads
    _upload_counts[user_id] = [now - i for i in range(10)]

    resp = _upload(client, b"%PDF-fake")
    assert resp.status_code == 429
    assert "limit" in resp.json()["detail"].lower()


def test_rate_limit_allows_after_window_expires(client):
    from routers.statements import _upload_counts
    user_id = "test-user-id"
    # All 10 uploads are older than 1 hour
    _upload_counts[user_id] = [time_module.time() - 3700 for _ in range(10)]

    resp = _upload(client, b"%PDF-fake")
    # Should pass rate limit (will fail at PDF parsing, not 429)
    assert resp.status_code != 429
