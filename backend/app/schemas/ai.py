from typing import Any
from pydantic import BaseModel


class AIRequest(BaseModel):
    prompt: str = ""
    context: dict | None = None
    dataset_context: str | None = None
    messages: list[dict[str, Any]] | None = None


class AIResponse(BaseModel):
    feature: str
    status: str
    message: str
    provider_ready: bool
    response: str | None = None
    answer: str | None = None
    provider: str | None = None


