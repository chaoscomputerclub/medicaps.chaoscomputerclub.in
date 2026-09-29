"""
Chaos Computer Club — Authoritative Language Execution Registry & Definition System

Guarantees:
1. Strict type-safe language normalization (no silent fallback to Python).
2. Per-language immutable execution definitions (compilers, flags, runtimes, extensions).
3. Structural isolation assertions: detects and blocks foreign language drivers/tokens
   before compilation or execution ever takes place.
"""

from __future__ import annotations

import logging
import os
import re
import shutil
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Set, Tuple

if TYPE_CHECKING:
    from app.engine.adapters.base import BaseLanguageAdapter

logger = logging.getLogger("ccc.engine.languages")


class UnsupportedLanguageError(ValueError):
    """Raised when an unknown or unsupported programming language is requested."""
    pass


class LanguageContaminationError(RuntimeError):
    """Raised when foreign language syntax, drivers, or tokens contaminate generated source."""
    pass


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


@dataclass(frozen=True)
class LanguageDefinition:
    language: Language
    display_name: str
    source_extension: str
    filename: str
    binary_filename: Optional[str]
    requires_compile: bool
    compiler: Optional[str]
    compiler_arguments: List[str]
    runtime: str
    runtime_arguments: List[str]
    codebox_id: int
    foreign_markers: Tuple[str, ...]

    def get_compile_command(self, workspace: Path) -> Optional[List[str]]:
        if not self.requires_compile or not self.compiler:
            return None
        src = str(workspace / self.filename)
        bin_out = str(workspace / (self.binary_filename or "solution"))
        
        if self.language == Language.CPP:
            return [self.compiler, *self.compiler_arguments, src, "-o", bin_out]
        elif self.language == Language.C:
            return [self.compiler, *self.compiler_arguments, src, "-o", bin_out]
        elif self.language == Language.JAVA:
            return [self.compiler, *self.compiler_arguments, src]
        elif self.language == Language.TYPESCRIPT:
            return [self.compiler, *self.compiler_arguments, src]
        elif self.language == Language.GO:
            return [self.compiler, "build", "-o", bin_out, src]
        elif self.language == Language.RUST:
            return [self.compiler, *self.compiler_arguments, "-o", bin_out, src]
        return None

    def get_run_command(self, workspace: Path) -> List[str]:
        if self.requires_compile and self.binary_filename:
            bin_path = str(workspace / self.binary_filename)
            if self.language == Language.JAVA:
                # Java executes class Solution from workspace directory
                return [self.runtime, *self.runtime_arguments, "Solution"]
            return [bin_path, *self.runtime_arguments]
        
        src = str(workspace / self.filename)
        return [self.runtime, *self.runtime_arguments, src]


# Resolve host compilers with deterministic fallbacks
_HOST_GXX = shutil.which("g++") or shutil.which("clang++") or "g++"
_HOST_GCC = shutil.which("gcc") or shutil.which("clang") or "gcc"
_HOST_NODE = shutil.which("node") or "node"
_HOST_PYTHON = sys.executable or shutil.which("python3") or "python3"
_HOST_JAVAC = shutil.which("javac") or "javac"
_HOST_JAVA = shutil.which("java") or "java"


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


