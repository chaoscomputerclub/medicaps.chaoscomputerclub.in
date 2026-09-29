"""Java Executor using javac & java"""
from app.engine.enums import Language
from app.engine.executors.base import BaseExecutor


class JavaExecutor(BaseExecutor):
    language = Language.JAVA
    filename = "Main.java"
    compile_command = ["javac", "Main.java"]
    run_command = ["java", "-Xmx256m", "Main"]
    requires_compile = True
