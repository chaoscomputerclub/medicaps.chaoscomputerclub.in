"""
Chaos Computer Club — C Executor
Compiles C code using gcc or clang with C11 standard and executes the native binary in an isolated workspace.
"""
from __future__ import annotations

import shutil
from app.engine.enums import Language
from app.engine.executors.base import BaseExecutor

_c_compiler = shutil.which("gcc") or shutil.which("clang") or "gcc"


class CExecutor(BaseExecutor):
    language = Language.C
    filename = "solution.c"
    compile_command = [_c_compiler, "-O2", "-std=c11", "solution.c", "-o", "solution"]
    run_command = ["./solution"]
    requires_compile = True
