"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/security/test_auth_boundaries.py — Authentication, Authorization & Security Invariants

Linked Bugs: REG-0008, REG-0031
Invariant: AUTHENTICATED_SESSIONS_MUST_BE_HARDENED_AGAINST_EXCLUSION_AND_LEAKS
"""

import pytest
import os
from pathlib import Path


@pytest.mark.regression("REG-0031")
def test_role_based_access_control_hierarchy():
    """
    REG-0031 Invariant:
    A student cadet role must NEVER be permitted to perform administrative
    actions such as modifying contest dates, adding problems, or promoting users.
    """
    role_permissions = {
        "admin": {"view_public", "submit_solution", "manage_contests", "manage_problems", "manage_users"},
        "chief_proctor": {"view_public", "submit_solution", "manage_contests", "view_proctor_telemetry"},
        "student": {"view_public", "submit_solution", "view_my_submissions"},
    }

    def check_permission(role: str, action: str) -> bool:
        allowed = role_permissions.get(role, set())
        return action in allowed

    # Student checks
    assert check_permission("student", "view_public") is True
    assert check_permission("student", "submit_solution") is True
    assert check_permission("student", "manage_contests") is False
    assert check_permission("student", "manage_problems") is False
    assert check_permission("student", "manage_users") is False

    # Chief Proctor checks
    assert check_permission("chief_proctor", "manage_contests") is True
    assert check_permission("chief_proctor", "manage_users") is False

    # Admin checks
    assert check_permission("admin", "manage_users") is True


@pytest.mark.regression("REG-0008")
def test_path_traversal_sanitization():
    """
    REG-0008 Invariant:
    File paths for problem descriptions, testcases, or artifact downloads must be
    sanitized to ensure they cannot escape the designated base directory.
    """
    base_dir = "/var/ccc/problems"

    def resolve_safe_path(base: str, user_input: str) -> str:
        # Prevent null bytes
        if "\0" in user_input:
            raise ValueError("Null byte in path")
        # Resolve normalized target path
        clean_base = os.path.abspath(base)
        target = os.path.abspath(os.path.join(clean_base, user_input))
        # Invariant: Must remain under base_dir hierarchy
        if os.path.commonpath([clean_base, target]) != clean_base:
            raise PermissionError(f"Path traversal detected: {user_input}")
        return target

    # Normal valid path
    valid_path = resolve_safe_path(base_dir, "problem_1/tc_01.in")
    assert valid_path == os.path.abspath("/var/ccc/problems/problem_1/tc_01.in")

    # Path traversal attack attempts
    with pytest.raises(PermissionError):
        resolve_safe_path(base_dir, "../../../etc/passwd")

    with pytest.raises(PermissionError):
        resolve_safe_path(base_dir, "problem_1/../../../../root/.ssh/id_rsa")

    with pytest.raises(ValueError):
        resolve_safe_path(base_dir, "problem_1/test\0.in")
