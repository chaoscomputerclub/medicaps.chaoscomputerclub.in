"""
Chaos Computer Club — Medi-Caps Chapter
app.routers.admin_interview — Admin Domain Training & Blueprint Publishing APIs
Guarded by require_admin_or_core.
Enforces the 8-step training lifecycle:
Create Domain -> Author Blueprint -> Validate Graph -> Generate Dataset -> Evaluate Judge -> Publish.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.middleware.auth import require_admin_or_core
from app.models.member import MemberProfile
from app.models.interview import (
    InterviewDomain,
    InterviewBlueprintModel,
    InterviewBlueprintVersionModel,
    InterviewDomainDataset,
)
from app.schemas.interview import (
    InterviewDomainCreate,
    InterviewDomainResponse,
    AdminBlueprintCreateRequest,
    AdminBlueprintValidateResponse,
    AdminDatasetGenerateResponse,
    AdminJudgeEvaluationResponse,
    AdminBlueprintPublishResponse,
    AdminBlueprintCoverageResponse,
    AdminBlueprintVersionItem,
)
from app.services.interview.blueprint_registry import (
    BlueprintRegistryService,
    BlueprintGraphValidator,
    InterviewBlueprint,
)
from app.services.interview.dataset_harness import DatasetHarnessService

logger = logging.getLogger("ccc.admin.interview")

router = APIRouter(prefix="/admin", tags=["Admin Domain Training"])


# ─── DOMAIN MANAGEMENT ────────────────────────────────────────────────────────

@router.post("/domains", response_model=InterviewDomainResponse, summary="Create interview domain")
async def create_domain(
    payload: InterviewDomainCreate,
    admin: MemberProfile = Depends(require_admin_or_core),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new domain record in the database."""
    existing = (
        await db.execute(select(InterviewDomain).where(InterviewDomain.slug == payload.slug))
    ).scalars().first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Interview domain with slug '{payload.slug}' already exists.",
        )

    domain = InterviewDomain(
        slug=payload.slug,
        name=payload.name,
        description=payload.description,
        category=payload.category,
        icon_key=payload.icon_key,
        display_order=payload.display_order,
        is_active=payload.is_active,
    )
    db.add(domain)
    await db.commit()
    await db.refresh(domain)

    return InterviewDomainResponse(
        id=domain.id,
        slug=domain.slug,
        name=domain.name,
        description=domain.description,
        category=domain.category,
        icon_key=domain.icon_key,
        display_order=domain.display_order,
        is_active=domain.is_active,
        published_blueprints_count=0,
        created_at=domain.created_at.isoformat(),
    )


@router.get("/domains", response_model=List[InterviewDomainResponse], summary="List all interview domains (Admin)")
async def list_admin_domains(
    admin: MemberProfile = Depends(require_admin_or_core),
    db: AsyncSession = Depends(get_db),
):
    """Lists all domains including inactive and draft entries."""
    stmt = select(InterviewDomain).order_by(InterviewDomain.display_order.asc(), InterviewDomain.created_at.asc())
    domains = (await db.execute(stmt)).scalars().all()

    result = []
    for d in domains:
        bp_stmt = select(InterviewBlueprintModel).where(
            InterviewBlueprintModel.domain_id == d.id,
            InterviewBlueprintModel.status == "PUBLISHED",
        )
        pub_count = len((await db.execute(bp_stmt)).scalars().all())
        result.append(
            InterviewDomainResponse(
                id=d.id,
                slug=d.slug,
                name=d.name,
                description=d.description,
                category=d.category,
                icon_key=d.icon_key,
                display_order=d.display_order,
                is_active=d.is_active,
                published_blueprints_count=pub_count,
                created_at=d.created_at.isoformat(),
            )
        )
    return result


# ─── BLUEPRINT AUTHORING & VALIDATION ─────────────────────────────────────────

