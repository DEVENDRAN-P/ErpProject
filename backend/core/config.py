import os
from typing import Optional

try:
    from pydantic_settings import BaseSettings
    from pydantic import AnyHttpUrl, Field
except ImportError:
    from pydantic import AnyHttpUrl, Field
    from pydantic import BaseSettings  # pydantic v1 fallback


class Settings(BaseSettings):
    app_name: str = "ProductPilot AI"
    api_prefix: str = "/api"
    project_name: str = "ProductPilot"
    secret_key: str = Field(default="dev-secret-please-change", alias="JWT_SECRET_KEY")
    algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=120, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    database_url: str = Field(default="sqlite:///./productpilot.db", alias="DATABASE_URL")
    frontend_url: str = Field(default="http://localhost:3000", alias="FRONTEND_URL")
    backend_url: str = Field(default="http://localhost:8000", alias="BACKEND_URL")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "populate_by_name": True, "extra": "ignore"}


settings = Settings()

