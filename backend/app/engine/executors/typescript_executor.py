"""
Chaos Computer Club — TypeScript Executor
Compiles solution.ts using tsc and executes generated solution.js with Node.js.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from app.engine.enums import Language
from app.engine.executors.base import BaseExecutor

node_bin = shutil.which("node") or "node"
tsc_bin = shutil.which("tsc")
if not tsc_bin:
    # Check project node_modules/.bin/tsc
    proj_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    local_tsc = proj_root / "node_modules/.bin/tsc"
    if local_tsc.exists():
        tsc_bin = str(local_tsc)
    else:
        tsc_bin = "tsc"


class TypeScriptExecutor(BaseExecutor):
    language = Language.TYPESCRIPT
    filename = "solution.ts"
    compile_command = [tsc_bin, "--skipLibCheck", "--target", "ES2020", "--module", "commonjs", "solution.ts"]
    run_command = [node_bin, "solution.js"]
    requires_compile = True
