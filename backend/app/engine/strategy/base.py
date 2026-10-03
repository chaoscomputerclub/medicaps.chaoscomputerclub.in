"""
Chaos Computer Club — Strategy Abstraction & Execution Contracts
Language-aware execution interfaces, structured lifecycle results, and strict resource budgets.
"""

from __future__ import annotations

import os
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple

if TYPE_CHECKING:
    from app.engine.languages import LanguageConfig


class ArtifactType(str, Enum):
    NATIVE_BINARY = "native_binary"
    BYTECODE = "bytecode"
    CLASS_FILES = "class_files"
    RUNTIME_SOURCE = "runtime_source"


@dataclass(frozen=True)
class CompileLimits:
    """Resource constraints dedicated strictly to the compilation stage."""
    timeout: float = 10.0
    cpu: float = 2.0
    memory_bytes: int = 512 * 1024 * 1024       # 512 MB
    process_count: int = 64
    output_limit_bytes: int = 128 * 1024       # 128 KB


@dataclass(frozen=True)
class ExecutionLimits:
    """Resource constraints dedicated strictly to the testcase execution stage."""
    timeout: float = 2.0
    cpu: float = 1.0
    memory_bytes: int = 256 * 1024 * 1024       # 256 MB
    process_count: int = 16
    output_limit_bytes: int = 1024 * 1024      # 1 MB


@dataclass(frozen=True)
class ExecutionArtifact:
    """Structured compilation output or runtime entrypoint representation."""
    artifact_type: ArtifactType
    path: Path
    language_id: str
    compiler_version: Optional[str] = None
    compile_flags: Tuple[str, ...] = field(default_factory=tuple)
    source_hash: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    size_bytes: int = 0
    is_executable: bool = True
    entry_command: Tuple[str, ...] = field(default_factory=tuple)


@dataclass
class CompilationResult:
    """Structured compilation result. Never infer failure solely from stderr."""
    success: bool
    executable_path: Optional[str] = None
    exit_code: int = 0
    signal: Optional[int] = None
    stdout: str = ""
    stderr: str = ""
    duration_ms: float = 0.0
    peak_memory_bytes: int = 0
    compiler_version: Optional[str] = None
    compile_flags: List[str] = field(default_factory=list)
    cached: bool = False
    artifact: Optional[ExecutionArtifact] = None


@dataclass
class PreparationResult:
    """Result of runtime environment preparation / source writing."""
    success: bool
    source_path: Path
    startup_ms: float = 0.0
    error: Optional[str] = None
    artifact: Optional[ExecutionArtifact] = None


@dataclass
class TestcaseExecutionResult:
    """Single testcase execution telemetry and output."""
    stdout: str = ""
    stderr: str = ""
    exit_code: int = 0
    signal: Optional[int] = None
    wall_time_ms: float = 0.0
    peak_memory_bytes: int = 0
    timed_out: bool = False
    oom_killed: bool = False
    output_limit_exceeded: bool = False
    system_error: bool = False
    error_detail: Optional[str] = None


def sanitize_compiler_output(raw_output: str, workspace: Optional[Path] = None) -> str:
    """
    Sanitize compiler diagnostics:
    - Strips host directory paths (e.g., /Users/... or /tmp/...)
    - Replaces workspace path with canonical `/workspace`
    - Prevents leaking host usernames, environment details, or internal structures
    """
    if not raw_output:
        return ""

    sanitized = raw_output
    if workspace:
        sanitized = sanitized.replace(str(workspace), "/workspace")
        sanitized = sanitized.replace(str(workspace.resolve()), "/workspace")

    # Clean generic temporary path patterns
    sanitized = re.sub(r"/Users/[^/\s]+", "/home/sandbox", sanitized)
    sanitized = re.sub(r"/home/[^/\s]+", "/home/sandbox", sanitized)
    sanitized = re.sub(r"/private/var/folders/[^\s]+", "/workspace", sanitized)
    sanitized = re.sub(r"/tmp/ccc_exec_[^\s/]+", "/workspace", sanitized)
    sanitized = re.sub(r"/tmp/interleet_[^\s/]+", "/workspace", sanitized)
    sanitized = re.sub(r"/tmp/ccc_workspaces/[^\s/]+", "/workspace", sanitized)

    return sanitized.strip()


class ExecutionStrategy(ABC):
    """
    Strategy abstraction for language-aware code execution.
    Common execution engine handles process sandboxing, timers, output verification,
    and telemetry without duplicating logic across strategies.
    """

    def __init__(self, config: "LanguageConfig") -> None:
        self.config = config

    @abstractmethod
    async def prepare(
        self,
        workspace: Path,
        source_code: str,
        limits: CompileLimits,
    ) -> PreparationResult:
        """Prepare source files and runtime environment."""
        pass

    @abstractmethod
    async def compile(
        self,
        workspace: Path,
        limits: CompileLimits,
        cache: Optional[Any] = None,
    ) -> CompilationResult:
        """Compile source code into reusable artifact (amortized once per submission)."""
        pass

    @abstractmethod
    async def execute(
        self,
        workspace: Path,
        artifact: ExecutionArtifact,
        stdin_data: str,
        limits: ExecutionLimits,
    ) -> TestcaseExecutionResult:
        """Execute single testcase against the prepared/compiled artifact."""
        pass

    async def cleanup(self, workspace: Path) -> None:
        """Clean up ephemeral files if necessary."""
        pass
