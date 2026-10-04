"""
Chaos Computer Club — Authoritative Language Execution Registry & Definition System

Guarantees:
1. Strict type-safe language normalization (no silent fallback to Python).
2. Per-language canonical LanguageConfig (compilers, versions, runtimes, flags, family).
3. Distinguishes INTERPRETED, COMPILED, and VM families.
4. Structural isolation assertions: detects and blocks foreign language drivers/tokens
   before compilation or execution ever takes place.
"""

from __future__ import annotations

import logging
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Set, Tuple

if TYPE_CHECKING:
    from app.engine.adapters.base import BaseLanguageAdapter
    from app.engine.strategy.base import ExecutionStrategy

logger = logging.getLogger("ccc.engine.languages")


class UnsupportedLanguageError(ValueError):
    """Raised when an unknown or unsupported programming language is requested."""
    pass


class LanguageContaminationError(RuntimeError):
    """Raised when foreign language syntax, drivers, or tokens contaminate generated source."""
    pass


class LanguageFamily(str, Enum):
    """Execution model family."""
    INTERPRETED = "interpreted"
    COMPILED = "compiled"
    VM = "vm"

    def __str__(self) -> str:
        return self.value


class Language(str, Enum):
    PYTHON = "python"
    CPP = "cpp"
    C = "c"
    JAVA = "java"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    GO = "go"
    RUST = "rust"

    def __str__(self) -> str:
        return self.value


# Canonical alias dictionary mapping all known user/client strings to Language enum
_LANGUAGE_ALIASES: Dict[str, Language] = {
    # Python
    "python": Language.PYTHON,
    "python3": Language.PYTHON,
    "py": Language.PYTHON,
    "python 3": Language.PYTHON,
    "language.python": Language.PYTHON,
    # C++
    "cpp": Language.CPP,
    "c++": Language.CPP,
    "cxx": Language.CPP,
    "g++": Language.CPP,
    "clang++": Language.CPP,
    "language.cpp": Language.CPP,
    # C
    "c": Language.C,
    "gcc": Language.C,
    "clang": Language.C,
    "language.c": Language.C,
    # Java
    "java": Language.JAVA,
    "openjdk": Language.JAVA,
    "java17": Language.JAVA,
    "java21": Language.JAVA,
    "language.java": Language.JAVA,
    # JavaScript
    "javascript": Language.JAVASCRIPT,
    "js": Language.JAVASCRIPT,
    "node": Language.JAVASCRIPT,
    "nodejs": Language.JAVASCRIPT,
    "node.js": Language.JAVASCRIPT,
    "language.javascript": Language.JAVASCRIPT,
    # TypeScript
    "typescript": Language.TYPESCRIPT,
    "ts": Language.TYPESCRIPT,
    "language.typescript": Language.TYPESCRIPT,
    # Go
    "go": Language.GO,
    "golang": Language.GO,
    "language.go": Language.GO,
    # Rust
    "rust": Language.RUST,
    "rs": Language.RUST,
    "language.rust": Language.RUST,
}


def normalize_language(lang_input: Any) -> Language:
    """
    Safely and deterministically resolves any language representation to a canonical Language enum.
    Raises UnsupportedLanguageError if the language cannot be resolved.
    NEVER silently falls back to Python.
    """
    if isinstance(lang_input, Language):
        return lang_input

    if hasattr(lang_input, "value") and isinstance(lang_input.value, str):
        val = lang_input.value.strip().lower()
        if val in _LANGUAGE_ALIASES:
            return _LANGUAGE_ALIASES[val]

    raw = str(lang_input or "").strip().lower()
    # Handle stringified enum representation e.g. "Language.CPP" or "<Language.CPP: 'cpp'>"
    if "language." in raw:
        clean = raw.split("language.")[-1].split(":")[0].strip(">'\" ")
        if clean in _LANGUAGE_ALIASES:
            return _LANGUAGE_ALIASES[clean]

    if raw in _LANGUAGE_ALIASES:
        return _LANGUAGE_ALIASES[raw]

    raise UnsupportedLanguageError(
        f"Unsupported or unrecognized programming language: '{lang_input}'. "
        f"Supported languages: {[l.value for l in Language]}"
    )


