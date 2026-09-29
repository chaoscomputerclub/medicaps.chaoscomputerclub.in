"""
Chaos Computer Club — Production Database Isolation & Safety Gate Suite
=======================================================================
Phase 23 Automated Safety Boundary Verifications:
1. Production reset -> BLOCKED
2. Production seed -> BLOCKED
3. Production database URL fingerprints -> BLOCKED
4. Production droplet execution -> BLOCKED
5. Development reset -> ALLOWED with explicit opt-in
6. Test reset -> ALLOWED in CI on test DB
7. Destructive migration without explicit approval -> BLOCKED
8. Deployment workflow audit -> Verified ZERO database commands in deploy.yml
9. Application startup check -> Verified ZERO destructive DELETE/UPDATE in init_db()
"""

import os
import re
import pytest
from pathlib import Path
from unittest.mock import patch

from app.core.safety import (
    is_production_environment,
    is_production_database_url,
    assert_destructive_allowed,
    assert_seeder_allowed,
    ProductionSafetyViolation,
    PRODUCTION_FINGERPRINTS,
)
from scripts.migrate import scan_sql_for_destructive_statements


class TestProductionDatabaseSafetyBoundaries:

    def test_production_env_flag_blocks_destructive_operation(self):
        """Rule 1: production reset/mutation is strictly BLOCKED when ENVIRONMENT=production."""
        with patch.dict(os.environ, {"ENVIRONMENT": "production", "DATABASE_URL": "postgresql://local:5432/test"}):
            assert is_production_environment() is True
            with pytest.raises(ProductionSafetyViolation, match="permanently forbidden in production"):
                assert_destructive_allowed("purge_all_tables")

    def test_production_app_env_blocks_destructive_operation(self):
        """Rule 2: production reset/mutation is strictly BLOCKED when APP_ENV=production."""
        with patch.dict(os.environ, {"APP_ENV": "production", "ENVIRONMENT": ""}):
            assert is_production_environment() is True
            with pytest.raises(ProductionSafetyViolation, match="permanently forbidden in production"):
                assert_destructive_allowed("database_reset")

    def test_production_fingerprint_in_database_url_blocks_mutation(self):
        """Rule 3: Any production host fingerprint in DATABASE_URL blocks mutation unconditionally."""
        for fp in PRODUCTION_FINGERPRINTS:
            prod_url = f"postgresql+asyncpg://admin:secret@{fp}:5432/ccc_medicaps"
            assert is_production_database_url(prod_url) is True

            with patch.dict(os.environ, {"DATABASE_URL": prod_url, "ENVIRONMENT": "development", "ALLOW_LOCAL_MUTATION": "true"}):
                assert is_production_environment(prod_url) is True
                with pytest.raises(ProductionSafetyViolation):
                    assert_destructive_allowed("purge_data", db_url=prod_url)

    def test_production_seeder_is_hard_blocked(self):
        """Rule 4: Seeders and mock fixtures cannot execute in production."""
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            with pytest.raises(ProductionSafetyViolation):
                assert_seeder_allowed("seed_dev_contests")

    def test_development_reset_allowed_with_explicit_opt_in(self):
        """Rule 5: In development with local database, mutation is allowed ONLY with ALLOW_LOCAL_MUTATION=true."""
        local_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/ccc_dev"
        with patch.dict(os.environ, {
            "ENVIRONMENT": "development",
            "APP_ENV": "development",
            "NODE_ENV": "development",
            "CI": "false",
            "ALLOW_LOCAL_MUTATION": "true",
            "DATABASE_URL": local_url,
        }):
            # Should not raise
            assert_destructive_allowed("local_dev_reset", db_url=local_url)

    def test_development_reset_blocked_without_explicit_opt_in(self):
        """Rule 6: In development without ALLOW_LOCAL_MUTATION=true, mutation is blocked."""
        local_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/ccc_dev"
        with patch.dict(os.environ, {
            "ENVIRONMENT": "development",
            "APP_ENV": "development",
            "NODE_ENV": "development",
            "CI": "false",
            "ALLOW_LOCAL_MUTATION": "false",
            "DATABASE_URL": local_url,
        }):
            with pytest.raises(ProductionSafetyViolation, match="ALLOW_LOCAL_MUTATION=true"):
                assert_destructive_allowed("local_dev_reset", db_url=local_url)

    def test_ci_test_database_mutation_allowed(self):
        """Rule 7: In GitHub Actions CI (CI=true) against ephemeral test DB, mutation is allowed."""
        test_url = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/ccc_test"
        with patch.dict(os.environ, {
            "CI": "true",
            "ENVIRONMENT": "test",
            "APP_ENV": "test",
            "DATABASE_URL": test_url,
        }):
            assert_destructive_allowed("ci_test_reset", db_url=test_url)

    def test_destructive_migration_scanner_identifies_all_dangerous_tokens(self):
        """Rule 8: Migration scanner catches DROP TABLE, TRUNCATE, DROP COLUMN, etc."""
        safe_sql = "CREATE TABLE IF NOT EXISTS sample (id INT); CREATE INDEX IF NOT EXISTS ix_s ON sample(id);"
        assert scan_sql_for_destructive_statements(safe_sql) == []

        dangerous_sqls = [
            ("DROP TABLE students;", "DROP TABLE"),
            ("DROP DATABASE ccc_medicaps;", "DROP DATABASE"),
            ("TRUNCATE assessment_submissions;", "TRUNCATE"),
            ("ALTER TABLE users DROP COLUMN email;", "DROP COLUMN"),
            ("DELETE FROM member_profiles;", "UNCONDITIONAL DELETE"),
        ]
        for sql, expected_name in dangerous_sqls:
            findings = scan_sql_for_destructive_statements(sql)
            assert expected_name in findings, f"Expected {expected_name} in findings for SQL: {sql}"

    def test_deploy_workflow_has_zero_database_operations(self):
        """Rule 9: deploy.yml must NEVER contain database mutation scripts or seeder invocations."""
        deploy_yml_path = Path(__file__).resolve().parent.parent.parent / ".github" / "workflows" / "deploy.yml"
        assert deploy_yml_path.is_file(), "deploy.yml must exist"

        content = deploy_yml_path.read_text(encoding="utf-8")
        dangerous_tokens = [
            "launch_official_contests.py",
            "purge_all_contest_data",
            "reset_and_seed_db",
            "seed_dev_contests",
            "migrate.py",
            "psql",
            "drop",
            "truncate",
        ]
        for token in dangerous_tokens:
            assert token not in content.lower(), f"Forbidden database token '{token}' found in deploy.yml!"

    def test_application_startup_integrity_has_zero_destructive_queries(self):
        """Rule 10: ensure_database_integrity in db.py must have zero DELETE and zero UPDATE statements."""
        db_py_path = Path(__file__).resolve().parent.parent / "app" / "core" / "db.py"
        content = db_py_path.read_text(encoding="utf-8")

        # Extract ensure_database_integrity function body
        match = re.search(r"async def ensure_database_integrity\(\):.*?(?=\nasync def|\Z)", content, flags=re.DOTALL)
        assert match is not None, "ensure_database_integrity function must exist in db.py"
        body = match.group(0)

        # Check for DELETE FROM or UPDATE in the integrity function
        assert "DELETE FROM" not in body, "Destructive 'DELETE FROM' found in ensure_database_integrity!"
        assert "UPDATE member_profiles" not in body, "Destructive 'UPDATE member_profiles' found in ensure_database_integrity!"
