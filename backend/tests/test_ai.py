from fastapi.testclient import TestClient
from app.main import app

def test_ai_providers_and_fallback(client):
    # Login to get token
    email = "ai_test@enterprise.ai"
    client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": "AI Tester",
        "role": "admin"
    })
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Test providers
    res_prov = client.get("/api/v1/ai/providers", headers=headers)
    assert res_prov.status_code == 200
    assert len(res_prov.json()) > 0

    # Test chat with data
    res_chat = client.post("/api/v1/ai/chat-with-data", json={"prompt": "Test query"}, headers=headers)
    assert res_chat.status_code == 200
    assert "response" in res_chat.json() or "message" in res_chat.json()


def test_gemini_request_uses_header_and_clean_url(monkeypatch):
    """Offline regression test confirming request URL contains no credentials and x-goog-api-key header is supplied."""
    from unittest.mock import MagicMock
    import httpx
    from app.core.config import settings
    from app.services.ai_service import AIServiceLayer

    monkeypatch.setattr(settings, "enable_gemini", True)
    monkeypatch.setattr(settings, "gemini_api_key", "secret-test-key-xyz-123")

    captured_requests = []

    def mock_post(self, url, *args, **kwargs):
        captured_requests.append({
            "url": str(url),
            "headers": kwargs.get("headers", {}),
            "json": kwargs.get("json", {})
        })
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [
                {"content": {"parts": [{"text": "Synthetic test response"}]}}
            ]
        }
        return mock_resp

    monkeypatch.setattr(httpx.Client, "post", mock_post)

    svc = AIServiceLayer()
    result = svc._call_gemini(prompt="Test prompt")

    assert result == "Synthetic test response"
    assert len(captured_requests) >= 1

    first_req = captured_requests[0]
    # Verify no credential in URL
    assert "key=" not in first_req["url"]
    assert "secret-test-key" not in first_req["url"]
    # Verify authentication header is supplied
    assert first_req["headers"].get("x-goog-api-key") == "secret-test-key-xyz-123"