_VERSION_CACHE: Dict[str, str] = {}


def detect_toolchain_version(binary: Optional[str]) -> Optional[str]:
    """Detect and cache host compiler/runtime version without repeating subprocess overhead."""
    if not binary:
        return None
    resolved = shutil.which(binary) or binary
    if resolved in _VERSION_CACHE:
        return _VERSION_CACHE[resolved]

    version_str = "unknown"
    try:
        # Most compilers respond to --version or -version
        cmd = [resolved, "--version"]
        if "java" in resolved.lower():
            cmd = [resolved, "-version"]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=2.0)
        out = (res.stdout or res.stderr or "").strip().splitlines()
        if out:
            version_str = out[0][:80].strip()
    except Exception:
        version_str = "installed"

    _VERSION_CACHE[resolved] = version_str
    return version_str


# Resolve host compilers with deterministic fallbacks
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_LOCAL_TSC = str(_PROJECT_ROOT / "node_modules" / ".bin" / "tsc")
_HOST_TSC = shutil.which("tsc") or (_LOCAL_TSC if os.path.exists(_LOCAL_TSC) else "tsc")
_HOST_GXX = shutil.which("g++") or shutil.which("clang++") or "g++"
_HOST_GCC = shutil.which("gcc") or shutil.which("clang") or "gcc"
_HOST_NODE = shutil.which("node") or "node"
_HOST_PYTHON = sys.executable or shutil.which("python3") or "python3"
_HOST_JAVAC = shutil.which("javac") or "javac"
_HOST_JAVA = shutil.which("java") or "java"
_HOST_GO = shutil.which("go") or "go"
_HOST_RUSTC = shutil.which("rustc") or "rustc"


@dataclass(frozen=True)
class LanguageConfig:
    """
    Canonical specification for a supported programming language in CCC.
    Serves as the single source of truth for compilers, runtimes, timeouts, and execution strategies.
    """
    language_id: str
    display_name: str
    family: LanguageFamily
    source_extension: str
    filename: str
    binary_filename: Optional[str]
    compiler: Optional[str]
    compiler_version: Optional[str]
    compile_command: Optional[List[str]]
    run_command: List[str]
    compile_flags: List[str]
    runtime: str
    runtime_arguments: List[str]
    default_time_limit: float
    default_memory_limit: int
    sandbox_profile: str
    enabled: bool
    codebox_id: int
    foreign_markers: Tuple[str, ...]

    # Compatibility property for legacy callers
    @property
    def language(self) -> Language:
        return normalize_language(self.language_id)

    @property
    def requires_compile(self) -> bool:
        return self.family in (LanguageFamily.COMPILED, LanguageFamily.VM)

    @property
    def compiler_arguments(self) -> List[str]:
        return self.compile_flags

    def get_compile_command(self, workspace: Path) -> Optional[List[str]]:
        if not self.requires_compile or not self.compiler:
            return None
        src = str(workspace / self.filename)
        bin_out = str(workspace / (self.binary_filename or "solution"))

        if self.language == Language.CPP:
            return [self.compiler, *self.compile_flags, src, "-o", bin_out]
        elif self.language == Language.C:
            return [self.compiler, *self.compile_flags, src, "-o", bin_out]
        elif self.language == Language.JAVA:
            return [self.compiler, *self.compile_flags, src]
        elif self.language == Language.TYPESCRIPT:
            return [self.compiler, *self.compile_flags, src]
        elif self.language == Language.GO:
            return [self.compiler, "build", "-o", bin_out, src]
        elif self.language == Language.RUST:
            return [self.compiler, *self.compile_flags, "-o", bin_out, src]
        return None

    def get_run_command(self, workspace: Path) -> List[str]:
        if self.requires_compile and self.binary_filename:
            bin_path = str(workspace / self.binary_filename)
            if self.language == Language.JAVA:
                return [self.runtime, *self.runtime_arguments, "Main"]
            return [bin_path, *self.runtime_arguments]

        src = str(workspace / self.filename)
        return [self.runtime, *self.runtime_arguments, src]


