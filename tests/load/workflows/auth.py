"""
Medi-Caps Competitive Programming Platform — Authentication Workflow
Simulates student OTP login, onboarding verification, and profile retrieval.
"""

from __future__ import annotations

import logging
from typing import Dict, Any, Optional

from tests.load.clients.api_client import StudentApiClient
from tests.load.assertions.response_checks import (
    assert_status_code,
    assert_required_fields,
    LoadTestAssertionError,
    FailureCategory,
)

logger = logging.getLogger("ccc.loadtest.auth")


def login_student(client: StudentApiClient) -> Dict[str, Any]:
    """
    Execute full institutional authentication:
    1. POST /api/auth/send-otp
    2. POST /api/auth/verify-otp
    3. If new user, complete onboarding
    """
    account = client.account
    email = account.email
    otp = account.default_otp

    # Step 1: Request OTP
    try:
        otp_req_resp = client.post(
            path="/api/auth/send-otp",
            name="/api/auth/send-otp",
            json_data={"email": email},
            workflow="auth",
            expected_status=[200, 429],
        )
    except Exception as exc:
        # In case rate limit or already generated in test suite
        logger.debug("send-otp note for %s: %s", email, exc)

    # Step 2: Verify OTP
    verify_resp = client.post(
        path="/api/auth/verify-otp",
        name="/api/auth/verify-otp",
        json_data={"email": email, "otp": otp},
        workflow="auth",
        expected_status=[200],
    )

    assert_required_fields(verify_resp, ["access_token", "token_type"], context="verify-otp")
    token = verify_resp["access_token"]
    client.set_token(token)

    # Record member ID if returned
    if "member" in verify_resp and isinstance(verify_resp["member"], dict):
        account.member_id = verify_resp["member"].get("id")

    # Step 3: Complete onboarding if account is new or not onboarded
    is_new = verify_resp.get("is_new_user", False)
    if is_new or (verify_resp.get("member") and not verify_resp["member"].get("is_onboarded", True)):
        try:
            client.post(
                path="/api/auth/complete-onboarding",
                name="/api/auth/complete-onboarding",
                json_data={
                    "handle": account.handle,
                    "full_name": account.full_name,
                },
                workflow="auth",
                expected_status=[200, 409],  # 409 if handle already exists
            )
        except Exception as exc:
            logger.debug("complete-onboarding exception: %s", exc)

    return verify_resp


def get_current_user_profile(client: StudentApiClient) -> Dict[str, Any]:
    """Retrieve own authenticated member profile."""
    profile = client.get(
        path="/api/auth/me",
        name="/api/auth/me",
        workflow="auth",
        expected_status=[200],
    )
    assert_required_fields(profile, ["email"], context="get_me")
    return profile


def logout_student(client: StudentApiClient) -> None:
    """Safely terminate student session and revoke tokens."""
    try:
        client.post(
            path="/api/auth/logout",
            name="/api/auth/logout",
            workflow="auth",
            expected_status=[200],
        )
    finally:
        client.clear_token()
