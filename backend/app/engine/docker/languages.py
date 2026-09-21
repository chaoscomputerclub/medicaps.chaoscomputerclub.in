"""
Language configurations and execution profiles for the Core Docker Engine.
Specifies container images, filenames, compilation routines, and run commands.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

from app.engine.enums import Language


@dataclass(frozen=True)
class LanguageSpec:
    language: Language
    image: str
    filename: str
    requires_compile: bool
    compile_command: Optional[list[str]]
    run_command: str  # Shell command inside workdir with '< stdin.txt'


LANGUAGE_SPECS: Dict[Language, LanguageSpec] = {
    Language.PYTHON: LanguageSpec(
        language=Language.PYTHON,
        image="interleet-python:latest",
        filename="solution.py",
        requires_compile=False,
        compile_command=None,
        run_command="python3 solution.py < stdin.txt",
    ),
    Language.CPP: LanguageSpec(
        language=Language.CPP,
        image="interleet-cpp:latest",
        filename="solution.cpp",
        requires_compile=True,
        compile_command=["sh", "-c", "g++ -O2 -std=c++17 -o solution solution.cpp 2>&1"],
        run_command="./solution < stdin.txt",
    ),
    Language.C: LanguageSpec(
        language=Language.C,
        image="interleet-cpp:latest",
        filename="solution.c",
        requires_compile=True,
        compile_command=["sh", "-c", "gcc -O2 -std=c11 -o solution solution.c 2>&1"],
        run_command="./solution < stdin.txt",
    ),
    Language.JAVA: LanguageSpec(
        language=Language.JAVA,
        image="interleet-java:latest",
        filename="Solution.java",
        requires_compile=True,
        compile_command=["sh", "-c", "javac Solution.java 2>&1"],
        run_command="java -Xmx200m -Xss64m Solution < stdin.txt",
    ),
    Language.JAVASCRIPT: LanguageSpec(
        language=Language.JAVASCRIPT,
        image="interleet-node:latest",
        filename="solution.js",
        requires_compile=False,
        compile_command=None,
        run_command="node solution.js < stdin.txt",
    ),
    Language.TYPESCRIPT: LanguageSpec(
        language=Language.TYPESCRIPT,
        image="interleet-typescript:latest",
        filename="solution.ts",
        requires_compile=True,
        compile_command=[
            "sh",
            "-c",
            "tsc --skipLibCheck --typeRoots /node_modules/@types --types node --target ES2020 --module commonjs solution.ts 2>&1",
        ],
        run_command="node solution.js < stdin.txt",
    ),
    Language.GO: LanguageSpec(
        language=Language.GO,
        image="interleet-go:latest",
        filename="solution.go",
        requires_compile=True,
        compile_command=["sh", "-c", "go build -o solution solution.go 2>&1"],
        run_command="./solution < stdin.txt",
    ),
    Language.RUST: LanguageSpec(
        language=Language.RUST,
        image="interleet-rust:latest",
        filename="solution.rs",
        requires_compile=True,
        compile_command=["sh", "-c", "rustc -O -o solution solution.rs 2>&1"],
        run_command="./solution < stdin.txt",
    ),
}

# Alias map to handle variants like 'python3', 'c++', 'js', 'golang'
ALIAS_MAP: Dict[str, Language] = {
    "python": Language.PYTHON,
    "python3": Language.PYTHON,
    "py": Language.PYTHON,
    "cpp": Language.CPP,
    "c++": Language.CPP,
    "c": Language.C,
    "java": Language.JAVA,
    "javascript": Language.JAVASCRIPT,
    "js": Language.JAVASCRIPT,
    "node": Language.JAVASCRIPT,
    "typescript": Language.TYPESCRIPT,
    "ts": Language.TYPESCRIPT,
    "go": Language.GO,
    "golang": Language.GO,
    "rust": Language.RUST,
    "rs": Language.RUST,
}


def get_language_spec(language: Language | str) -> LanguageSpec:
    """Retrieve LanguageSpec for a given language name or enum value."""
    if isinstance(language, Language):
        return LANGUAGE_SPECS.get(language, LANGUAGE_SPECS[Language.PYTHON])

    lang_lower = str(language).strip().lower()
    enum_val = ALIAS_MAP.get(lang_lower, Language.PYTHON)
    return LANGUAGE_SPECS.get(enum_val, LANGUAGE_SPECS[Language.PYTHON])