# Marker patterns indicating foreign language code leaked into generated source
_PYTHON_FOREIGN_MARKERS = (
    "if __name__ == '__main__':",
    'if __name__ == "__main__":',
    "# CCC Trusted Judge Execution Driver (Python)",
    "# CCC LeetCode-Style Evaluation Driver Harness (Python)",
    "def _ccc_",
    "import sys",
    "getattr(sol,",
)

_CPP_FOREIGN_MARKERS = (
    "// CCC Trusted Judge Execution Driver (C++)",
    "#include <iostream>",
    "#include <vector>",
    "using namespace std;",
)

_C_FOREIGN_MARKERS = (
    "// CCC Trusted Judge Execution Driver (C)",
    "#include <stdio.h>",
    "#include <stdbool.h>",
)

_JS_FOREIGN_MARKERS = (
    "// CCC Trusted Judge Execution Driver (Node.js)",
    "// CCC LeetCode-Style Evaluation Driver Harness (JS/TS)",
    "JSON.stringify(",
)


LANGUAGE_CONFIGS: Dict[Language, LanguageConfig] = {
    Language.PYTHON: LanguageConfig(
        language_id=Language.PYTHON.value,
        display_name="Python 3",
        family=LanguageFamily.INTERPRETED,
        source_extension=".py",
        filename="solution.py",
        binary_filename=None,
        compiler=None,
        compiler_version=None,
        compile_command=None,
        run_command=[_HOST_PYTHON, "solution.py"],
        compile_flags=[],
        runtime=_HOST_PYTHON,
        runtime_arguments=[],
        default_time_limit=3.0,
        default_memory_limit=256,
        sandbox_profile="python-standard-v1",
        enabled=True,
        codebox_id=71,
        foreign_markers=_CPP_FOREIGN_MARKERS + _C_FOREIGN_MARKERS + _JS_FOREIGN_MARKERS,
    ),
    Language.CPP: LanguageConfig(
        language_id=Language.CPP.value,
        display_name="C++ (GCC/Clang C++20)",
        family=LanguageFamily.COMPILED,
        source_extension=".cpp",
        filename="solution.cpp",
        binary_filename="solution",
        compiler=_HOST_GXX,
        compiler_version=detect_toolchain_version(_HOST_GXX),
        compile_command=[_HOST_GXX, "-O2", "-std=c++20", "solution.cpp", "-o", "solution"],
        run_command=["./solution"],
        compile_flags=["-O2", "-std=c++20"],
        runtime="./solution",
        runtime_arguments=[],
        default_time_limit=2.0,
        default_memory_limit=256,
        sandbox_profile="cpp-native-v1",
        enabled=True,
        codebox_id=54,
        foreign_markers=_PYTHON_FOREIGN_MARKERS + _JS_FOREIGN_MARKERS,
    ),
    Language.C: LanguageConfig(
        language_id=Language.C.value,
        display_name="C (GCC/Clang C11)",
        family=LanguageFamily.COMPILED,
        source_extension=".c",
        filename="solution.c",
        binary_filename="solution",
        compiler=_HOST_GCC,
        compiler_version=detect_toolchain_version(_HOST_GCC),
        compile_command=[_HOST_GCC, "-O2", "-std=c11", "solution.c", "-o", "solution"],
        run_command=["./solution"],
        compile_flags=["-O2", "-std=c11"],
        runtime="./solution",
        runtime_arguments=[],
        default_time_limit=2.0,
        default_memory_limit=256,
        sandbox_profile="c-native-v1",
        enabled=True,
        codebox_id=50,
        foreign_markers=_PYTHON_FOREIGN_MARKERS + _JS_FOREIGN_MARKERS,
    ),
    Language.JAVA: LanguageConfig(
        language_id=Language.JAVA.value,
        display_name="Java (OpenJDK 17/21)",
        family=LanguageFamily.VM,
        source_extension=".java",
        filename="Main.java",
        binary_filename="Main.class",
        compiler=_HOST_JAVAC,
        compiler_version=detect_toolchain_version(_HOST_JAVAC),
        compile_command=[_HOST_JAVAC, "Main.java"],
        run_command=[_HOST_JAVA, "-Xmx256m", "-Xms32m", "Main"],
        compile_flags=[],
        runtime=_HOST_JAVA,
        runtime_arguments=["-Xmx256m", "-Xms32m"],
        default_time_limit=3.0,
        default_memory_limit=256,
        sandbox_profile="java-jvm-v1",
        enabled=True,
        codebox_id=62,
        foreign_markers=_PYTHON_FOREIGN_MARKERS + _JS_FOREIGN_MARKERS,
    ),
    Language.JAVASCRIPT: LanguageConfig(
        language_id=Language.JAVASCRIPT.value,
        display_name="JavaScript (Node.js)",
        family=LanguageFamily.INTERPRETED,
        source_extension=".js",
        filename="solution.js",
        binary_filename=None,
        compiler=None,
        compiler_version=detect_toolchain_version(_HOST_NODE),
        compile_command=None,
        run_command=[_HOST_NODE, "solution.js"],
        compile_flags=[],
        runtime=_HOST_NODE,
        runtime_arguments=[],
        default_time_limit=3.0,
        default_memory_limit=256,
        sandbox_profile="node-standard-v1",
        enabled=True,
        codebox_id=63,
        foreign_markers=_PYTHON_FOREIGN_MARKERS + _CPP_FOREIGN_MARKERS + _C_FOREIGN_MARKERS,
    ),
    Language.TYPESCRIPT: LanguageConfig(
        language_id=Language.TYPESCRIPT.value,
        display_name="TypeScript (Node.js)",
        family=LanguageFamily.COMPILED,
        source_extension=".ts",
        filename="solution.ts",
        binary_filename="solution.js",
        compiler=_HOST_TSC,
        compiler_version=detect_toolchain_version(_HOST_TSC),
        compile_command=[_HOST_TSC, "--skipLibCheck", "--target", "ES2020", "--module", "commonjs", "solution.ts"],
        run_command=[_HOST_NODE, "solution.js"],
        compile_flags=["--skipLibCheck", "--target", "ES2020", "--module", "commonjs"],
        runtime=_HOST_NODE,
        runtime_arguments=[],
        default_time_limit=3.0,
        default_memory_limit=256,
        sandbox_profile="node-ts-v1",
        enabled=True,
        codebox_id=74,
        foreign_markers=_PYTHON_FOREIGN_MARKERS + _CPP_FOREIGN_MARKERS + _C_FOREIGN_MARKERS,
    ),
    Language.GO: LanguageConfig(
        language_id=Language.GO.value,
        display_name="Go",
        family=LanguageFamily.COMPILED,
        source_extension=".go",
        filename="main.go",
        binary_filename="solution",
        compiler=_HOST_GO,
        compiler_version=detect_toolchain_version(_HOST_GO),
        compile_command=[_HOST_GO, "build", "-o", "solution", "main.go"],
        run_command=["./solution"],
        compile_flags=["build"],
        runtime="./solution",
        runtime_arguments=[],
        default_time_limit=2.0,
        default_memory_limit=256,
        sandbox_profile="go-native-v1",
        enabled=True,
        codebox_id=60,
        foreign_markers=_PYTHON_FOREIGN_MARKERS + _JS_FOREIGN_MARKERS,
    ),
    Language.RUST: LanguageConfig(
        language_id=Language.RUST.value,
        display_name="Rust",
        family=LanguageFamily.COMPILED,
        source_extension=".rs",
        filename="solution.rs",
        binary_filename="solution",
        compiler=_HOST_RUSTC,
        compiler_version=detect_toolchain_version(_HOST_RUSTC),
        compile_command=[_HOST_RUSTC, "-O", "-o", "solution", "solution.rs"],
        run_command=["./solution"],
        compile_flags=["-O"],
        runtime="./solution",
        runtime_arguments=[],
        default_time_limit=2.0,
        default_memory_limit=256,
        sandbox_profile="rust-native-v1",
        enabled=True,
        codebox_id=73,
        foreign_markers=_PYTHON_FOREIGN_MARKERS + _JS_FOREIGN_MARKERS,
    ),
}

