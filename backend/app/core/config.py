"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Configuration settings inspired by Desktop/sharexpress/interleet
"""

import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env", override=True)


class Settings(BaseSettings):
    PROJECT_NAME: str = "CCC Medi-Caps Arena API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # Host & Port
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite+aiosqlite:///{BASE_DIR}/ccc_medicaps.db"
    )

    # JWT Authentication
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "ccc-medicaps-in-person-contest-security-key-2026-sha256-verified"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:8081",
        "http://localhost:8080",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:8080",
        "https://medicaps.chaoscomputerclub.in",
        "https://chaoscomputerclub.in",
        "*"
    ]

    class Config:
        case_sensitive = True


settings = Settings()
