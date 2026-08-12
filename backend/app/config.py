import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/campusiq_db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "krmu_campus_intelligence_platform_secret_key_2026_super_secure")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
