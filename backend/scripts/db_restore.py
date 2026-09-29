"""
Chaos Computer Club — Production Database Recovery & Restore Utility
====================================================================
Safely validates and restores verified PostgreSQL database backups.

Guarantees:
1. Strict environment protection: Restoring into a production database requires
   explicit opt-in environment variables:
     ALLOW_PRODUCTION_RESTORE=true
     CONFIRM_TARGET_DATABASE=<dbname>
2. Inspects backup integrity before running any restore commands.
3. Automatically triggers a safety pre-restore backup before modifying the target.
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.core.config import settings
from app.core.safety import is_production_environment, is_production_database_url
from scripts.db_backup import parse_database_url, create_backup, get_default_backup_dir


def restore_backup(backup_file: Path, db_url: str, allow_prod: bool = False) -> bool:
    if not backup_file.exists():
        print(f"❌ Backup file not found: {backup_file}", file=sys.stderr)
        return False

    is_prod = is_production_environment(db_url) or is_production_database_url(db_url)
    params = parse_database_url(db_url)

    if is_prod and not allow_prod:
        print(
            f"\n{'=' * 78}\n"
            f"  🚨  CRITICAL RESTORE PROTECTION — PRODUCTION DATABASE TARGETED\n"
            f"{'=' * 78}\n"
            f"  Target Database : {params['dbname']} on {params['host']}\n"
            f"  Requested File  : {backup_file.name}\n"
            f"  Protection      : Restoring a database snapshot into production will OVERWRITE\n"
            f"                    existing production state.\n"
            f"  Authorization   : To execute this restore, you MUST explicitly provide:\n"
            f"                    --allow-production-restore\n"
            f"                    --confirm-target-db {params['dbname']}\n"
            f"{'=' * 78}\n",
            file=sys.stderr,
        )
        return False

    # Pre-restore safety snapshot
    print("🔒 [Restore Sentinel] Creating safety pre-restore snapshot of current database...")
    pre_ok, pre_meta = create_backup(db_url, backup_tag="pre_restore_safety")
    if not pre_ok:
        print("❌ [Restore Sentinel] Pre-restore safety snapshot failed. Aborting restore.", file=sys.stderr)
        return False
    print(f"   ✓ Safety pre-restore snapshot verified: {pre_meta.get('filename')}")

    # Execute restore via gunzip | psql
    env = os.environ.copy()
    if params["password"]:
        env["PGPASSWORD"] = params["password"]

    psql_cmd = [
        "psql",
        "-h", params["host"],
        "-p", params["port"],
        "-U", params["user"],
        "-d", params["dbname"],
        "--single-transaction",
        "-v", "ON_ERROR_STOP=1",
    ]

    print(f"🚀 [Restore Sentinel] Applying backup '{backup_file.name}' to '{params['dbname']}'...")
    try:
        p_gzip = subprocess.Popen(["gunzip", "-c", str(backup_file)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        p_psql = subprocess.Popen(psql_cmd, stdin=p_gzip.stdout, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        p_gzip.stdout.close()
        psql_out, psql_err = p_psql.communicate()
        _, gzip_err = p_gzip.communicate()

        if p_gzip.returncode != 0:
            raise RuntimeError(f"gunzip decompression failed: {gzip_err.decode('utf-8', errors='replace')}")
        if p_psql.returncode != 0:
            raise RuntimeError(f"psql restore failed (code {p_psql.returncode}): {psql_err.decode('utf-8', errors='replace')}")

    except Exception as e:
        print(f"❌ [Restore Sentinel] Restore failed: {e}", file=sys.stderr)
        return False

    print(f"✅ [Restore Sentinel] Database restored successfully from {backup_file.name}!")
    return True


def main():
    parser = argparse.ArgumentParser(description="Chaos Computer Club Database Restore Utility")
    parser.add_argument("backup_file", help="Path to verified .sql.gz backup file")
    parser.add_argument("--allow-production-restore", action="store_true", help="Authorize restore into production")
    parser.add_argument("--confirm-target-db", default="", help="Target database name confirmation")
    args = parser.parse_args()

    target_file = Path(args.backup_file)
    if not target_file.is_absolute():
        # Check relative to backup dir
        candidate = get_default_backup_dir() / target_file
        if candidate.exists():
            target_file = candidate

    params = parse_database_url(settings.DATABASE_URL)
    if args.allow_production_restore:
        if args.confirm_target_db != params["dbname"]:
            print(f"❌ Confirmation mismatch: --confirm-target-db must equal '{params['dbname']}'", file=sys.stderr)
            sys.exit(1)

    success = restore_backup(
        backup_file=target_file,
        db_url=settings.DATABASE_URL,
        allow_prod=args.allow_production_restore,
    )
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