# 100% backward compatibility alias
LanguageDefinition = LanguageConfig
LANGUAGE_DEFINITIONS = LANGUAGE_CONFIGS


class LanguageRegistry:
    """Authoritative registry for language definitions, adapter resolution, and source isolation."""

    @classmethod
    def normalize(cls, lang_input: Any) -> Language:
        return normalize_language(lang_input)

    @classmethod
    def get(cls, lang_input: Any) -> LanguageConfig:
        lang = cls.normalize(lang_input)
        defn = LANGUAGE_CONFIGS.get(lang)
        if not defn:
            raise UnsupportedLanguageError(f"No LanguageDefinition registered for '{lang.value}'")
        return defn

    @classmethod
    def get_config(cls, lang_input: Any) -> LanguageConfig:
        return cls.get(lang_input)

    @classmethod
    def all_configs(cls) -> List[LanguageConfig]:
        return list(LANGUAGE_CONFIGS.values())

    @classmethod
    def resolve_strategy(cls, lang_input: Any) -> ExecutionStrategy:
        """Resolve and instantiate the proper ExecutionStrategy based on language family."""
        config = cls.get(lang_input)
        from app.engine.strategy.factory import get_strategy
        return get_strategy(config)

    @classmethod
    def get_adapter(cls, lang_input: Any) -> BaseLanguageAdapter:
        lang = cls.normalize(lang_input)
        from app.engine.adapters.python_adapter import PythonAdapter
        from app.engine.adapters.cpp_adapter import CppAdapter
        from app.engine.adapters.c_adapter import CAdapter
        from app.engine.adapters.java_adapter import JavaAdapter
        from app.engine.adapters.javascript_adapter import JavaScriptAdapter
        from app.engine.adapters.typescript_adapter import TypeScriptAdapter
        from app.engine.adapters.go_adapter import GoAdapter
        from app.engine.adapters.rust_adapter import RustAdapter

        adapters: Dict[Language, BaseLanguageAdapter] = {
            Language.PYTHON: PythonAdapter(),
            Language.CPP: CppAdapter(),
            Language.C: CAdapter(),
            Language.JAVA: JavaAdapter(),
            Language.JAVASCRIPT: JavaScriptAdapter(),
            Language.TYPESCRIPT: TypeScriptAdapter(),
            Language.GO: GoAdapter(),
            Language.RUST: RustAdapter(),
        }

        adapter = adapters.get(lang)
        if not adapter:
            raise UnsupportedLanguageError(f"No execution adapter available for language '{lang.value}'")
        return adapter

    @classmethod
    def validate_source(cls, lang_input: Any, source_code: str) -> None:
        """
        Guarantees language isolation by rejecting any source code that contains
        foreign driver markers belonging to other languages.
        """
        lang = cls.normalize(lang_input)
        defn = cls.get(lang)

        # Check for forbidden markers
        for marker in defn.foreign_markers:
            if marker in source_code:
                msg = (
                    f"Language Isolation Violation: {defn.display_name} source contains "
                    f"prohibited foreign driver token '{marker}'. Cross-language contamination blocked."
                )
                logger.error(msg)
                raise LanguageContaminationError(msg)
