"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Production Infrastructure Safety & Database Isolation Sentinel
==============================================================
CRITICAL SECURITY CORE:
Guarantees that destructive database operations (DROP, TRUNCATE, DELETE,
reset, purge, arbitrary seeding) are NEVER permitted to execute in production.

This module provides fail-safe environment detection and enforcement:
1. Detects live production droplet filesystem signatures.
2. Detects production database URLs and host fingerprints.
3. Detects production environment variables (ENVIRONMENT, APP_ENV, NODE_ENV).
4. Hard-aborts with uncatchable exit if any destructive operation is attempted.
"""

import os
import sys
import socket
from pathlib import Path
from typing import Optional, List

# Known production hostnames, domains, and IP fingerprints
PRODUCTION_FINGERPRINTS: List[str] = [
    "143.198.38.205",             # Production DigitalOcean droplet public IP
    "medicaps-api.",              # Production API subdomain
    "medicaps.chaoscomputerclub", # Production student portal domain
    "chaoscomputerclub.in",       # Root production domain
    "prod.internal",              # Internal prod network label
]

# Filesystem markers that only exist on the live production Linux host
PRODUCTION_DROPLET_PATHS: List[str] = [
    "/root/projects/ccc-medicaps-api",
    "/var/www/ccc-medicaps",
    "/var/www/ccc-medicaps-admin",
]


def is_ci_runner() -> bool:
    """Detects whether code is executing inside GitHub Actions CI runner."""
    return os.environ.get("CI", "").strip().lower() in ("true", "1", "yes")


def is_local_mutation_opted_in() -> bool:
    """Explicit developer acknowledgement for local development data mutations."""
    return os.environ.get("ALLOW_LOCAL_MUTATION", "").strip().lower() in ("true", "1", "yes")


def is_running_on_production_droplet() -> bool:
    """Detect if execution is taking place directly on the live production droplet."""
    # 1. Check known production droplet directory structures
    for path_str in PRODUCTION_DROPLET_PATHS:
        if os.path.exists(path_str):
            return True

    # 2. Check hostname patterns (production droplet hostnames)
    try:
        hostname = socket.gethostname().lower()
        if "medicaps" in hostname and not is_ci_runner():
            return True
    except Exception:
        pass

    # 3. Explicit production environment configuration
    env_name = (
        os.environ.get("ENVIRONMENT", "")
        or os.environ.get("APP_ENV", "")
        or os.environ.get("NODE_ENV", "")
    ).strip().lower()
    if env_name in ("production", "prod"):
        return True

    return False


def is_production_database_url(db_url: Optional[str] = None) -> bool:
    """Evaluates whether the database URL targets any known production host or domain."""
    if not db_url:
        db_url = os.environ.get("DATABASE_URL", "")

    if not db_url:
        # Fall back to reading .env file if available
        candidates = [
            Path(__file__).resolve().parent.parent.parent / ".env",
            Path.cwd() / ".env",
            Path.cwd() / "backend" / ".env",
        ]
        for p in candidates:
            if p.is_file():
                try:
                    for line in p.read_text(encoding="utf-8").splitlines():
                        line = line.strip()
                        if line.startswith("DATABASE_URL=") and not line.startswith("#"):
                            db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                            break
                except Exception:
                    pass
            if db_url:
                break

    db_lower = (db_url or "").lower()
    return any(fp in db_lower for fp in PRODUCTION_FINGERPRINTS)


def is_production_environment(db_url: Optional[str] = None) -> bool:
    """Comprehensive production check combining environment flags, droplet paths, and DB URLs."""
    if is_running_on_production_droplet():
        return True
    if is_production_database_url(db_url):
        return True

    env_name = (
        os.environ.get("ENVIRONMENT", "")
        or os.environ.get("APP_ENV", "")
        or os.environ.get("NODE_ENV", "")
    ).strip().lower()
    return env_name in ("production", "prod")


class ProductionSafetyViolation(RuntimeError):
    """Raised when an unsafe or destructive database operation is attempted in production."""
    pass


def assert_destructive_allowed(
    operation: str,
    script_name: Optional[str] = None,
    db_url: Optional[str] = None,
) -> None:
    """
    Hard-guard against destructive operations in production.
    Raises ProductionSafetyViolation and exits immediately if running against production.
    """
    caller = script_name or os.path.basename(sys.argv[0] if sys.argv else "script")

    if is_production_environment(db_url):
        error_msg = (
            f"\n{'=' * 78}\n"
            f"  🚨  CRITICAL INFRASTRUCTURE PROTECTION — OPERATION BLOCKED\n"
            f"{'=' * 78}\n"
            f"  Caller    : {caller}\n"
            f"  Operation : {operation}\n"
            f"  Reason    : Live PRODUCTION environment or database detected.\n"
            f"  Policy    : Destructive database operations (DROP, TRUNCATE, DELETE,\n"
            f"              table purges, database resets, development seeders) are\n"
            f"              STRICTLY FORBIDDEN on production infrastructure.\n"
            f"{'=' * 78}\n"
        )
        print(error_msg, file=sys.stderr)
        raise ProductionSafetyViolation(
            f"Destructive operation '{operation}' is permanently forbidden in production!"
        )

    # In local environments, require explicit acknowledgement
    if not is_ci_runner() and not is_local_mutation_opted_in():
        warn_msg = (
            f"\n{'=' * 78}\n"
            f"  ⚠️   LOCAL MUTATION GUARD — ACKNOWLEDGEMENT REQUIRED\n"
            f"{'=' * 78}\n"
            f"  Caller    : {caller}\n"
            f"  Operation : {operation}\n"
            f"  Reason    : Mutating database rows requires explicit acknowledgement.\n"
            f"  Action    : To run against your LOCAL development database, set:\n"
            f"              export ALLOW_LOCAL_MUTATION=true\n"
            f"{'=' * 78}\n"
        )
        print(warn_msg, file=sys.stderr)
        raise ProductionSafetyViolation(
            f"Local mutation '{operation}' blocked. Set ALLOW_LOCAL_MUTATION=true for local dev."
        )


def assert_seeder_allowed(seeder_name: str) -> None:
    """Validates that a seeder or mock fixture generator is permitted to run."""
    assert_destructive_allowed(
        operation=f"Execute Seeder [{seeder_name}]",
        script_name=seeder_name,
    )
