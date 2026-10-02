"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Configuration settings
"""

import os
from functools import cached_property
from pathlib import Path
from typing import List, Union, Optional
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env", override=True)


class Settings(BaseSettings):
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Arena API")
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")

    # Host & Port
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))

    # Database (PostgreSQL 16+ via asyncpg)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/arena_dev"
    )
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "20"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    DB_POOL_RECYCLE: int = int(os.getenv("DB_POOL_RECYCLE", "1800"))


    # JWT Authentication (RSA 256 / RS256 Asymmetric Cryptography)
    ALGORITHM: str = os.getenv("ALGORITHM", "RS256")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    JWT_PRIVATE_KEY: str = os.getenv("JWT_PRIVATE_KEY", "")
    JWT_PUBLIC_KEY: str = os.getenv("JWT_PUBLIC_KEY", "")
    JWT_PRIVATE_KEY_PATH: Optional[str] = os.getenv("JWT_PRIVATE_KEY_PATH", None)
    JWT_PUBLIC_KEY_PATH: Optional[str] = os.getenv("JWT_PUBLIC_KEY_PATH", None)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))  # 30 days long-lived refresh

    # Core Team & Chief Proctor Access Control (ENV Driven)
    ALLOWED_EMAIL_DOMAIN: str = os.getenv("ALLOWED_EMAIL_DOMAIN", "medicaps.ac.in")
    CONTACT_EMAIL: Optional[str] = os.getenv("CONTACT_EMAIL", "info@chaoscomputerclub.in")
    CORE_TEAM_EMAILS: Optional[str] = os.getenv(
        "CORE_TEAM_EMAILS",
        "en23cs301927@medicaps.ac.in,santushtkotai@gmail.com,info@chaoscomputerclub.in,qa.organizer@medicaps.ac.in",
    )
    CORE_TEAM_HANDLES: Optional[str] = os.getenv(
        "CORE_TEAM_HANDLES",
        "santusht,admin,core,proctor,qa_organizer",
    )
    ADMIN_PRIMARY_EMAIL: Optional[str] = os.getenv("ADMIN_PRIMARY_EMAIL", "en23cs301927@medicaps.ac.in")
    QA_ORGANIZER_EMAIL: Optional[str] = os.getenv("QA_ORGANIZER_EMAIL", "qa.organizer@medicaps.ac.in")
    QA_TARGET_EMAIL: Optional[str] = os.getenv("QA_TARGET_EMAIL", "qa.target@medicaps.ac.in")

    @cached_property
    def core_team_emails_set(self) -> set:
        raw = self.CORE_TEAM_EMAILS or os.getenv("CORE_TEAM_EMAILS") or "en23cs301927@medicaps.ac.in,santushtkotai@gmail.com,info@chaoscomputerclub.in,qa.organizer@medicaps.ac.in"
        return {
            e.strip().lower()
            for e in raw.split(",")
            if e.strip()
        }

    @cached_property
    def core_team_handles_set(self) -> set:
        raw = self.CORE_TEAM_HANDLES or os.getenv("CORE_TEAM_HANDLES") or "santusht,admin,core,proctor,qa_organizer"
        return {
            h.strip().lower()
            for h in raw.split(",")
            if h.strip()
        }

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
    SMTP_HOST: str = os.getenv("SMTP_HOST", "localhost")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "465"))
    SMTP_USER: str = os.getenv("SMTP_USER") or os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM") or os.getenv("SMTP_FROM_EMAIL", "")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Arena Auth")

    # URLs — Environment-aware, strictly defaults to production domain in production
    FRONTEND_URL: str = os.getenv(
        "FRONTEND_URL",
        "https://medicaps.chaoscomputerclub.in"
        if os.getenv("ENVIRONMENT", "production").lower() == "production"
        else "http://localhost:8081",
    )
    BACKEND_URL: str = os.getenv(
        "BACKEND_URL",
        "https://medicaps-api.chaoscomputerclub.in/api"
        if os.getenv("ENVIRONMENT", "production").lower() == "production"
        else "http://localhost:8000/api",
    )

    # Dynamic Development Testing & Restriction Controls
    DEV_BYPASS_RESTRICTIONS: bool = os.getenv("DEV_BYPASS_RESTRICTIONS", "false").lower() in ("true", "1", "yes")
    DEV_MODE: bool = os.getenv("DEV_MODE", "false").lower() in ("true", "1", "yes")
    DISABLE_MAIL_DISPATCH: bool = os.getenv("DISABLE_MAIL_DISPATCH", "false").lower() in ("true", "1", "yes")
    FEATURE_ASSESSMENT_AND_QR_ENABLED: bool = os.getenv("FEATURE_ASSESSMENT_AND_QR_ENABLED", "false").lower() in ("true", "1", "yes")

    # Judge Sandbox Security & Isolation Policies
    # In production, untrusted code MUST run in isolated Docker sandboxes.
    # Unsandboxed host execution is strictly disabled by default (fail-closed).
    ALLOW_UNSANDBOXED_EXECUTION: bool = os.getenv("ALLOW_UNSANDBOXED_EXECUTION", "false").lower() in ("true", "1", "yes")
    JUDGE_PROVIDER: str = os.getenv("JUDGE_PROVIDER", "docker")
    OUTPUT_LIMIT_BYTES: int = int(os.getenv("OUTPUT_LIMIT_BYTES", "65536"))  # 64 KB default output guard

    # Worker Registry & Resource Governor
    JUDGE_AGENT_SECRET: str = os.getenv("JUDGE_AGENT_SECRET", "")          # Shared secret for worker auth
    WORKER_HEARTBEAT_INTERVAL_S: int = int(os.getenv("WORKER_HEARTBEAT_INTERVAL_S", "5"))
    WORKER_HEARTBEAT_TTL_S: int = int(os.getenv("WORKER_HEARTBEAT_TTL_S", "30"))    # OFFLINE after this
    WORKER_SUSPECT_AFTER_S: int = int(os.getenv("WORKER_SUSPECT_AFTER_S", "10"))    # SUSPECT before OFFLINE
    WORKER_VISIBILITY_TIMEOUT_S: int = int(os.getenv("WORKER_VISIBILITY_TIMEOUT_S", "300"))
    WORKER_MAX_CONCURRENCY: int = int(os.getenv("WORKER_MAX_CONCURRENCY", "4"))     # Default per worker
    WORKER_CPU_SAFETY_THRESHOLD: float = float(os.getenv("WORKER_CPU_SAFETY_THRESHOLD", "0.80"))
    WORKER_RAM_SAFETY_FLOOR_MB: int = int(os.getenv("WORKER_RAM_SAFETY_FLOOR_MB", "1024"))
    WORKER_SCALE_UP_WAIT_S: int = int(os.getenv("WORKER_SCALE_UP_WAIT_S", "30"))   # Queue wait → scale up
    ARENA_SUBMIT_RATE_LIMIT: int = int(os.getenv("ARENA_SUBMIT_RATE_LIMIT", "15")) # per 60s per user


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

    # CORS (strictly loaded via environment variables in O(1))
    CORS_ORIGINS: Optional[Union[List[str], str]] = None

    @cached_property
    def cors_origins_list(self) -> Optional[List[str]]:
        if not self.CORS_ORIGINS:
            return None
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


    # MinIO / S3 Object Storage
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "127.0.0.1:9002")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "")
    MINIO_BUCKET_NAME: str = os.getenv("MINIO_BUCKET_NAME", "arena-media")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "false").lower() in ("true", "1", "yes")
    MINIO_PUBLIC_URL_PREFIX: str = os.getenv("MINIO_PUBLIC_URL_PREFIX", "")

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in ("production", "prod")

    class Config:
        case_sensitive = True


settings = Settings()

# Access tokens are deliberately short-lived; the refresh token is the long-lived credential.
if settings.is_production and settings.ACCESS_TOKEN_EXPIRE_MINUTES > 15:
    settings.ACCESS_TOKEN_EXPIRE_MINUTES = 15

# Enforce Phase 7: DATABASE_URL Safety — Zero implicit fallback in production
if settings.is_production:
    raw_db_env = os.getenv("DATABASE_URL", "").strip()
    if not raw_db_env:
        raise RuntimeError(
            "CRITICAL CONFIGURATION ERROR: DATABASE_URL must be explicitly configured "
            "in production environment. Implicit defaults and dev fallbacks are strictly prohibited."
        )
    if "arena_dev" in settings.DATABASE_URL:
        raise RuntimeError(
            "CRITICAL CONFIGURATION ERROR: Development database fallback 'arena_dev' detected "
            "in production environment. Production must specify a valid production DATABASE_URL."
        )

# Load key files if paths are explicitly specified or default keys/ directory exists
if not settings.JWT_PRIVATE_KEY:
    if settings.JWT_PRIVATE_KEY_PATH:
        priv_path = Path(settings.JWT_PRIVATE_KEY_PATH)
        if not priv_path.is_absolute():
            priv_path = BASE_DIR / priv_path
        if priv_path.exists():
            settings.JWT_PRIVATE_KEY = priv_path.read_text().strip()
    elif (BASE_DIR / "keys" / "jwt_private_key.pem").exists():
        settings.JWT_PRIVATE_KEY = (BASE_DIR / "keys" / "jwt_private_key.pem").read_text().strip()

if not settings.JWT_PUBLIC_KEY:
    if settings.JWT_PUBLIC_KEY_PATH:
        pub_path = Path(settings.JWT_PUBLIC_KEY_PATH)
        if not pub_path.is_absolute():
            pub_path = BASE_DIR / pub_path
        if pub_path.exists():
            settings.JWT_PUBLIC_KEY = pub_path.read_text().strip()
    elif (BASE_DIR / "keys" / "jwt_public_key.pem").exists():
        settings.JWT_PUBLIC_KEY = (BASE_DIR / "keys" / "jwt_public_key.pem").read_text().strip()

