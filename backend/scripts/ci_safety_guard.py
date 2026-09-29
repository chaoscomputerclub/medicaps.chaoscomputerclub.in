"""
Chaos Computer Club — CI Safety Guard
======================================
MUST be imported at the top of every data-mutating test script.

Enforces that the script only runs:
  1. Inside a GitHub Actions runner (CI=true), OR
  2. When the caller explicitly opts in with ALLOW_LOCAL_MUTATION=true

If the DATABASE_URL points to any known production host, execution is
hard-blocked regardless of the above flags to prevent accidental data loss.

Usage:
    # At the very top of every mutation script, before any app imports:
    import sys, os
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from scripts.ci_safety_guard import assert_safe_to_run
    assert_safe_to_run(__file__)
"""

import os
import sys
import socket
from pathlib import Path

# Known production hostnames / IP fragments — extend as needed
_PRODUCTION_FINGERPRINTS = [
    "143.198.38.205",             # DigitalOcean production droplet IP
    "medicaps-api.",              # production API subdomain
    "medicaps.chaoscomputerclub", # production domain
    "chaoscomputerclub.in",       # root organization domain
    "prod.internal",              # internal prod label
]

# Paths and signatures that only exist on the live DigitalOcean production droplet
_PRODUCTION_DROPLET_PATHS = [
    "/root/projects/ccc-medicaps-api",
    "/var/www/ccc-medicaps",
    "/var/www/ccc-medicaps-admin",
]


def _is_ci() -> bool:
    """GitHub Actions sets CI=true automatically."""
    return os.environ.get("CI", "").lower() in ("true", "1", "yes")


def _is_local_opt_in() -> bool:
    """Developer explicitly accepts responsibility for local mutation."""
    return os.environ.get("ALLOW_LOCAL_MUTATION", "").lower() in ("true", "1", "yes")


def _read_env_file_for_db_url() -> str:
    """Attempt to parse DATABASE_URL from .env if not present in os.environ."""
    candidates = [
        Path(__file__).resolve().parent.parent / ".env",
        Path.cwd() / ".env",
        Path.cwd() / "backend" / ".env",
    ]
    for p in candidates:
        if p.is_file():
            try:
                for line in p.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line.startswith("DATABASE_URL=") and not line.startswith("#"):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
            except Exception:
                pass
    return ""


def _database_url() -> str:
    return os.environ.get("DATABASE_URL") or _read_env_file_for_db_url()


def _is_production_database() -> bool:
    db = _database_url().lower()
    return any(fp in db for fp in _PRODUCTION_FINGERPRINTS)


def _is_running_on_production_droplet() -> bool:
    """Detect if this script is executing on the live production Linux host."""
    # 1. Check known production filesystem directories
    for path_str in _PRODUCTION_DROPLET_PATHS:
        if os.path.exists(path_str):
            return True

    # 2. Check hostname patterns
    try:
        hostname = socket.gethostname().lower()
        if "medicaps" in hostname and not _is_ci():
            return True
    except Exception:
        pass

    # 3. Explicit production environment flags
    env_name = os.environ.get("ENVIRONMENT", "").lower() or os.environ.get("ENV", "").lower()
    if env_name in ("production", "prod"):
        return True

    return False


def _argv_contains_production() -> bool:
    """Scan command line arguments (e.g., --url) for production targets."""
    for arg in sys.argv[1:]:
        arg_lower = arg.lower()
        if any(fp in arg_lower for fp in _PRODUCTION_FINGERPRINTS):
            return True
    return False


def assert_safe_to_run(script_path: str) -> None:
    """
    Hard-abort unless the execution context is safe.

    Raises SystemExit(1) with a clear error message if the guard fails.
    Never raises; always exits — so missing try/except won't bypass it.
    """
    script_name = os.path.basename(script_path)
    db_url = _database_url()

    # ── HARD BLOCK 1: Running directly on production droplet host ─────────────
    if _is_running_on_production_droplet():
        print(
            f"\n{'=' * 72}\n"
            f"  🚨  PRODUCTION SAFETY GUARD — EXECUTION BLOCKED ON LIVE HOST\n"
            f"{'=' * 72}\n"
            f"  Script   : {script_name}\n"
            f"  Reason   : Detected live DigitalOcean production droplet host environment.\n"
            f"  Action   : Test and data-mutation scripts are STRICTLY FORBIDDEN from\n"
            f"             running on the live production server.\n"
            f"{'=' * 72}\n",
            file=sys.stderr,
        )
        sys.exit(1)

    # ── HARD BLOCK 2: Argument contains production domain / IP ─────────────────
    if _argv_contains_production():
        print(
            f"\n{'=' * 72}\n"
            f"  🚨  PRODUCTION SAFETY GUARD — TARGET URL BLOCKED\n"
            f"{'=' * 72}\n"
            f"  Script   : {script_name}\n"
            f"  Reason   : Command-line arguments target a production domain or IP.\n"
            f"  Arguments: {' '.join(sys.argv[1:])}\n"
            f"{'=' * 72}\n",
            file=sys.stderr,
        )
        sys.exit(1)

    # ── HARD BLOCK 3: production database fingerprint detected ──────────────────
    if _is_production_database():
        print(
            f"\n{'=' * 72}\n"
            f"  🚨  PRODUCTION SAFETY GUARD — DATABASE URL BLOCKED\n"
            f"{'=' * 72}\n"
            f"  Script   : {script_name}\n"
            f"  Reason   : DATABASE_URL contains a production host fingerprint.\n"
            f"  URL      : {db_url}\n\n"
            f"  This script mutates database state (creates/deletes rows).\n"
            f"  Running it against a production database will cause DATA LOSS.\n\n"
            f"  To run locally against a safe test database, set:\n"
            f"    export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/ccc_test\n"
            f"    export ALLOW_LOCAL_MUTATION=true\n"
            f"{'=' * 72}\n",
            file=sys.stderr,
        )
        sys.exit(1)

    # ── SOFT BLOCK: not CI and not opt-in ─────────────────────────────────────
    if not _is_ci() and not _is_local_opt_in():
        print(
            f"\n{'=' * 72}\n"
            f"  ⚠️   LOCAL MUTATION GUARD — EXECUTION BLOCKED\n"
            f"{'=' * 72}\n"
            f"  Script   : {script_name}\n"
            f"  Reason   : This script creates, mutates, and deletes real database\n"
            f"             rows. It is NOT safe to run outside a CI environment\n"
            f"             without explicit acknowledgement.\n\n"
            f"  DATABASE_URL: {db_url or '(not set — will use .env)'}\n\n"
            f"  If you understand the risk and want to run against a LOCAL test\n"
            f"  database, set:\n"
            f"    export ALLOW_LOCAL_MUTATION=true\n\n"
            f"  NEVER set this against a database that mirrors production data.\n"
            f"{'=' * 72}\n",
            file=sys.stderr,
        )
        sys.exit(1)

    # ── SAFE: CI or explicit opt-in ───────────────────────────────────────────
    context = "GitHub Actions CI" if _is_ci() else "Local (ALLOW_LOCAL_MUTATION=true)"
    print(f"[ci_safety_guard] ✓ {script_name} — running in {context}")
    print(f"[ci_safety_guard]   DATABASE_URL: {db_url or '(from .env)'}")
