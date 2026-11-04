"""
Chaos Computer Club — Global Platform Transformation Test Suite
Tests for:
- Identity decoupling: personal & work email registration
- Domain auto-association with organization workspaces
- Organization discovery and querying endpoints
- Versioned platform statutory policies and user consent ledger
- Contest visibility (public vs organization_private) and rules acceptance gate
- Admin platform settings and immutable audit trails
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from main import app
from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.core.security import create_access_token
from app.models.db_models import (
    MemberProfile,
    OfflineContest,
    Organization,
    OrganizationDomain,
    OrganizationMembership,
    PlatformPolicy,
    UserConsent,
    now_utc,
)
from app.schemas.auth import SendOTPRequest
from app.modules.auth.otp_service import is_allowed_organization_email
from fastapi import HTTPException


@pytest_asyncio.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def setup_test_cadets():
    """Create test members for open, campus, and admin roles."""
    async with AsyncSessionLocal() as db:
        # Open cadet (gmail)
        res1 = await db.execute(select(MemberProfile).where(MemberProfile.email == "open_cadet_test@gmail.com"))
        open_user = res1.scalar_one_or_none()
        if not open_user:
            open_user = MemberProfile(
                id="mem-open-test-uuid",
                email="open_cadet_test@gmail.com",
                handle="open_cadet",
                full_name="Open Cadet",
                role="STUDENT",
                platform_role="USER",
                is_onboarded=True,
            )
            db.add(open_user)

        # Campus cadet (medicaps)
        res2 = await db.execute(select(MemberProfile).where(MemberProfile.email == "campus_cadet_test@medicaps.ac.in"))
        campus_user = res2.scalar_one_or_none()
        if not campus_user:
            campus_user = MemberProfile(
                id="mem-campus-test-uuid",
                email="campus_cadet_test@medicaps.ac.in",
                handle="campus_cadet",
                full_name="Campus Cadet",
                role="STUDENT",
                platform_role="USER",
                is_onboarded=True,
            )
            db.add(campus_user)

        # Admin user
        res3 = await db.execute(select(MemberProfile).where(MemberProfile.email == "platform_admin_test@chaos.org"))
        admin_user = res3.scalar_one_or_none()
        if not admin_user:
            admin_user = MemberProfile(
                id="mem-admin-test-uuid",
                email="platform_admin_test@chaos.org",
                handle="admin_cadet",
                full_name="Admin Cadet",
                role="ADMIN",
                platform_role="PLATFORM_ADMIN",
                is_onboarded=True,
            )
            db.add(admin_user)

        await db.commit()
        await db.refresh(open_user)
        await db.refresh(campus_user)
        await db.refresh(admin_user)

    return {
        "open_user": open_user,
        "campus_user": campus_user,
        "admin_user": admin_user,
    }


# ── 1. Email Normalization & Global Identity Tests ─────────────────────────────

def test_global_email_normalization_allows_personal_emails():
    """Verify personal and external emails are valid when strict domain is disabled."""
    saved_flag = settings.ENFORCE_STRICT_EMAIL_DOMAIN
    try:
        settings.ENFORCE_STRICT_EMAIL_DOMAIN = False
        assert normalise_email("cadet.alice@gmail.com") == "cadet.alice@gmail.com"
        assert normalise_email("engineer@chaoscomputerclub.in") == "engineer@chaoscomputerclub.in"
        assert normalise_email("student@medicaps.ac.in") == "student@medicaps.ac.in"
    finally:
        settings.ENFORCE_STRICT_EMAIL_DOMAIN = saved_flag


def test_global_email_normalization_respects_strict_flag_if_enabled():
    """Verify strict mode rejects non-organization email if toggled on."""
    saved_flag = settings.ENFORCE_STRICT_EMAIL_DOMAIN
    try:
        settings.ENFORCE_STRICT_EMAIL_DOMAIN = True
        with pytest.raises(HTTPException) as exc_info:
            normalise_email("hacker@external.com")
        assert exc_info.value.status_code == 403
    finally:
        settings.ENFORCE_STRICT_EMAIL_DOMAIN = saved_flag


# ── 2. Organizations API & Discovery Tests ────────────────────────────────────

@pytest.mark.asyncio
async def test_list_organizations_endpoint(async_client: AsyncClient):
    """Verify GET /api/organizations returns verified organizations."""
    resp = await async_client.get("/api/organizations")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert any(org["slug"] == "medicaps-university" for org in data)


@pytest.mark.asyncio
async def test_get_organization_by_slug(async_client: AsyncClient):
    """Verify GET /api/organizations/{slug} retrieves workspace details."""
    resp = await async_client.get("/api/organizations/medicaps-university")
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == "medicaps-university"
    assert data["is_verified"] is True

    # Non-existent organization
    resp_404 = await async_client.get("/api/organizations/non-existent-org-404")
    assert resp_404.status_code == 404


# ── 3. Versioned Statutory Policies & Consent Ledger Tests ────────────────────

@pytest.mark.asyncio
async def test_policies_list_and_detail(async_client: AsyncClient):
    """Verify policies are listed and individual markdown text is accessible."""
    resp = await async_client.get("/api/policies")
    assert resp.status_code == 200
    policies = resp.json()
    types = [p["policy_type"] for p in policies]
    assert "TERMS_OF_SERVICE" in types
    assert "PRIVACY_POLICY" in types
    assert "CONTEST_RULES" in types
    assert "CODE_OF_CONDUCT" in types
    assert "ACCEPTABLE_USE" in types

    # Detail fetch
    resp_tos = await async_client.get("/api/policies/TERMS_OF_SERVICE")
    assert resp_tos.status_code == 200
    tos_data = resp_tos.json()
    assert tos_data["version"] == "1.0.0"
    assert len(tos_data["content"]) > 50


@pytest.mark.asyncio
async def test_user_consent_recording(async_client: AsyncClient, setup_test_cadets):
    """Verify user can accept policy and audit consent is recorded."""
    open_user = setup_test_cadets["open_user"]
    token = create_access_token(open_user.id)
    headers = {"Authorization": f"Bearer {token}"}

    # Accept Terms of Service
    accept_resp = await async_client.post(
        "/api/policies/accept",
        json={"policy_type": "TERMS_OF_SERVICE", "version": "1.0.0", "source": "MODAL_PROMPT"},
        headers=headers,
    )
    assert accept_resp.status_code == 200
    assert accept_resp.json()["status"] == "recorded"

    # Query personal consent ledger
    me_resp = await async_client.get("/api/policies/me/consents", headers=headers)
    assert me_resp.status_code == 200
    consents = me_resp.json()
    assert any(c["policy_type"] == "TERMS_OF_SERVICE" for c in consents)


# ── 4. Contest Visibility & Registration Rules Gate Tests ──────────────────────

@pytest.mark.asyncio
async def test_contest_rules_version_acceptance(async_client: AsyncClient, setup_test_cadets):
    """Verify contest registration enforces rules version matching and logs consent."""
    async with AsyncSessionLocal() as db:
        # Create a test contest with rules_version 1.0.0
        stmt = select(OfflineContest).where(OfflineContest.slug == "test-global-rules-contest")
        res = await db.execute(stmt)
        c = res.scalar_one_or_none()
        if not c:
            c = OfflineContest(
                id="c-test-global-rules",
                slug="test-global-rules-contest",
                title="Global Rules Test Contest",
                description="Test contest for rules acceptance",
                status="upcoming",
                visibility="public",
                rules_version="1.0.0",
                seat_capacity=50,
                registered_count=0,
                start_time=now_utc(),
                end_time=now_utc(),
            )
            db.add(c)
            await db.commit()

    open_user = setup_test_cadets["open_user"]
    token = create_access_token(open_user.id)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Mismatched rules version fails with 400
    bad_reg_resp = await async_client.post(
        "/api/contests/test-global-rules-contest/register",
        json={"rules_version_accepted": "0.9.0"},
        headers=headers,
    )
    assert bad_reg_resp.status_code == 400
    assert "version mismatch" in bad_reg_resp.json()["detail"].lower()

    # 2. Correct rules version succeeds and logs consent
    good_reg_resp = await async_client.post(
        "/api/contests/test-global-rules-contest/register",
        json={"rules_version_accepted": "1.0.0"},
        headers=headers,
    )
    assert good_reg_resp.status_code == 200
    assert good_reg_resp.json()["registered"] is True

    # 3. Verify consent was recorded in user_consents table
    async with AsyncSessionLocal() as db:
        stmt_c = select(UserConsent).where(
            UserConsent.member_id == open_user.id,
            UserConsent.policy_type == "CONTEST_RULES",
            UserConsent.version == "1.0.0",
        )
        res_c = await db.execute(stmt_c)
        assert res_c.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_organization_private_contest_gate(async_client: AsyncClient, setup_test_cadets):
    """Verify organization_private contests forbid access to non-members."""
    async with AsyncSessionLocal() as db:
        stmt = select(OfflineContest).where(OfflineContest.slug == "test-medicaps-private-contest")
        res = await db.execute(stmt)
        c = res.scalar_one_or_none()
        if not c:
            c = OfflineContest(
                id="c-test-medicaps-private",
                slug="test-medicaps-private-contest",
                title="Medi-Caps Private Contest",
                description="Private campus contest",
                status="upcoming",
                visibility="organization_private",
                organization_id="org-medicaps-university-default",
                rules_version="1.0.0",
                seat_capacity=50,
                registered_count=0,
                start_time=now_utc(),
                end_time=now_utc(),
            )
            db.add(c)
            await db.commit()

    # Open user (gmail) is not in medicaps organization -> 403 Forbidden
    open_user = setup_test_cadets["open_user"]
    token = create_access_token(open_user.id)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await async_client.post(
        "/api/contests/test-medicaps-private-contest/register",
        json={"rules_version_accepted": "1.0.0"},
        headers=headers,
    )
    assert resp.status_code == 403
    assert "restricted to members" in resp.json()["detail"].lower()


# ── 5. Admin Settings & Audit Ledger Tests ────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_settings_rbac_and_audit(async_client: AsyncClient, setup_test_cadets):
    """Verify admin settings require elevated platform permissions and track audits."""
    open_user = setup_test_cadets["open_user"]
    admin_user = setup_test_cadets["admin_user"]

    open_token = create_access_token(open_user.id)
    admin_token = create_access_token(admin_user.id)

    # 1. Non-admin gets 403
    resp_forbidden = await async_client.get(
        "/api/admin/settings",
        headers={"Authorization": f"Bearer {open_token}"},
    )
    assert resp_forbidden.status_code == 403

    # 2. Admin gets 200
    resp_admin = await async_client.get(
        "/api/admin/settings",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_admin.status_code == 200
    settings_dict = resp_admin.json()
    assert "PLATFORM_IDENTITY" in settings_dict

    # 3. Admin updates setting -> audit recorded
    update_resp = await async_client.put(
        "/api/admin/settings/PLATFORM_IDENTITY",
        json={"value_json": {"platform_name": "Chaos Computer Club Arena", "brand_mode": "GLOBAL"}},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert update_resp.status_code == 200

    # 4. Check audit log
    audit_resp = await async_client.get(
        "/api/admin/settings/audit?key=PLATFORM_IDENTITY",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert audit_resp.status_code == 200
    audits = audit_resp.json()
    assert len(audits) >= 1
    assert audits[0]["setting_key"] == "PLATFORM_IDENTITY"
