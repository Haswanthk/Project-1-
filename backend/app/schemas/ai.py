from pydantic import BaseModel


class AIRequest(BaseModel):
    prompt: str
    context: dict | None = None


class AIResponse(BaseModel):
    feature: str
    status: str
    message: str
    provider_ready: bool
    response: str | None = None
    provider: str | None = None


