"""
Chaos Computer Club — Google Cloud Run Isolated Multi-Language Judge Service
FastAPI-based Judge0 / Codebox compatible code execution engine.
Designed specifically for Google Cloud Run (gVisor microVM isolation).
"""

import asyncio
import os
import resource
import shutil
import tempfile
import time
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="CCC Cloud Run Judge Service",
    version="1.0.11",
    description="High-performance, isolated multi-language code evaluation runner for competitive programming."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Judge0 Standard Language IDs
LANGUAGES = {
    50: {"name": "C (GCC 13.2.0)", "ext": "c", "compile": "gcc -O3 -std=c11 {src} -o {bin} -lm", "run": "{bin}"},
    54: {"name": "C++ (G++ 13.2.0)", "ext": "cpp", "compile": "g++ -O3 -std=c++20 {src} -o {bin} -lm", "run": "{bin}"},
    62: {"name": "Java (OpenJDK 21)", "ext": "java", "compile": "javac -d . {src}", "run": "java -Xmx{mem}M Solution"},
    63: {"name": "JavaScript (Node.js 20)", "ext": "js", "compile": None, "run": "node {src}"},
    71: {"name": "Python (3.12)", "ext": "py", "compile": None, "run": "python3 {src}"},
    74: {"name": "TypeScript (Node.js 20)", "ext": "ts", "compile": "npx -y tsc --target es2022 --module commonjs {src} --outFile {bin}", "run": "node {bin}"},
}

# Status IDs
STATUS_ACCEPTED = 3
STATUS_WRONG_ANSWER = 4
STATUS_TIME_LIMIT_EXCEEDED = 5
STATUS_COMPILATION_ERROR = 6
STATUS_RUNTIME_ERROR = 7
STATUS_INTERNAL_ERROR = 13

# In-memory result cache for polled tokens
RESULT_STORE: Dict[str, Dict[str, Any]] = {}


class SubmissionRequest(BaseModel):
    source_code: Optional[str] = None
    code: Optional[str] = None
    language_id: Optional[int] = None
    language: Optional[str] = None
    stdin: Optional[str] = ""
    expected_output: Optional[str] = None
    cpu_time_limit: Optional[float] = Field(default=2.0, ge=0.1, le=15.0)
    memory_limit: Optional[int] = Field(default=262144, ge=1024, le=524288)  # in KB
    base64_encoded: Optional[bool] = False


class BatchSubmissionRequest(BaseModel):
    submissions: List[SubmissionRequest]


def resolve_language_id(req: SubmissionRequest) -> int:
    if req.language_id and req.language_id in LANGUAGES:
        return req.language_id
    if req.language:
        l = str(req.language).strip().lower()
        mapping = {
            "c": 50,
            "cpp": 54, "c++": 54, "cxx": 54,
            "java": 62,
            "javascript": 63, "js": 63, "node": 63, "nodejs": 63,
            "python": 71, "python3": 71, "py": 71,
            "typescript": 74, "ts": 74,
        }
        if l in mapping:
            return mapping[l]
    return req.language_id or 71


def set_sandbox_limits(time_limit_s: float, mem_limit_kb: int):
    """Apply Linux resource limits to child process before exec."""
    try:
        # Max CPU seconds (hard limit + 1s to allow SIGKILL)
        cpu_sec = int(time_limit_s) + 1
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_sec, cpu_sec + 1))
        
        # Max Output size (2MB guard against disk/pipe flooding)
        resource.setrlimit(resource.RLIMIT_FSIZE, (2 * 1024 * 1024, 2 * 1024 * 1024))
        
        # Limit max child processes to prevent fork-bombs
        resource.setrlimit(resource.RLIMIT_NPROC, (100, 100))
    except Exception:
        pass


