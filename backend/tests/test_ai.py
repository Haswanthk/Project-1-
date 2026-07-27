from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_ai_providers_and_fallback():
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
