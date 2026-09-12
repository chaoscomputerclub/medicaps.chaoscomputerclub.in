"""Executor Factory"""
from app.engine.enums import Language
from app.engine.executors.base import BaseExecutor
from app.engine.executors.python_executor import PythonExecutor
from app.engine.executors.cpp_executor import CppExecutor
from app.engine.executors.java_executor import JavaExecutor
from app.engine.executors.javascript_executor import JavaScriptExecutor

_EXECUTOR_MAP: dict[Language, type[BaseExecutor]] = {
    Language.PYTHON: PythonExecutor,
    Language.CPP: CppExecutor,
    Language.JAVA: JavaExecutor,
    Language.JAVASCRIPT: JavaScriptExecutor,
}

def get_executor(language: Language) -> BaseExecutor:
    executor_cls = _EXECUTOR_MAP.get(language)
    if not executor_cls:
        # Fallback to Python if unspecified
        executor_cls = PythonExecutor
    return executor_cls()