async def run_single_submission(sub: SubmissionRequest) -> Dict[str, Any]:
    token = str(uuid4())
    lang_id = resolve_language_id(sub)
    lang_info = LANGUAGES.get(lang_id)
    raw_code = sub.source_code or sub.code or ""

    if sub.base64_encoded and raw_code:
        import base64
        try:
            raw_code = base64.b64decode(raw_code).decode("utf-8", errors="replace")
        except Exception:
            pass

    if not lang_info or not raw_code:
        err_desc = "Empty source code" if not raw_code else f"Unsupported language ID: {lang_id}"
        res = {
            "token": token,
            "status": {"id": STATUS_INTERNAL_ERROR, "description": err_desc},
            "compile_output": err_desc,
            "stdout": "",
            "stderr": "",
            "time": 0.0,
            "wall_time": 0.0,
            "memory": 0,
            "exit_code": 1,
        }
        RESULT_STORE[token] = res
        return res

    work_dir = tempfile.mkdtemp(prefix="judge_")
    time_limit = sub.cpu_time_limit or 2.0
    mem_limit_mb = int((sub.memory_limit or 262144) / 1024)

    try:
        # 1. Determine filename (dynamic for Java, Solution.* for others)
        main_class = "Solution"
        if lang_id == 62:
            import re
            m = re.search(r"(?:public\s+)?class\s+([A-Za-z0-9_]+)", raw_code)
            if m:
                main_class = m.group(1)
            filename = f"{main_class}.java"
        else:
            filename = f"Solution.{lang_info['ext']}"

        src_path = os.path.join(work_dir, filename)
        bin_path = os.path.join(work_dir, "solution")

        with open(src_path, "w", encoding="utf-8") as f:
            f.write(raw_code)

        # 2. Compile stage if needed
        compile_out = ""
        if lang_info["compile"]:
            compile_cmd = lang_info["compile"].format(src=src_path, bin=bin_path)
            comp_t0 = time.perf_counter()
            comp_proc = await asyncio.create_subprocess_shell(
                compile_cmd,
                cwd=work_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            try:
                c_stdout, c_stderr = await asyncio.wait_for(comp_proc.communicate(), timeout=15.0)
                if comp_proc.returncode != 0:
                    compile_out = (c_stderr.decode("utf-8", errors="replace") + "\n" + c_stdout.decode("utf-8", errors="replace")).strip()
                    res = {
                        "token": token,
                        "status": {"id": STATUS_COMPILATION_ERROR, "description": "Compilation Error"},
                        "compile_output": compile_out,
                        "stdout": "",
                        "stderr": compile_out,
                        "time": round(time.perf_counter() - comp_t0, 3),
                        "wall_time": round(time.perf_counter() - comp_t0, 3),
                        "memory": 0,
                        "exit_code": comp_proc.returncode,
                    }
                    RESULT_STORE[token] = res
                    return res
            except asyncio.TimeoutError:
                comp_proc.kill()
                res = {
                    "token": token,
                    "status": {"id": STATUS_COMPILATION_ERROR, "description": "Compilation Timeout"},
                    "compile_output": "Compilation timed out after 15.0s.",
                    "stdout": "",
                    "stderr": "Compilation timed out.",
                    "time": 15.0,
                    "wall_time": 15.0,
                    "memory": 0,
                    "exit_code": 1,
                }
                RESULT_STORE[token] = res
                return res

        # 3. Execution stage
        run_cmd = lang_info["run"].format(src=src_path, bin=bin_path, mem=mem_limit_mb)
        t_start = time.perf_counter()

        proc = await asyncio.create_subprocess_shell(
            run_cmd,
            cwd=work_dir,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            preexec_fn=lambda: set_sandbox_limits(time_limit, sub.memory_limit or 262144)
        )

        stdin_data = (sub.stdin or "").encode("utf-8")
        try:
            p_stdout, p_stderr = await asyncio.wait_for(proc.communicate(input=stdin_data), timeout=time_limit + 1.0)
            elapsed_wall = time.perf_counter() - t_start
            stdout_str = p_stdout.decode("utf-8", errors="replace")[:65536]
            stderr_str = p_stderr.decode("utf-8", errors="replace")[:65536]
            exit_code = proc.returncode

            if exit_code == 0:
                # Output matching
                if sub.expected_output is not None:
                    is_correct = stdout_str.strip() == sub.expected_output.strip()
                    status_id = STATUS_ACCEPTED if is_correct else STATUS_WRONG_ANSWER
                    desc = "Accepted" if is_correct else "Wrong Answer"
                else:
                    status_id = STATUS_ACCEPTED
                    desc = "Accepted"
            elif exit_code in (-9, 137, -15, 124):
                status_id = STATUS_TIME_LIMIT_EXCEEDED
                desc = "Time Limit Exceeded"
            else:
                status_id = STATUS_RUNTIME_ERROR
                desc = f"Runtime Error (Exit code {exit_code})"

            res = {
                "token": token,
                "status": {"id": status_id, "description": desc},
                "stdout": stdout_str,
                "stderr": stderr_str,
                "compile_output": "",
                "time": round(min(elapsed_wall, time_limit), 3),
                "wall_time": round(elapsed_wall, 3),
                "memory": 16384,  # Estimated baseline footprint in KB
                "exit_code": exit_code,
            }
        except asyncio.TimeoutError:
            try:
                proc.kill()
            except Exception:
                pass
            res = {
                "token": token,
                "status": {"id": STATUS_TIME_LIMIT_EXCEEDED, "description": "Time Limit Exceeded"},
                "stdout": "",
                "stderr": "Execution timed out.",
                "compile_output": "",
                "time": time_limit,
                "wall_time": round(time.perf_counter() - t_start, 3),
                "memory": 0,
                "exit_code": 124,
            }

        RESULT_STORE[token] = res
        return res

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@app.get("/")
@app.get("/health")
@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "service": "ccc-judge-service",
        "version": "1.0.13",
        "languages": list(LANGUAGES.keys()),
        "uptime": os.times()[4]
    }


@app.get("/languages")
async def get_languages():
    return [{"id": k, "name": v["name"]} for k, v in LANGUAGES.items()]


@app.post("/submissions")
async def create_submission(sub: SubmissionRequest, wait: Optional[bool] = Query(default=True)):
    if wait:
        return await run_single_submission(sub)
    else:
        token = str(uuid4())
        # Async background execution
        asyncio.create_task(run_single_submission(sub))
        return {"token": token, "status": {"id": 1, "description": "In Queue"}}


@app.get("/submissions/{token}")
async def get_submission(token: str):
    res = RESULT_STORE.get(token)
    if not res:
        raise HTTPException(status_code=404, detail="Submission token not found")
    return res


@app.post("/submissions/batch")
async def create_batch_submissions(batch: BatchSubmissionRequest):
    tasks = [run_single_submission(sub) for sub in batch.submissions]
    results = await asyncio.gather(*tasks)
    return results


@app.post("/execute")
async def execute(sub: SubmissionRequest):
    return await run_single_submission(sub)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, log_level="info")
