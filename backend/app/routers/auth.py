"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Authentication & Member Management Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    oauth2_scheme,
    verify_password,
)
from app.models.db_models import MemberProfile, RatingHistory
from app.models.schemas import (
    MemberLogin,
    MemberProfileResponse,
    MemberRegister,
    RatingHistoryResponse,
    Token,
)

router = APIRouter(prefix="/auth", tags=["Authentication & Members"])


async def get_current_member(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> MemberProfile:
    """Dependency to retrieve currently authenticated member from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        # Default to demo user arjun_v if unauthenticated for portal convenience
        res = await db.execute(select(MemberProfile).where(MemberProfile.handle == "arjun_v"))
        demo = res.scalars().first()
        if demo:
            return demo
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    handle: str = payload.get("sub")
    if handle is None:
        raise credentials_exception

    result = await db.execute(select(MemberProfile).where(MemberProfile.handle == handle))
    member = result.scalars().first()
    if member is None:
        raise credentials_exception
    return member


@router.post("/register", response_model=Token)
async def register(req: MemberRegister, db: AsyncSession = Depends(get_db)):
    """Register a new student member with Medi-Caps institutional enrollment PRN."""
    # Check if handle, email, or PRN already exists
    stmt = select(MemberProfile).where(
        or_(
            MemberProfile.handle == req.handle,
            MemberProfile.email == req.email,
            MemberProfile.prn == req.prn,
        )
    )
    res = await db.execute(stmt)
    existing = res.scalars().first()
    if existing:
        if existing.handle == req.handle:
            raise HTTPException(status_code=400, detail="Member handle is already taken.")
        if existing.email == req.email:
            raise HTTPException(status_code=400, detail="University email is already registered.")
        if existing.prn == req.prn:
            raise HTTPException(status_code=400, detail="Medi-Caps PRN is already registered.")

    member = MemberProfile(
        handle=req.handle,
        full_name=req.full_name,
        email=req.email,
        prn=req.prn,
        department=req.department,
        batch=req.batch,
        rating=1200,
        peak_rating=1200,
        hashed_password=get_password_hash(req.password),
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    access_token = create_access_token({"sub": member.handle, "prn": member.prn})
    return Token(
        access_token=access_token,
        handle=member.handle,
        full_name=member.full_name,
        prn=member.prn,
    )


@router.post("/login", response_model=Token)
async def login(req: MemberLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate member using Handle or Medi-Caps PRN."""
    stmt = select(MemberProfile).where(
        or_(
            MemberProfile.handle == req.handle_or_prn,
            MemberProfile.prn == req.handle_or_prn,
            MemberProfile.email == req.handle_or_prn,
        )
    )
    res = await db.execute(stmt)
    member = res.scalars().first()

    if not member or not member.hashed_password or not verify_password(req.password, member.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify your handle/PRN and password.",
        )

    access_token = create_access_token({"sub": member.handle, "prn": member.prn})
    return Token(
        access_token=access_token,
        handle=member.handle,
        full_name=member.full_name,
        prn=member.prn,
    )


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """OAuth2 compatible token login endpoint."""
    return await login(MemberLogin(handle_or_prn=form_data.username, password=form_data.password), db)


@router.get("/me", response_model=MemberProfileResponse)
async def get_my_profile(current_member: MemberProfile = Depends(get_current_member)):
    """Return currently authenticated member profile."""
    return current_member


@router.get("/members/{handle}", response_model=MemberProfileResponse)
async def get_public_member(handle: str, db: AsyncSession = Depends(get_db)):
    """Return public member profile by handle."""
    res = await db.execute(select(MemberProfile).where(MemberProfile.handle == handle))
    member = res.scalars().first()
    if not member:
        raise HTTPException(status_code=404, detail=f"Member @{handle} not found.")
    return member


@router.get("/members/{handle}/rating-history", response_model=List[RatingHistoryResponse])
async def get_member_rating_history(handle: str, db: AsyncSession = Depends(get_db)):
    """Return chronological offline contest rating history for profile SVG chart."""
    m_res = await db.execute(select(MemberProfile).where(MemberProfile.handle == handle))
    member = m_res.scalars().first()
    if not member:
        raise HTTPException(status_code=404, detail=f"Member @{handle} not found.")

    res = await db.execute(
        select(RatingHistory)
        .where(RatingHistory.member_id == member.id)
        .order_by(RatingHistory.contested_at.asc())
    )
    return res.scalars().all()
