"""Python 3 Executor"""
import sys
from app.engine.enums import Language
from app.engine.executors.base import BaseExecutor


class PythonExecutor(BaseExecutor):
    language = Language.PYTHON
    filename = "solution.py"
    compile_command = None
    # Use python executable (current virtualenv or system python3)
    run_command = [sys.executable, "solution.py"]
    requires_compile = False