LANGUAGE_DEFINITIONS: Dict[Language, LanguageDefinition] = {
    Language.PYTHON: LanguageDefinition(
        language=Language.PYTHON,
        display_name="Python 3",
        source_extension=".py",
        filename="solution.py",
        binary_filename=None,
        requires_compile=False,
        compiler=None,
        compiler_arguments=[],
        runtime=_HOST_PYTHON,
        runtime_arguments=[],
        codebox_id=71,
        foreign_markers=_CPP_FOREIGN_MARKERS + _C_FOREIGN_MARKERS + _JS_FOREIGN_MARKERS,
    ),
    Language.CPP: LanguageDefinition(
        language=Language.CPP,
        display_name="C++ (GCC/Clang C++20)",
        source_extension=".cpp",
        filename="solution.cpp",
        binary_filename="solution",
        requires_compile=True,
        compiler=_HOST_GXX,
        compiler_arguments=["-O2", "-std=c++20"],
        runtime="./solution",
        runtime_arguments=[],
        codebox_id=54,
        foreign_markers=_PYTHON_FOREIGN_MARKERS + _JS_FOREIGN_MARKERS,
    ),
    Language.C: LanguageDefinition(
        language=Language.C,
        display_name="C (GCC/Clang C11)",
        source_extension=".c",
        filename="solution.c",
        binary_filename="solution",
        requires_compile=True,
        compiler=_HOST_GCC,
        compiler_arguments=["-O2", "-std=c11"],
        runtime="./solution",
        runtime_arguments=[],
        codebox_id=50,
        foreign_markers=_PYTHON_FOREIGN_MARKERS + _JS_FOREIGN_MARKERS,
    ),
    Language.JAVA: LanguageDefinition(
        language=Language.JAVA,
        display_name="Java (OpenJDK 17/21)",
        source_extension=".java",
        filename="Solution.java",
        binary_filename="Solution.class",
        requires_compile=True,
        compiler=_HOST_JAVAC,
        compiler_arguments=[],
        runtime=_HOST_JAVA,
        runtime_arguments=["-Xmx256m"],
        codebox_id=62,
        foreign_markers=_PYTHON_FOREIGN_MARKERS + _JS_FOREIGN_MARKERS,
    ),
    Language.JAVASCRIPT: LanguageDefinition(
        language=Language.JAVASCRIPT,
        display_name="JavaScript (Node.js)",
        source_extension=".js",
        filename="solution.js",
        binary_filename=None,
        requires_compile=False,
        compiler=None,
        compiler_arguments=[],
        runtime=_HOST_NODE,
        runtime_arguments=[],
        codebox_id=63,
        foreign_markers=_PYTHON_FOREIGN_MARKERS + _CPP_FOREIGN_MARKERS + _C_FOREIGN_MARKERS,
    ),
    Language.TYPESCRIPT: LanguageDefinition(
        language=Language.TYPESCRIPT,
        display_name="TypeScript (Node.js)",
        source_extension=".ts",
        filename="solution.ts",
        binary_filename="solution.js",
        requires_compile=True,
        compiler="tsc",
        compiler_arguments=["--skipLibCheck", "--target", "ES2020", "--module", "commonjs"],
        runtime=_HOST_NODE,
        runtime_arguments=[],
        codebox_id=74,
        foreign_markers=_PYTHON_FOREIGN_MARKERS + _CPP_FOREIGN_MARKERS + _C_FOREIGN_MARKERS,
    ),
}


class LanguageRegistry:
    """Authoritative registry for language definitions, adapter resolution, and source isolation."""

    @classmethod
    def normalize(cls, lang_input: Any) -> Language:
        return normalize_language(lang_input)

    @classmethod
    def get(cls, lang_input: Any) -> LanguageDefinition:
        lang = cls.normalize(lang_input)
        defn = LANGUAGE_DEFINITIONS.get(lang)
        if not defn:
            raise UnsupportedLanguageError(f"No LanguageDefinition registered for '{lang.value}'")
        return defn

    @classmethod
    def get_adapter(cls, lang_input: Any) -> BaseLanguageAdapter:
        lang = cls.normalize(lang_input)
        from app.engine.adapters.python_adapter import PythonAdapter
        from app.engine.adapters.cpp_adapter import CppAdapter
        from app.engine.adapters.c_adapter import CAdapter
        from app.engine.adapters.java_adapter import JavaAdapter
        from app.engine.adapters.javascript_adapter import JavaScriptAdapter
        from app.engine.adapters.typescript_adapter import TypeScriptAdapter

        adapters: Dict[Language, BaseLanguageAdapter] = {
            Language.PYTHON: PythonAdapter(),
            Language.CPP: CppAdapter(),
            Language.C: CAdapter(),
            Language.JAVA: JavaAdapter(),
            Language.JAVASCRIPT: JavaScriptAdapter(),
            Language.TYPESCRIPT: TypeScriptAdapter(),
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