@router.post("/domains/{slug}/blueprints", response_model=AdminBlueprintVersionItem, summary="Author a domain blueprint draft")
async def author_blueprint(
    slug: str,
    payload: AdminBlueprintCreateRequest,
    admin: MemberProfile = Depends(require_admin_or_core),
    db: AsyncSession = Depends(get_db),
):
    """Authors a draft blueprint version for a domain."""
    domain = (
        await db.execute(select(InterviewDomain).where(InterviewDomain.slug == slug))
    ).scalars().first()

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interview domain '{slug}' not found.",
        )

    # Validate raw payload adheres to Pydantic contract
    try:
        raw_bp_dict = payload.blueprint_data
        raw_bp_dict.setdefault("slug", slug)
        raw_bp_dict.setdefault("title", payload.title)
        raw_bp_dict.setdefault("description", payload.description)
        raw_bp_dict.setdefault("domain", domain.name)
        raw_bp_dict.setdefault("category", domain.category)
        raw_bp_dict.setdefault("version", payload.version)
        parsed_bp = InterviewBlueprint.model_validate(raw_bp_dict)
    except Exception as parse_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Blueprint validation failed: {parse_err}",
        )

    # Find or create blueprint root
    bp_model = (
        await db.execute(select(InterviewBlueprintModel).where(InterviewBlueprintModel.slug == slug))
    ).scalars().first()

    if not bp_model:
        bp_model = InterviewBlueprintModel(
            domain_id=domain.id,
            slug=slug,
            title=payload.title,
            description=payload.description,
            status="DRAFT",
        )
        db.add(bp_model)
        await db.flush()

    # Create immutable version record
    ver_model = InterviewBlueprintVersionModel(
        blueprint_id=bp_model.id,
        version=payload.version,
        status="DRAFT",
        graph_data=parsed_bp.model_dump(),
        public_metadata=parsed_bp.public_metadata.model_dump(),
        created_by=admin.handle or admin.email,
    )
    db.add(ver_model)
    await db.commit()
    await db.refresh(ver_model)

    return AdminBlueprintVersionItem(
        id=ver_model.id,
        version=ver_model.version,
        status=ver_model.status,
        checksum=ver_model.checksum,
        published_at=None,
        created_at=ver_model.created_at.isoformat(),
    )


