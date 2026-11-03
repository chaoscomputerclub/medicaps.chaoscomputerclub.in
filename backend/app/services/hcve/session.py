"""
HCVE Session Domain Model, State Machine, and Session Repositories.
Implements HCVE-010: Session lifecycle, serialized state transitions, in-memory & Redis repositories.
"""

from __future__ import annotations

import asyncio
import enum
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Protocol
from pydantic import BaseModel, Field

from app.services.hcve.contracts import (
    AudioTransportConfig,
    HCVEError,
    HCVEErrorCode,
    rfc3339_now,
)


# ---------------------------------------------------------------------------
# Turn State Machine (docs/diagrams/turn_state_machine.mmd)
# ---------------------------------------------------------------------------

class TurnState(str, enum.Enum):
    IDLE = "Idle"
    LISTENING = "Listening"
    PROCESSING = "Processing"
    GENERATING = "Generating"
    SPEAKING = "Speaking"
    RECOVERING = "Recovering"
    CLOSED = "Closed"


# Valid transitions table mapped directly from turn_state_machine.mmd
VALID_STATE_TRANSITIONS = {
    TurnState.IDLE: {TurnState.LISTENING, TurnState.CLOSED},
    TurnState.LISTENING: {TurnState.PROCESSING, TurnState.CLOSED},
    TurnState.PROCESSING: {TurnState.GENERATING, TurnState.CLOSED},
    TurnState.GENERATING: {TurnState.SPEAKING, TurnState.LISTENING, TurnState.CLOSED},
    TurnState.SPEAKING: {TurnState.LISTENING, TurnState.IDLE, TurnState.RECOVERING, TurnState.CLOSED},
    TurnState.RECOVERING: {TurnState.LISTENING, TurnState.IDLE, TurnState.CLOSED},
    TurnState.CLOSED: set(),
}


# ---------------------------------------------------------------------------
# Session Domain Model
# ---------------------------------------------------------------------------

class SessionConfig(BaseModel):
    application_id: str = Field(default="app_demo", min_length=1)
    persona_id: str = Field(default="persona_default", min_length=1)
    language: str = Field(default="en-IN")
    transport: AudioTransportConfig = Field(default_factory=AudioTransportConfig)
    memory_mode: str = Field(default="session_only")
    ttl_seconds: int = Field(default=3600, ge=60, le=86400)


class SessionState(BaseModel):
    session_id: str = Field(..., min_length=1)
    owner_id: str = Field(..., min_length=1)
    application_id: str = Field(default="app_demo")
    persona_id: str = Field(default="persona_default")
    language: str = Field(default="en-IN")
    state: TurnState = Field(default=TurnState.IDLE)
    created_at: str = Field(default_factory=rfc3339_now)
    last_activity_at: str = Field(default_factory=rfc3339_now)
    current_turn_index: int = Field(default=0, ge=0)
    active_turn_id: Optional[str] = None
    active_response_id: Optional[str] = None
    transport: AudioTransportConfig = Field(default_factory=AudioTransportConfig)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    ttl_seconds: int = Field(default=3600)
    is_cancelled: bool = False

    def is_expired(self) -> bool:
        created_dt = datetime.fromisoformat(self.last_activity_at)
        now_dt = datetime.now(timezone.utc)
        return (now_dt - created_dt).total_seconds() > self.ttl_seconds

    def touch(self) -> None:
        self.last_activity_at = rfc3339_now()


# ---------------------------------------------------------------------------
# Session Repository Protocol & Implementations
# ---------------------------------------------------------------------------

class SessionRepository(Protocol):
    async def create(self, session: SessionState) -> SessionState:
        ...

    async def get(self, session_id: str) -> Optional[SessionState]:
        ...

    async def save(self, session: SessionState) -> SessionState:
        ...

    async def delete(self, session_id: str) -> bool:
        ...

    async def list_by_owner(self, owner_id: str) -> List[SessionState]:
        ...


class InMemorySessionRepository:
    """Thread/asyncio-safe in-memory session repository for local test execution."""

    def __init__(self) -> None:
        self._sessions: Dict[str, SessionState] = {}
        self._lock = asyncio.Lock()

    async def create(self, session: SessionState) -> SessionState:
        async with self._lock:
            if session.session_id in self._sessions:
                raise HCVEError(
                    HCVEErrorCode.CONCURRENCY_LOCK_FAILED,
                    f"Session {session.session_id} already exists.",
                    session_id=session.session_id,
                )
            self._sessions[session.session_id] = session.model_copy(deep=True)
            return self._sessions[session.session_id]

    async def get(self, session_id: str) -> Optional[SessionState]:
        async with self._lock:
            sess = self._sessions.get(session_id)
            if not sess:
                return None
            if sess.is_expired():
                del self._sessions[session_id]
                return None
            return sess.model_copy(deep=True)

    async def save(self, session: SessionState) -> SessionState:
        async with self._lock:
            session.touch()
            self._sessions[session.session_id] = session.model_copy(deep=True)
            return self._sessions[session.session_id]

    async def delete(self, session_id: str) -> bool:
        async with self._lock:
            return self._sessions.pop(session_id, None) is not None

    async def list_by_owner(self, owner_id: str) -> List[SessionState]:
        async with self._lock:
            return [
                s.model_copy(deep=True)
                for s in self._sessions.values()
                if s.owner_id == owner_id and not s.is_expired()
            ]


class RedisSessionRepository:
    """Redis-backed session repository for clustered production instances."""

    def __init__(self, redis_client: Any, prefix: str = "hcve:session:") -> None:
        self._redis = redis_client
        self._prefix = prefix

    def _key(self, session_id: str) -> str:
        return f"{self._prefix}{session_id}"

    async def create(self, session: SessionState) -> SessionState:
        key = self._key(session.session_id)
        exists = await self._redis.exists(key)
        if exists:
            raise HCVEError(
                HCVEErrorCode.CONCURRENCY_LOCK_FAILED,
                f"Session {session.session_id} already exists in Redis.",
                session_id=session.session_id,
            )
        data = session.model_dump_json()
        await self._redis.set(key, data, ex=session.ttl_seconds)
        return session

    async def get(self, session_id: str) -> Optional[SessionState]:
        key = self._key(session_id)
        raw = await self._redis.get(key)
        if not raw:
            return None
        payload = json.loads(raw if isinstance(raw, str) else raw.decode("utf-8"))
        return SessionState.model_validate(payload)

    async def save(self, session: SessionState) -> SessionState:
        session.touch()
        key = self._key(session.session_id)
        data = session.model_dump_json()
        await self._redis.set(key, data, ex=session.ttl_seconds)
        return session

    async def delete(self, session_id: str) -> bool:
        key = self._key(session_id)
        deleted = await self._redis.delete(key)
        return deleted > 0

    async def list_by_owner(self, owner_id: str) -> List[SessionState]:
        # Scans keys under prefix and filters by owner
        cursor = 0
        matching = []
        pattern = f"{self._prefix}*"
        while True:
            cursor, keys = await self._redis.scan(cursor=cursor, match=pattern, count=100)
            for k in keys:
                raw = await self._redis.get(k)
                if raw:
                    sess = SessionState.model_validate_json(raw)
                    if sess.owner_id == owner_id and not sess.is_expired():
                        matching.append(sess)
            if cursor == 0:
                break
        return matching

