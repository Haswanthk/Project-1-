import pytest
from app.core.config import settings


def test_feature_flag_off_response_shape(client):
    """
    Verifies that when FEATURE_CLAIM_LEVEL_TRUST is False (default),
    the response from /api/v1/ai/chat-with-data maintains 100% legacy shape.
    """
    assert settings.feature_claim_level_trust is False

    # Login as test user
    email = "flag_off_user@enterprise.ai"
    client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": "Flag Tester",
        "role": "analyst"
    })
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/v1/ai/chat-with-data", json={"prompt": "What is revenue?"}, headers=headers)
    assert res.status_code == 200
    data = res.json()

    # Legacy fields must be present
    assert "response" in data
    assert "feature" in data
    assert "status" in data
    assert "provider_ready" in data

    # Claims must be None when flag is OFF
    assert data.get("claims") is None
