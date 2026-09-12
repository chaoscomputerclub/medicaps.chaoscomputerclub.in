"""C++ Executor using g++ or clang++"""
import shutil
from app.engine.enums import Language
from app.engine.executors.base import BaseExecutor

c_compiler = shutil.which("g++") or shutil.which("clang++") or "g++"

class CppExecutor(BaseExecutor):
    language = Language.CPP
    filename = "solution.cpp"
    compile_command = [c_compiler, "-O2", "-std=c++20", "solution.cpp", "-o", "solution"]
    run_command = ["./solution"]
    requires_compile = True