@router.post("/blueprints/{id}/validate", response_model=AdminBlueprintValidateResponse, summary="Validate blueprint graph integrity")
async def validate_blueprint(
    id: str,
    admin: MemberProfile = Depends(require_admin_or_core),
    db: AsyncSession = Depends(get_db),
):
    """
    Executes BlueprintGraphValidator on the blueprint version:
    - Node uniqueness and entry/terminal validity
    - Reachability of all required nodes via BFS
    - Bounded cycles and acyclic terminal paths
    - Prerequisite integrity and fallback question presence
    """
    ver_model = await _get_version_or_404(id, db)
    parsed_bp = InterviewBlueprint.model_validate(ver_model.graph_data)

    errors = BlueprintGraphValidator.validate(parsed_bp)
    valid = len(errors) == 0

    competencies = list(
        {c for n in parsed_bp.nodes.values() for c in n.competency_ids}
    )

    ver_model.validation_report = {
        "valid": valid,
        "errors": errors,
        "node_count": len(parsed_bp.nodes),
        "edge_count": len(parsed_bp.edges),
        "validated_at": datetime.now(timezone.utc).isoformat(),
    }
    ver_model.status = "APPROVED" if valid else "DRAFT"
    await db.commit()

    return AdminBlueprintValidateResponse(
        valid=valid,
        errors=errors,
        node_count=len(parsed_bp.nodes),
        edge_count=len(parsed_bp.edges),
        competencies_covered=competencies,
        validated_at=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/blueprints/{id}/generate-dataset", response_model=AdminDatasetGenerateResponse, summary="Generate synthetic & gold evaluation dataset")
async def generate_dataset(
    id: str,
    admin: MemberProfile = Depends(require_admin_or_core),
    db: AsyncSession = Depends(get_db),
):
    """
    Generates synthetic candidate answers, gold test case templates,
    adversarial injection cases, and question bank entries.
    """
    ver_model = await _get_version_or_404(id, db)
    parsed_bp = InterviewBlueprint.model_validate(ver_model.graph_data)

    artifacts = DatasetHarnessService.generate_dataset_artifacts(parsed_bp)

    # Persist dataset artifacts in database
    for dtype, dkey in [
        ("SYNTHETIC_EXAMPLES", "synthetic_examples"),
        ("GOLD_CASES", "gold_cases"),
        ("ADVERSARIAL_CASES", "adversarial_cases"),
        ("QUESTION_BANK", "question_bank"),
    ]:
        data_list = artifacts[dkey]
        ds = InterviewDomainDataset(
            blueprint_version_id=ver_model.id,
            dataset_type=dtype,
            records_count=len(data_list),
            data_records=data_list,
            checksum=artifacts["checksum"],
            status="DRAFT" if dtype != "GOLD_CASES" else "LOCKED_GOLD",
        )
        db.add(ds)

    ver_model.checksum = artifacts["checksum"]
    await db.commit()

    return AdminDatasetGenerateResponse(
        blueprint_id=ver_model.blueprint_id,
        version=ver_model.version,
        synthetic_examples_count=len(artifacts["synthetic_examples"]),
        gold_cases_count=len(artifacts["gold_cases"]),
        adversarial_cases_count=len(artifacts["adversarial_cases"]),
        question_bank_count=len(artifacts["question_bank"]),
        checksum=artifacts["checksum"],
        generated_at=artifacts["generated_at"],
    )


@router.post("/blueprints/{id}/run-evaluation", response_model=AdminJudgeEvaluationResponse, summary="Run offline judge calibration evaluation")
async def run_evaluation(
    id: str,
    admin: MemberProfile = Depends(require_admin_or_core),
    db: AsyncSession = Depends(get_db),
):
    """
    Executes offline judge calibration against gold-standard holdout and adversarial suites.
    Verifies MAE <= 0.75, Evidence Precision >= 90%, Injection Resistance >= 95%.
    """
    ver_model = await _get_version_or_404(id, db)
    parsed_bp = InterviewBlueprint.model_validate(ver_model.graph_data)

    # Load datasets
    gold_stmt = select(InterviewDomainDataset).where(
        InterviewDomainDataset.blueprint_version_id == ver_model.id,
        InterviewDomainDataset.dataset_type == "GOLD_CASES",
    )
    gold_ds = (await db.execute(gold_stmt)).scalars().first()

    adv_stmt = select(InterviewDomainDataset).where(
        InterviewDomainDataset.blueprint_version_id == ver_model.id,
        InterviewDomainDataset.dataset_type == "ADVERSARIAL_CASES",
    )
    adv_ds = (await db.execute(adv_stmt)).scalars().first()

    gold_cases = gold_ds.data_records if gold_ds else []
    adv_cases = adv_ds.data_records if adv_ds else []

    if not gold_cases:
        # Auto-generate if not previously triggered
        artifacts = DatasetHarnessService.generate_dataset_artifacts(parsed_bp)
        gold_cases = artifacts["gold_cases"]
        adv_cases = artifacts["adversarial_cases"]

    report = DatasetHarnessService.run_judge_evaluation(parsed_bp, gold_cases, adv_cases)

    # Save to version validation report
    val_report = dict(ver_model.validation_report or {})
    val_report["judge_evaluation"] = report
    ver_model.validation_report = val_report
    await db.commit()

    return AdminJudgeEvaluationResponse(
        blueprint_id=ver_model.blueprint_id,
        version=ver_model.version,
        total_cases_evaluated=report["total_cases_evaluated"],
        mean_absolute_error=report["mean_absolute_error"],
        rubric_adherence_rate=report["rubric_adherence_rate"],
        evidence_grounding_precision=report["evidence_grounding_precision"],
        prompt_injection_resistance_rate=report["prompt_injection_resistance_rate"],
        gate_verdict=report["gate_verdict"],
        details=report["details"],
        evaluated_at=report["evaluated_at"],
    )


@router.post("/blueprints/{id}/publish", response_model=AdminBlueprintPublishResponse, summary="Publish immutable interview blueprint")
async def publish_blueprint(
    id: str,
    admin: MemberProfile = Depends(require_admin_or_core),
    db: AsyncSession = Depends(get_db),
):
    """
    Publishes an immutable blueprint version to production.
    Requires:
    1. Graph validity passes BlueprintGraphValidator.
    2. Active version pointer updated on the domain blueprint.
    Immediately makes the domain visible in the candidate catalog.
    """
    ver_model = await _get_version_or_404(id, db)
    parsed_bp = InterviewBlueprint.model_validate(ver_model.graph_data)

    # Validate graph integrity
    errors = BlueprintGraphValidator.validate(parsed_bp)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot publish blueprint with graph integrity errors: {errors}",
        )

    # Update version status
    now = datetime.now(timezone.utc)
    ver_model.status = "PUBLISHED"
    ver_model.published_at = now

    # Update blueprint root
    bp_stmt = select(InterviewBlueprintModel).where(InterviewBlueprintModel.id == ver_model.blueprint_id)
    bp_model = (await db.execute(bp_stmt)).scalars().first()
    if bp_model:
        bp_model.active_version_id = ver_model.id
        bp_model.status = "PUBLISHED"

    # Register in dynamic memory catalog
    parsed_bp.status = "published"
    BlueprintRegistryService.register_blueprint(parsed_bp)

    await db.commit()
    logger.info("Admin %s published blueprint %s (version %s)", admin.handle or admin.email, bp_model.slug, ver_model.version)

    return AdminBlueprintPublishResponse(
        blueprint_id=ver_model.blueprint_id,
        version=ver_model.version,
        slug=bp_model.slug if bp_model else parsed_bp.slug,
        status="PUBLISHED",
        published_at=now.isoformat(),
    )


