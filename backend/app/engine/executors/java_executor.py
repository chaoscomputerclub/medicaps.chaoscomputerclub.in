"""Java Executor using javac & java"""
from app.engine.enums import Language
from app.engine.executors.base import BaseExecutor


class JavaExecutor(BaseExecutor):
    language = Language.JAVA
    filename = "Solution.java"
    compile_command = ["javac", "Solution.java"]
    run_command = ["java", "-Xmx256m", "Solution"]
    requires_compile = True
