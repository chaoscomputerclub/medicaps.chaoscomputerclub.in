"""
Chaos Computer Club — Production Controlled Database Migration Engine
=====================================================================
Strictly separates application deployment from schema migrations.

Guarantees (Under GSD Protocol & Production Safety Directives):
1. Migrations are versioned, sequential, and idempotent.
2. Destructive SQL Scanner:
   Detects DROP TABLE, DROP DATABASE, TRUNCATE, DROP COLUMN, and unconditional DELETE.
   Refuses to execute destructive migrations unless explicitly authorized with:
     --allow-destructive
     --confirm-destructive <version>
3. Automated Pre-Migration Backup Verification:
   In production, automatically invokes db_backup.py to take and verify a point-in-time
   snapshot before executing any DDL. If backup verification fails, migration HALTS immediately.
4. Auditable migration history stored in 'schema_migrations' table.
"""

import argparse
import asyncio
import datetime
import hashlib
import os
import re
import sys
import time
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.core.config import settings
from app.core.db import AsyncSessionLocal, engine
from app.core.safety import is_production_environment, is_production_database_url
from scripts.db_backup import create_backup

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"

# Destructive SQL pattern scanner regexes
DESTRUCTIVE_PATTERNS = [
    (r"\bDROP\s+TABLE\b", "DROP TABLE"),
    (r"\bDROP\s+DATABASE\b", "DROP DATABASE"),
    (r"\bTRUNCATE\b", "TRUNCATE"),
    (r"\bDROP\s+COLUMN\b", "DROP COLUMN"),
    (r"\bDELETE\s+FROM\b\s+[^;]+(?!\bWHERE\b)", "UNCONDITIONAL DELETE"),
]


def scan_sql_for_destructive_statements(sql_text: str) -> List[str]:
    """Scans SQL file content for destructive patterns."""
    findings = []
    # Strip comments to avoid false positives
    cleaned = re.sub(r"--.*$", "", sql_text, flags=re.MULTILINE)
    cleaned = re.sub(r"/\*.*?\*/", "", cleaned, flags=re.DOTALL)

    for pattern, name in DESTRUCTIVE_PATTERNS:
        if re.search(pattern, cleaned, flags=re.IGNORECASE):
            findings.append(name)
    return findings


async def ensure_migration_table():
    """Ensure the schema_migrations tracking table exists."""
    async with AsyncSessionLocal() as session:
        await session.execute(text("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(64) PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                checksum VARCHAR(64) NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                execution_time_ms INTEGER NOT NULL,
                destructive BOOLEAN NOT NULL DEFAULT FALSE,
                applied_by VARCHAR(120) NOT NULL DEFAULT 'system'
            );
        """))
        await session.commit()


async def get_applied_migrations() -> Dict[str, Dict[str, Any]]:
    """Returns all applied migrations from the database."""
    await ensure_migration_table()
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT version, filename, checksum, applied_at, execution_time_ms 
            FROM schema_migrations ORDER BY version ASC;
        """))
        rows = res.fetchall()
        return {
            row[0]: {
                "version": row[0],
                "filename": row[1],
                "checksum": row[2],
                "applied_at": row[3].isoformat() if row[3] else None,
                "execution_time_ms": row[4],
            }
            for row in rows
        }


def get_available_migrations() -> List[Path]:
    """Returns sorted list of migration files (.sql)."""
    if not MIGRATIONS_DIR.exists():
        MIGRATIONS_DIR.mkdir(parents=True, exist_ok=True)
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


