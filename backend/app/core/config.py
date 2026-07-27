from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = "Unified Enterprise AI Analytics Platform API"
    environment: Literal["development", "staging", "production"] = "development"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    frontend_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175"
    database_url: str = "sqlite:///./app.db"
    redis_url: str = "redis://localhost:6379/0"
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "unified_ai_platform"

    enable_openai: bool = False
    enable_gemini: bool = False
    enable_claude: bool = False
    enable_deepseek: bool = False
    enable_groq: bool = False
    enable_openrouter: bool = False
    enable_ollama: bool = False
    enable_local_llama: bool = False

    openai_api_key: str = ""
    gemini_api_key: str = ""
    claude_api_key: str = ""
    deepseek_api_key: str = ""
    groq_api_key: str = ""
    openrouter_api_key: str = ""
    ollama_base_url: str = ""
    local_llama_endpoint: str = ""

    def get_frontend_origins(self) -> list[str]:
        return [part.strip() for part in self.frontend_origins.split(",") if part.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
