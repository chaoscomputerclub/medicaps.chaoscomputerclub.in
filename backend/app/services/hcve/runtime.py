"""
HCVE Voice Runtime Coordinator.
Orchestrates turn state transitions, cancellation propagation, and audio pipeline routing.
Implements HCVE-060 (Turn State Machine), HCVE-061 (Barge-in), HCVE-062 (Cancellation).
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from app.services.hcve.adapters import (
    FakeLLMAdapter,
    FakeSTTAdapter,
    FakeTTSAdapter,
    FakeVADAdapter,
)
from app.services.hcve.contracts import (
    EventEnvelope,
    HCVEError,
    HCVEErrorCode,
    rfc3339_now,
)
from app.services.hcve.expression import VoiceExpressionEngine
from app.services.hcve.session import (
    InMemorySessionRepository,
    SessionRepository,
    SessionState,
    TurnState,
    VALID_STATE_TRANSITIONS,
)


class VoiceRuntimeCoordinator:
    """Session-level coordinator ensuring serialized transitions and cancellation propagation."""

    def __init__(
        self,
        session_repo: Optional[SessionRepository] = None,
        expression_engine: Optional[VoiceExpressionEngine] = None,
    ) -> None:
        self.session_repo = session_repo or InMemorySessionRepository()
        self.expression_engine = expression_engine or VoiceExpressionEngine()
        self.vad_adapter = FakeVADAdapter()
        self.stt_adapter = FakeSTTAdapter()
        self.llm_adapter = FakeLLMAdapter()
        self.tts_adapter = FakeTTSAdapter()

        # Cancellation tokens per active response ID
        self._cancel_tokens: Dict[str, asyncio.Event] = {}
        # Concurrency locks per session ID
        self._session_locks: Dict[str, asyncio.Lock] = {}

    def _get_session_lock(self, session_id: str) -> asyncio.Lock:
        if session_id not in self._session_locks:
            self._session_locks[session_id] = asyncio.Lock()
        return self._session_locks[session_id]

    async def transition_state(self, session_id: str, new_state: TurnState) -> SessionState:
        """Execute validated and serialized state transition."""
        lock = self._get_session_lock(session_id)
        async with lock:
            session = await self.session_repo.get(session_id)
            if not session:
                raise HCVEError(HCVEErrorCode.SESSION_NOT_FOUND, f"Session {session_id} not found", session_id)

            if new_state not in VALID_STATE_TRANSITIONS.get(session.state, set()):
                raise HCVEError(
                    HCVEErrorCode.INVALID_STATE_TRANSITION,
                    f"Illegal transition from {session.state.value} to {new_state.value}",
                    session_id=session_id,
                )

            session.state = new_state
            await self.session_repo.save(session)
            return session

    async def cancel_active_response(self, session_id: str, reason: str = "barge_in_interruption") -> bool:
        """Propagate cancellation token end-to-end and transition to Listening."""
        lock = self._get_session_lock(session_id)
        async with lock:
            session = await self.session_repo.get(session_id)
            if not session:
                return False

            if session.active_response_id and session.active_response_id in self._cancel_tokens:
                self._cancel_tokens[session.active_response_id].set()

            session.is_cancelled = True
            if session.state in {TurnState.GENERATING, TurnState.SPEAKING}:
                session.state = TurnState.LISTENING
            await self.session_repo.save(session)
            return True

    async def handle_user_audio_frame(
        self,
        session_id: str,
        audio_frame: bytes,
    ) -> Optional[EventEnvelope]:
        """Ingest audio frame, check VAD, and handle barge-in cancellation if speaking."""
        session = await self.session_repo.get(session_id)
        if not session or session.state == TurnState.CLOSED:
            return None

        vad_res = self.vad_adapter.process_frame(audio_frame)

        # Barge-in check: If user speaks while assistant is generating/speaking -> trigger immediate cancellation
        if vad_res.is_speech and session.state in {TurnState.GENERATING, TurnState.SPEAKING}:
            await self.cancel_active_response(session_id, reason="barge_in_speech_start")
            return EventEnvelope(
                event_id=f"evt_cancel_{session_id}_{int(asyncio.get_event_loop().time() * 1000)}",
                event_type="assistant.response.cancelled",
                session_id=session_id,
                response_id=session.active_response_id,
                payload={"reason": "barge_in_speech_detected", "confidence": vad_res.confidence},
            )

        if vad_res.is_speech and session.state == TurnState.IDLE:
            await self.transition_state(session_id, TurnState.LISTENING)
            return EventEnvelope(
                event_id=f"evt_start_{session_id}_{int(asyncio.get_event_loop().time() * 1000)}",
                event_type="speech.started",
                session_id=session_id,
                payload={"confidence": vad_res.confidence},
            )

        return None

