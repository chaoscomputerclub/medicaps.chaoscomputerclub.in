"""JavaScript / Node.js Executor"""
import shutil
from app.engine.enums import Language
from app.engine.executors.base import BaseExecutor

node_bin = shutil.which("node") or "node"

class JavaScriptExecutor(BaseExecutor):
    language = Language.JAVASCRIPT
    filename = "solution.js"
    compile_command = None
    run_command = [node_bin, "solution.js"]
    requires_compile = False
