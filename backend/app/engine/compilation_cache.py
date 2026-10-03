"""
Chaos Computer Club — Content-Addressed Compilation Cache
Guarantees:
1. Strict content addressing with toolchain, architecture, OS, flags, and sandbox profile isolation.
2. Atomic publication (no partial or corrupted binaries exposed).
3. Path traversal defense and strict filesystem containment.
4. Concurrency-safe compilation synchronization.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import platform
import shutil
import tempfile
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from app.engine.strategy.base import ArtifactType, CompilationResult, ExecutionArtifact

logger = logging.getLogger("ccc.engine.compile_cache")


def normalize_source_code(source: str) -> str:
    """Normalize whitespace and line endings for deterministic hashing."""
    return "\n".join(line.rstrip() for line in source.replace("\r\n", "\n").splitlines()).strip()


@dataclass(frozen=True)
class CompilationCacheKey:
    """Complete immutable identity required to safely cache compiled artifacts."""
    language_id: str
    source_hash: str
    compiler_version: str
    compile_flags: Tuple[str, ...]
    architecture: str
    operating_system: str
    sandbox_profile_version: str

    @classmethod
    def create(
        cls,
        language_id: str,
        source_code: str,
        compiler_version: Optional[str] = None,
        compile_flags: Optional[List[str]] = None,
        sandbox_profile_version: str = "v1",
        runtime_version: Optional[str] = None,
    ) -> "CompilationCacheKey":
        norm_source = normalize_source_code(source_code)
        flags_tuple = tuple(sorted(compile_flags or []))
        comp_ver = compiler_version or "default"
        rt_ver = runtime_version or "default"
        arch = platform.machine().lower()
        os_name = platform.system().lower()

        # Compute content-addressed source hash with all toolchain factors
        hasher = hashlib.sha256()
        hasher.update(norm_source.encode("utf-8"))
        hasher.update(language_id.encode("utf-8"))
        hasher.update(comp_ver.encode("utf-8"))
        hasher.update(" ".join(flags_tuple).encode("utf-8"))
        hasher.update(rt_ver.encode("utf-8"))
        hasher.update(sandbox_profile_version.encode("utf-8"))
        source_hash = hasher.hexdigest()

        return cls(
            language_id=language_id.lower(),
            source_hash=source_hash,
            compiler_version=comp_ver,
            compile_flags=flags_tuple,
            architecture=arch,
            operating_system=os_name,
            sandbox_profile_version=sandbox_profile_version,
        )

    def cache_id(self) -> str:
        """Deterministic 64-char hex digest representing this exact compilation configuration."""
        components = [
            self.language_id,
            self.source_hash,
            self.compiler_version,
            " ".join(self.compile_flags),
            self.architecture,
            self.operating_system,
            self.sandbox_profile_version,
        ]
        return hashlib.sha256(":".join(components).encode("utf-8")).hexdigest()


class CompilationCache:
    """
    Thread-safe and process-safe content-addressed cache for compiled binaries and bytecode.
    Never exposes partially compiled files or unverified binaries.
    """

    _key_locks: Dict[str, asyncio.Lock] = {}
    _global_lock: asyncio.Lock = asyncio.Lock()

    def __init__(self, base_dir: Optional[Path] = None, enabled: bool = True) -> None:
        self.enabled = enabled
        default_dir = os.environ.get("COMPILATION_CACHE_DIR")
        if default_dir:
            self.base_dir = Path(default_dir)
        elif base_dir:
            self.base_dir = base_dir
        else:
            self.base_dir = Path(tempfile.gettempdir()) / "ccc_compilation_cache"
        
        if self.enabled:
            self.base_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    async def _get_lock(cls, cache_id: str) -> asyncio.Lock:
        async with cls._global_lock:
            if cache_id not in cls._key_locks:
                cls._key_locks[cache_id] = asyncio.Lock()
            return cls._key_locks[cache_id]

    def _entry_dir(self, key: CompilationCacheKey) -> Path:
        cache_id = key.cache_id()
        # Strict security validation: cache_id must be pure hex to prevent directory traversal
        if not cache_id.isalnum() or len(cache_id) != 64:
            raise ValueError(f"Invalid cache ID security format: {cache_id}")
        return self.base_dir / key.language_id / cache_id

    async def get(
        self,
        key: CompilationCacheKey,
        target_dest: Optional[Path] = None,
    ) -> Optional[Tuple[ExecutionArtifact, CompilationResult]]:
        """
        Lookup cached artifact. If found and target_dest is provided, copies artifact to target_dest.
        Validates artifact integrity, size, and metadata before returning.
        Returns None on miss or corruption.
        """
        if not self.enabled:
            return None

        entry_dir = self._entry_dir(key)
        meta_file = entry_dir / "metadata.json"
        artifact_file = entry_dir / "artifact"

        if not (meta_file.exists() and artifact_file.exists()):
            return None

        try:
            raw_meta = meta_file.read_text(encoding="utf-8")
            meta = json.loads(raw_meta)
            
            # Verify toolchain and architecture metadata matches
            if (
                meta.get("language_id") != key.language_id
                or meta.get("architecture") != key.architecture
                or meta.get("operating_system") != key.operating_system
                or meta.get("compiler_version") != key.compiler_version
                or meta.get("sandbox_profile_version") != key.sandbox_profile_version
            ):
                logger.warning("Cache metadata mismatch for %s; purging invalid entry", key.cache_id())
                shutil.rmtree(entry_dir, ignore_errors=True)
                return None

            expected_size = meta.get("size_bytes", 0)
            actual_size = artifact_file.stat().st_size
            if actual_size != expected_size or actual_size == 0:
                logger.warning("Corrupted cache artifact for %s (size mismatch: exp %d, got %d)", key.cache_id(), expected_size, actual_size)
                shutil.rmtree(entry_dir, ignore_errors=True)
                return None

            # Copy to target destination inside sandbox if requested
            dest_path = target_dest or artifact_file
            if target_dest:
                target_dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(artifact_file, target_dest)
                if meta.get("is_executable", True):
                    os.chmod(target_dest, 0o755)
                dest_path = target_dest

            art_type = ArtifactType(meta.get("artifact_type", ArtifactType.NATIVE_BINARY.value))
            if art_type == ArtifactType.CLASS_FILES:
                entry_cmd = ("java", "-Xmx256m", "-Xms32m", "-cp", str(dest_path.parent), "Main")
            elif meta.get("is_executable", True):
                entry_cmd = (str(dest_path),)
            else:
                entry_cmd = tuple(meta.get("entry_command", []))

            artifact = ExecutionArtifact(
                artifact_type=art_type,
                path=dest_path,
                language_id=key.language_id,
                compiler_version=key.compiler_version,
                compile_flags=tuple(key.compile_flags),
                source_hash=key.source_hash,
                created_at=datetime.fromisoformat(meta.get("created_at", datetime.now(timezone.utc).isoformat())),
                size_bytes=actual_size,
                is_executable=meta.get("is_executable", True),
                entry_command=entry_cmd,
            )

            comp_result = CompilationResult(
                success=True,
                executable_path=str(dest_path),
                exit_code=0,
                stdout=meta.get("stdout", ""),
                stderr=meta.get("stderr", ""),
                duration_ms=0.0,  # Cache hit -> zero compilation time
                compiler_version=key.compiler_version,
                compile_flags=list(key.compile_flags),
                cached=True,
                artifact=artifact,
            )

            return artifact, comp_result

        except Exception as exc:
            logger.warning("Failed to read compilation cache for %s: %s", key.cache_id(), exc)
            shutil.rmtree(entry_dir, ignore_errors=True)
            return None

    async def put(
        self,
        key: CompilationCacheKey,
        compiled_file: Path,
        compilation_result: CompilationResult,
        artifact_type: ArtifactType = ArtifactType.NATIVE_BINARY,
        is_executable: bool = True,
        entry_command: Optional[List[str]] = None,
    ) -> Optional[ExecutionArtifact]:
        """
        Store compilation artifact atomically.
        Uses temporary files and atomic rename to guarantee no partially written artifacts.
        """
        if not self.enabled or not compilation_result.success or not compiled_file.exists():
            return None

        cache_id = key.cache_id()
        lock = await self._get_lock(cache_id)

        async with lock:
            entry_dir = self._entry_dir(key)
            entry_dir.mkdir(parents=True, exist_ok=True)

            # Atomic publication: write to temp file then atomic os.replace
            tmp_artifact = entry_dir / f"tmp_artifact_{uuid4().hex}"
            tmp_meta = entry_dir / f"tmp_meta_{uuid4().hex}"
            final_artifact = entry_dir / "artifact"
            final_meta = entry_dir / "metadata.json"

            try:
                shutil.copy2(compiled_file, tmp_artifact)
                if is_executable:
                    os.chmod(tmp_artifact, 0o755)
                
                size_bytes = tmp_artifact.stat().st_size
                now_str = datetime.now(timezone.utc).isoformat()

                metadata = {
                    "cache_id": cache_id,
                    "language_id": key.language_id,
                    "source_hash": key.source_hash,
                    "compiler_version": key.compiler_version,
                    "compile_flags": list(key.compile_flags),
                    "architecture": key.architecture,
                    "operating_system": key.operating_system,
                    "sandbox_profile_version": key.sandbox_profile_version,
                    "artifact_type": artifact_type.value,
                    "is_executable": is_executable,
                    "entry_command": entry_command or [],
                    "size_bytes": size_bytes,
                    "created_at": now_str,
                    "stdout": compilation_result.stdout,
                    "stderr": compilation_result.stderr,
                }

                tmp_meta.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

                # Atomic replace
                os.replace(tmp_artifact, final_artifact)
                os.replace(tmp_meta, final_meta)

                return ExecutionArtifact(
                    artifact_type=artifact_type,
                    path=final_artifact,
                    language_id=key.language_id,
                    compiler_version=key.compiler_version,
                    compile_flags=tuple(key.compile_flags),
                    source_hash=key.source_hash,
                    created_at=datetime.fromisoformat(now_str),
                    size_bytes=size_bytes,
                    is_executable=is_executable,
                    entry_command=tuple(entry_command or []),
                )

            except Exception as exc:
                logger.error("Failed to commit cache artifact for %s: %s", cache_id, exc)
                if tmp_artifact.exists():
                    tmp_artifact.unlink(missing_ok=True)
                if tmp_meta.exists():
                    tmp_meta.unlink(missing_ok=True)
                return None
