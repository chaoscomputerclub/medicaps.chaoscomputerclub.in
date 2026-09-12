"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Configuration settings
"""

import os
from pathlib import Path
from typing import List, Union
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

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: Union[str, None] = os.getenv("GOOGLE_REDIRECT_URI", None)

    # Email (SMTP) for OTP
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.hostinger.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "465"))
    SMTP_USER: str = os.getenv("SMTP_USER") or os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM") or os.getenv("SMTP_FROM_EMAIL", "")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Chaos Computer Club")

    # URLs
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:8081")
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")

    # OTP expiry (minutes)
    OTP_EXPIRE_MINUTES: int = 10

    # Redis (OTP session store)
    REDIS_HOST: str = os.getenv("REDIS_HOST", "127.0.0.1")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")

    @property
    def cors_origins_list(self) -> List[str]:
        env_origins = os.getenv("CORS_ORIGINS", "")
        origins = list(self.CORS_ORIGINS)
        if env_origins:
            for o in env_origins.split(","):
                clean = o.strip()
                if clean and clean not in origins:
                    origins.append(clean)
        if self.FRONTEND_URL and self.FRONTEND_URL not in origins:
            origins.append(self.FRONTEND_URL)
        return origins


    # MinIO / S3 Object Storage
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "127.0.0.1:9002")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadminsecret")
    MINIO_BUCKET_NAME: str = os.getenv("MINIO_BUCKET_NAME", "ccc-medicaps-media")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "false").lower() in ("true", "1", "yes")
    MINIO_PUBLIC_URL_PREFIX: str = os.getenv("MINIO_PUBLIC_URL_PREFIX", "https://medicaps.chaoscomputerclub.in/media")

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:8082",
        "http://localhost:8083",
        "http://localhost:8084",
        "http://localhost:8085",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:8082",
        "http://127.0.0.1:8083",
        "http://127.0.0.1:8084",
        "http://127.0.0.1:8085",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "https://medicaps.chaoscomputerclub.in",
        "https://chaoscomputerclub.in",
        "https://www.chaoscomputerclub.in",
        "https://api.medicaps.chaoscomputerclub.in",
    ]

    class Config:
        case_sensitive = True


settings = Settings()
