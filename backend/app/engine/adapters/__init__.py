"""
Chaos Computer Club — Language Adapter Registry & Factory
"""

from typing import Any
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.adapters.python_adapter import PythonAdapter
from app.engine.adapters.cpp_adapter import CppAdapter
from app.engine.adapters.c_adapter import CAdapter
from app.engine.adapters.java_adapter import JavaAdapter
from app.engine.adapters.javascript_adapter import JavaScriptAdapter
from app.engine.adapters.typescript_adapter import TypeScriptAdapter
from app.engine.adapters.evaluator import OutputEvaluator
from app.engine.languages import LanguageRegistry


def get_adapter(language: Any) -> BaseLanguageAdapter:
    """
    Resolve the appropriate language execution adapter through the authoritative LanguageRegistry.
    Guarantees strict language isolation and raises UnsupportedLanguageError if language is invalid.
    """
    return LanguageRegistry.get_adapter(language)


__all__ = [
    "BaseLanguageAdapter",
    "PythonAdapter",
    "CppAdapter",
    "CAdapter",
    "JavaAdapter",
    "JavaScriptAdapter",
    "TypeScriptAdapter",
    "OutputEvaluator",
    "get_adapter",
]


