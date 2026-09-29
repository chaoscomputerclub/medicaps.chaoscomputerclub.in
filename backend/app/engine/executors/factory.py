"""Executor Factory with Strict Language Isolation"""
from typing import Any
from app.engine.enums import Language
from app.engine.executors.base import BaseExecutor
from app.engine.executors.python_executor import PythonExecutor
from app.engine.executors.cpp_executor import CppExecutor
from app.engine.executors.c_executor import CExecutor
from app.engine.executors.java_executor import JavaExecutor
from app.engine.executors.javascript_executor import JavaScriptExecutor
from app.engine.languages import LanguageRegistry, UnsupportedLanguageError

_EXECUTOR_MAP: dict[Language, type[BaseExecutor]] = {
    Language.PYTHON: PythonExecutor,
    Language.CPP: CppExecutor,
    Language.C: CExecutor,
    Language.JAVA: JavaExecutor,
    Language.JAVASCRIPT: JavaScriptExecutor,
}


def get_executor(language: Any) -> BaseExecutor:
    """Resolve executor with strict language normalization. Never silently fallback to Python."""
    lang_enum = LanguageRegistry.normalize(language)
    executor_cls = _EXECUTOR_MAP.get(lang_enum)
    if not executor_cls:
        raise UnsupportedLanguageError(f"No native executor implemented for language: {lang_enum.value}")
    return executor_cls()

