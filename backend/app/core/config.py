"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Configuration settings
"""

import os
from pathlib import Path
from typing import List, Union, Optional
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env", override=True)


class Settings(BaseSettings):
    PROJECT_NAME: str = "CCC Medi-Caps Arena API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")

    # Host & Port
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))

    # Database (PostgreSQL 16+ via asyncpg)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/ccc_medicaps"
    )

    # JWT Authentication (RSA 256 / RS256 Asymmetric Cryptography)
    ALGORITHM: str = os.getenv("ALGORITHM", "RS256")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    JWT_PRIVATE_KEY: str = os.getenv("JWT_PRIVATE_KEY", "")
    JWT_PUBLIC_KEY: str = os.getenv("JWT_PUBLIC_KEY", "")
    JWT_PRIVATE_KEY_PATH: Optional[str] = os.getenv("JWT_PRIVATE_KEY_PATH", None)
    JWT_PUBLIC_KEY_PATH: Optional[str] = os.getenv("JWT_PUBLIC_KEY_PATH", None)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))  # 15 min short-lived access
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))  # 30 days long-lived refresh

    # Cookie Security Settings
    COOKIE_DOMAIN: Optional[str] = os.getenv("COOKIE_DOMAIN", None)
    COOKIE_SECURE: Optional[bool] = None if os.getenv("COOKIE_SECURE") is None else os.getenv("COOKIE_SECURE", "false").lower() in ("true", "1", "yes")
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax")

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: Union[str, None] = os.getenv("GOOGLE_REDIRECT_URI", None)

    # Cloudflare Client Security & Turnstile (read strictly from environment)
    CLOUDFLARE_TURNSTILE_SECRET_KEY: str = os.getenv("CLOUDFLARE_TURNSTILE_SECRET_KEY", "")
    CLOUDFLARE_TURNSTILE_SITE_KEY: str = os.getenv("CLOUDFLARE_TURNSTILE_SITE_KEY", "")
    CLOUDFLARE_TURNSTILE_ENABLED: bool = os.getenv(
        "CLOUDFLARE_TURNSTILE_ENABLED", "false"
    ).lower() in ("true", "1", "yes")

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

    # Dynamic Development Testing & Restriction Controls
    DEV_BYPASS_RESTRICTIONS: bool = os.getenv("DEV_BYPASS_RESTRICTIONS", "false").lower() in ("true", "1", "yes")
    DEV_MODE: bool = os.getenv("DEV_MODE", "false").lower() in ("true", "1", "yes")
    DISABLE_MAIL_DISPATCH: bool = os.getenv("DISABLE_MAIL_DISPATCH", "false").lower() in ("true", "1", "yes")
    FEATURE_ASSESSMENT_AND_QR_ENABLED: bool = os.getenv("FEATURE_ASSESSMENT_AND_QR_ENABLED", "false").lower() in ("true", "1", "yes")

    @property
    def is_dev_bypass_enabled(self) -> bool:
        """Returns True if any development restriction bypass mode is active."""
        env_bypass = os.getenv("DEV_BYPASS_RESTRICTIONS", "").lower() in ("true", "1", "yes")
        env_mode = os.getenv("DEV_MODE", "").lower() in ("true", "1", "yes")
        return bool(self.DEV_BYPASS_RESTRICTIONS or self.DEV_MODE or env_bypass or env_mode)

    @property
    def is_mail_dispatch_disabled(self) -> bool:
        """Returns True if mail dispatching is disabled (dev mode, dev bypass, or explicit toggle)."""
        env_disable = os.getenv("DISABLE_MAIL_DISPATCH", "").lower() in ("true", "1", "yes")
        return bool(self.DISABLE_MAIL_DISPATCH or self.is_dev_bypass_enabled or env_disable)

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
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "")
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
        "https://medicaps-api.chaoscomputerclub.in",
    ]

    class Config:
        case_sensitive = True


settings = Settings()

# Only load key files if paths are explicitly specified in environment variables
if not settings.JWT_PRIVATE_KEY and settings.JWT_PRIVATE_KEY_PATH:
    priv_path = Path(settings.JWT_PRIVATE_KEY_PATH)
    if not priv_path.is_absolute():
        priv_path = BASE_DIR / priv_path
    if priv_path.exists():
        settings.JWT_PRIVATE_KEY = priv_path.read_text().strip()

if not settings.JWT_PUBLIC_KEY and settings.JWT_PUBLIC_KEY_PATH:
    pub_path = Path(settings.JWT_PUBLIC_KEY_PATH)
    if not pub_path.is_absolute():
        pub_path = BASE_DIR / pub_path
    if pub_path.exists():
        settings.JWT_PUBLIC_KEY = pub_path.read_text().strip()

