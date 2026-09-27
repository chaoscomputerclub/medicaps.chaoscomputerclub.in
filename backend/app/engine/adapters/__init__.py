"""
Chaos Computer Club — Language Adapter Registry & Factory
"""

from typing import Dict, Type
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.adapters.python_adapter import PythonAdapter
from app.engine.adapters.cpp_adapter import CppAdapter
from app.engine.adapters.c_adapter import CAdapter
from app.engine.adapters.java_adapter import JavaAdapter
from app.engine.adapters.javascript_adapter import JavaScriptAdapter
from app.engine.adapters.typescript_adapter import TypeScriptAdapter
from app.engine.adapters.evaluator import OutputEvaluator

_ADAPTERS: Dict[str, BaseLanguageAdapter] = {
    # Python 3
    "python": PythonAdapter(),
    "py": PythonAdapter(),
    "python3": PythonAdapter(),
    # C++
    "cpp": CppAdapter(),
    "c++": CppAdapter(),
    "cxx": CppAdapter(),
    # C
    "c": CAdapter(),
    "gcc": CAdapter(),
    # Java
    "java": JavaAdapter(),
    "openjdk": JavaAdapter(),
    # JavaScript
    "javascript": JavaScriptAdapter(),
    "js": JavaScriptAdapter(),
    "node": JavaScriptAdapter(),
    "nodejs": JavaScriptAdapter(),
    # TypeScript
    "typescript": TypeScriptAdapter(),
    "ts": TypeScriptAdapter(),
}


def get_adapter(language: str) -> BaseLanguageAdapter:
    """Resolve the appropriate language execution adapter with instant O(1) lookup."""
    lang_key = (language or "").lower().strip()
    adapter = _ADAPTERS.get(lang_key)
    if not adapter:
        # Fallback to Python if unrecognized
        return _ADAPTERS["python"]
    return adapter


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