@router.get("/blueprints/{id}/coverage", response_model=AdminBlueprintCoverageResponse, summary="Get curriculum & competency coverage report")
async def get_coverage_report(
    id: str,
    admin: MemberProfile = Depends(require_admin_or_core),
    db: AsyncSession = Depends(get_db),
):
    """Returns curriculum & competency coverage metrics for a blueprint."""
    ver_model = await _get_version_or_404(id, db)
    parsed_bp = InterviewBlueprint.model_validate(ver_model.graph_data)

    report = DatasetHarnessService.generate_coverage_report(parsed_bp)
    return AdminBlueprintCoverageResponse(
        blueprint_id=ver_model.blueprint_id,
        version=ver_model.version,
        domain=report["domain"],
        competencies=report["competencies"],
        difficulty_spread=report["difficulty_spread"],
        total_nodes=report["total_nodes"],
    )


@router.get("/blueprints/{id}/versions", response_model=List[AdminBlueprintVersionItem], summary="List all blueprint versions")
async def list_blueprint_versions(
    id: str,
    admin: MemberProfile = Depends(require_admin_or_core),
    db: AsyncSession = Depends(get_db),
):
    """Lists all historical immutable versions for a blueprint."""
    stmt = (
        select(InterviewBlueprintVersionModel)
        .where(InterviewBlueprintVersionModel.blueprint_id == id)
        .order_by(InterviewBlueprintVersionModel.created_at.desc())
    )
    versions = (await db.execute(stmt)).scalars().all()

    return [
        AdminBlueprintVersionItem(
            id=v.id,
            version=v.version,
            status=v.status,
            checksum=v.checksum,
            published_at=v.published_at.isoformat() if v.published_at else None,
            created_at=v.created_at.isoformat(),
        )
        for v in versions
    ]


async def _get_version_or_404(version_id: str, db: AsyncSession) -> InterviewBlueprintVersionModel:
    stmt = select(InterviewBlueprintVersionModel).where(InterviewBlueprintVersionModel.id == version_id)
    ver = (await db.execute(stmt)).scalars().first()
    if not ver:
        # Try finding by blueprint slug
        bp_stmt = select(InterviewBlueprintModel).where(InterviewBlueprintModel.slug == version_id)
        bp = (await db.execute(bp_stmt)).scalars().first()
        if bp and bp.active_version_id:
            ver = (
                await db.execute(
                    select(InterviewBlueprintVersionModel).where(
                        InterviewBlueprintVersionModel.id == bp.active_version_id
                    )
                )
            ).scalars().first()
    if not ver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Blueprint version '{version_id}' not found.",
        )
    return ver