async def apply_migration(
    migration_file: Path,
    allow_destructive: bool = False,
    confirm_destructive: str = "",
    dry_run: bool = False,
) -> bool:
    """Applies a single migration file with strict security controls."""
    version = migration_file.stem
    sql_content = migration_file.read_text(encoding="utf-8")
    checksum = hashlib.sha256(sql_content.encode("utf-8")).hexdigest()

    # ── DESTRUCTIVE PATTERN ANALYSIS ──────────────────────────────────────────
    destructive_findings = scan_sql_for_destructive_statements(sql_content)
    is_destructive = len(destructive_findings) > 0

    if is_destructive:
        print(f"\n⚠️  [MIGRATION SCANNER] Destructive patterns detected in '{migration_file.name}':")
        for finding in destructive_findings:
            print(f"    - {finding}")

        if not allow_destructive or confirm_destructive != version:
            print(
                f"\n{'=' * 78}\n"
                f"  🚨  MIGRATION HALTED — DESTRUCTIVE OPERATION REJECTED\n"
                f"{'=' * 78}\n"
                f"  Migration      : {migration_file.name}\n"
                f"  Detected Rules : {', '.join(destructive_findings)}\n"
                f"  Safety Policy  : Destructive migrations cannot execute without explicit authorization.\n"
                f"  Required Flags : --allow-destructive --confirm-destructive {version}\n"
                f"{'=' * 78}\n",
                file=sys.stderr,
            )
            return False

    if dry_run:
        print(f"🔍 [DRY RUN] Would execute migration: {migration_file.name} (Destructive: {is_destructive})")
        return True

    # ── PRODUCTION PRE-MIGRATION BACKUP ────────────────────────────────────────
    is_prod = is_production_environment(settings.DATABASE_URL) or is_production_database_url(settings.DATABASE_URL)
    if is_prod:
        print(f"\n🛡️ [PRE-MIGRATION BACKUP] Creating verified snapshot before applying {migration_file.name}...")
        backup_ok, backup_meta = create_backup(settings.DATABASE_URL, backup_tag=f"pre_mig_{version}")
        if not backup_ok:
            print(f"❌ [MIGRATION HALTED] Pre-migration backup failed: {backup_meta.get('error')}", file=sys.stderr)
            return False
        print(f"   ✓ Backup verified: {backup_meta.get('filename')} ({backup_meta.get('size_kb')} KB)")

    # ── EXECUTE MIGRATION TRANSACTION ─────────────────────────────────────────
    print(f"🚀 [APPLYING] {migration_file.name}...")
    t0 = time.perf_counter()

    async with AsyncSessionLocal() as session:
        try:
            # Execute migration SQL script
            for statement in sql_content.split(";"):
                stmt_clean = statement.strip()
                if stmt_clean:
                    await session.execute(text(stmt_clean))

            duration_ms = int((time.perf_counter() - t0) * 1000)

            # Record in schema_migrations
            await session.execute(
                text("""
                    INSERT INTO schema_migrations (version, filename, checksum, execution_time_ms, destructive, applied_by)
                    VALUES (:version, :filename, :checksum, :execution_time_ms, :destructive, :applied_by)
                """),
                {
                    "version": version,
                    "filename": migration_file.name,
                    "checksum": checksum,
                    "execution_time_ms": duration_ms,
                    "destructive": is_destructive,
                    "applied_by": os.environ.get("USER", "system"),
                }
            )
            await session.commit()
            print(f"✅ [MIGRATION SUCCESS] Applied {migration_file.name} in {duration_ms}ms.")
            return True

        except Exception as e:
            await session.rollback()
            print(f"❌ [MIGRATION FAILED] Error executing {migration_file.name}: {e}", file=sys.stderr)
            return False


async def run_migrations(
    target_version: Optional[str] = None,
    allow_destructive: bool = False,
    confirm_destructive: str = "",
    dry_run: bool = False,
    status_only: bool = False,
) -> bool:
    applied = await get_applied_migrations()
    available = get_available_migrations()

    print(f"\n{'=' * 78}")
    print("  ⚡ CHAOS COMPUTER CLUB — CONTROLLED DATABASE MIGRATIONS")
    print(f"{'=' * 78}")
    print(f"  Target DB      : {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else 'local'}")
    print(f"  Available Files: {len(available)}")
    print(f"  Applied Count  : {len(applied)}")
    print(f"{'=' * 78}\n")

    if status_only:
        for f in available:
            v = f.stem
            st = "✅ APPLIED" if v in applied else "⏳ PENDING"
            extra = f"({applied[v]['applied_at']})" if v in applied else ""
            print(f"  [{st}] {f.name} {extra}")
        return True

    pending = [f for f in available if f.stem not in applied]
    if not pending:
        print("✨ Database schema is 100% up to date. No pending migrations.")
        return True

    for migration_file in pending:
        if target_version and migration_file.stem != target_version:
            continue

        ok = await apply_migration(
            migration_file=migration_file,
            allow_destructive=allow_destructive,
            confirm_destructive=confirm_destructive,
            dry_run=dry_run,
        )
        if not ok:
            print("\n🛑 Migration pipeline stopped on failure.")
            return False

    print("\n🎉 All migrations completed successfully.")
    return True


def main():
    parser = argparse.ArgumentParser(description="Chaos Computer Club Controlled Database Migration Runner")
    parser.add_argument("--status", action="store_true", help="Display migration status table")
    parser.add_argument("--dry-run", action="store_true", help="Inspect what would be applied without modifying database")
    parser.add_argument("--version", default=None, help="Apply only a specific migration version")
    parser.add_argument("--allow-destructive", action="store_true", help="Explicitly permit destructive operations")
    parser.add_argument("--confirm-destructive", default="", help="Confirm destructive migration version name")
    args = parser.parse_args()

    success = asyncio.run(run_migrations(
        target_version=args.version,
        allow_destructive=args.allow_destructive,
        confirm_destructive=args.confirm_destructive,
        dry_run=args.dry_run,
        status_only=args.status,
    ))

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
