"""
Chaos Computer Club — Medi-Caps Chapter
engine/providers/distributed_provider.py — Self-Adapting Distributed Fabric Provider

Dispatches execution jobs to the distributed queue (ccc:queue:judge:pending) where
portable compute nodes (e.g. cadet laptops, lab PCs running Go node-agent) claim
and execute them inside in-memory RAM Docker sandboxes.

Automatically falls back to local in-process DockerSandboxProvider if no compute
nodes are registered or if remote execution times out.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, List, Optional
from uuid import uuid4

from app.core.config import settings
from app.core.redis import get_redis
from app.engine.enums import ComparisonMode, ExecutionStatus, Language, Verdict
from app.engine.schemas import ExecutionResult, TestCaseResult, TestCaseSchema
from .base import JudgeProvider, ProviderRunRequest, ProviderRunResult
from .docker_provider import DockerSandboxProvider

logger = logging.getLogger("ccc.judge.distributed")


class DistributedFabricProvider(JudgeProvider):
    name = "distributed"

    def __init__(self, fallback_provider: Optional[JudgeProvider] = None) -> None:
        self._fallback = fallback_provider or DockerSandboxProvider()

    async def healthy(self) -> bool:
        """Healthy if either distributed nodes exist or fallback engine is healthy."""
        try:
            redis = get_redis()
            nodes = await redis.smembers("ccc:nodes:registered")
            for nid in nodes:
                raw_id = nid.decode() if isinstance(nid, bytes) else str(nid)
                if await redis.exists(f"ccc:node:{raw_id}:heartbeat"):
                    return True
        except Exception:
            pass
        return await self._fallback.healthy()

    async def run(self, request: ProviderRunRequest) -> ProviderRunResult:
        """Single testcase run fallback."""
        return await self._fallback.run(request)

    async def execute_batch(
        self,
        language: str | Any,
        code: str,
        testcases: list[Any],
        time_limit: float = 5.0,
        memory_limit_mb: int = 256,
        comparison_mode: Any = None,
    ) -> ExecutionResult:
        """
        Executes a batch of testcases via the distributed compute fabric if nodes
        are available, else transparently falls back to local Docker engine.
        """
        redis = get_redis()
        online_nodes = await self._get_active_nodes(redis)

        if not online_nodes:
            logger.info("ℹ️ No active distributed nodes in fabric — executing on local Cloud Docker engine.")
            return await self._fallback.execute_batch(
                language=language,
                code=code,
                testcases=testcases,
                time_limit=time_limit,
                memory_limit_mb=memory_limit_mb,
                comparison_mode=comparison_mode,
            )

        # Active compute nodes exist (e.g. laptop connected via USB)
        job_id = str(uuid4())
        lang_str = language.value if hasattr(language, "value") else str(language)

        serialized_tcs = []
        for i, tc in enumerate(testcases):
            tc_id = getattr(tc, "id", f"tc_{i+1}")
            stdin_val = getattr(tc, "stdin", "")
            exp_val = getattr(tc, "expected_output", "")
            clean_exp = str(exp_val)
            s_trimmed = clean_exp.strip()
            if s_trimmed.startswith('"') and s_trimmed.endswith('"') and len(s_trimmed) >= 2:
                try:
                    clean_exp = json.loads(s_trimmed)
                except Exception:
                    clean_exp = s_trimmed[1:-1]
            serialized_tcs.append({
                "id": str(tc_id),
                "stdin": str(stdin_val),
                "expected_output": clean_exp,
            })

        from app.engine.languages import LanguageRegistry
        import hashlib
        config = LanguageRegistry.get_config(lang_str)
        source_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()

        job_payload = {
            "id": job_id,
            "status": "QUEUED",
            "queue_name": "judge",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "language": lang_str,
                "language_id": config.language_id,
                "execution_mode": config.family.value,
                "compile_required": config.requires_compile,
                "compile_timeout": 10.0,
                "execution_timeout": float(time_limit),
                "source_hash": source_hash,
                "toolchain_hash": config.compiler_version or "default",
                "code": code,
                "time_limit_ms": float(time_limit * 1000.0),
                "memory_limit_mb": int(memory_limit_mb),
                "cpu_limit": 1.0,
                "testcase_count": len(serialized_tcs),
                "testcases": serialized_tcs,
            },
        }

        # 1. Enqueue job into distributed fabric queue and language-partitioned queue
        await redis.set(f"ccc:job:{job_id}", json.dumps(job_payload), ex=86400)
        await redis.rpush(f"ccc:queue:fabric:pending:{lang_str}", job_id)
        await redis.rpush("ccc:queue:fabric:pending", job_id)

        logger.info(
            "⚡ [Fabric] Job %s (mode=%s, compile=%s) enqueued to distributed queue (Active Nodes: %s, Lang: %s, Testcases: %d)",
            job_id, config.family.value, config.requires_compile, ", ".join(online_nodes), lang_str, len(serialized_tcs)
        )

        # 2. Await remote node execution via Redis Pub/Sub event with Authoritative Fallback
        q_depth = await redis.llen("ccc:queue:fabric:pending")
        wait_timeout = max(35.0, float(time_limit * len(testcases)) + float(q_depth * 1.5) + 15.0)
        start_wait = time.time()
        channel_name = f"ccc:job:{job_id}:done"

        pubsub = redis.pubsub()
        await pubsub.subscribe(channel_name)

        completed_result: Optional[ExecutionResult] = None

        try:
            while time.time() - start_wait < wait_timeout:
                # 1. Authoritative check: verify if job is marked COMPLETED in Redis
                raw_job = await redis.get(f"ccc:job:{job_id}")
                if raw_job:
                    job_data = json.loads(raw_job)
                    if job_data.get("status") == "COMPLETED" and "result" in job_data:
                        res_dict = job_data["result"]
                        raw_tc_list = res_dict.get("testcase_results", [])
                        node_verdict = res_dict.get("verdict", "")

                        # If the node reported a definitive compilation error or internal failure,
                        # testcase_results is expected to be empty. Accept it directly as the authoritative verdict.
                        if node_verdict in ("COMPILATION_ERROR", "INTERNAL_ERROR") or bool(res_dict.get("compile_output")):
                            logger.info(
                                "✓ [Fabric] Job %s reported definitive verdict '%s' from node %s",
                                job_id, node_verdict, job_data.get("claimed_by_node")
                            )
                            completed_result = self._format_execution_result(res_dict, testcases, job_id)
                            break

                        if len(raw_tc_list) < len(testcases):
                            logger.warning(
                                "⚠️ [Fabric] Remote node %s returned partial testcases (%d/%d) for job %s. Falling back to local engine.",
                                job_data.get("claimed_by_node"), len(raw_tc_list), len(testcases), job_id
                            )
                            break
                        logger.info("✓ [Fabric] Job %s executed remotely on compute node %s (0ms event wakeup)", job_id, job_data.get("claimed_by_node"))
                        completed_result = self._format_execution_result(res_dict, testcases, job_id)
                        break

                # 2. Event-driven wakeup: wait on pubsub message up to remaining timeout (capped at 1.0s slices for liveness)
                remaining = wait_timeout - (time.time() - start_wait)
                if remaining <= 0:
                    break
                slice_timeout = min(1.0, remaining)
                try:
                    msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=slice_timeout)
                    if msg and msg.get("type") == "message":
                        # Event received! Loop back to perform authoritative read from Redis state immediately
                        continue
                except Exception as p_err:
                    logger.debug("Pubsub get_message notice: %s", p_err)
                    await asyncio.sleep(0.05)

        finally:
            try:
                await pubsub.unsubscribe(channel_name)
                await pubsub.aclose()
            except Exception:
                pass

        if completed_result:
            return completed_result

        # Timeout reached: reclaim job from queue and fall back
        logger.warning("⚠️ [Fabric] Remote execution timed out for job %s. Falling back to local engine.", job_id)
        await redis.lrem("ccc:queue:fabric:pending", 1, job_id)
        await redis.lrem("ccc:queue:fabric:processing", 1, job_id)

        return await self._fallback.execute_batch(
            language=language,
            code=code,
            testcases=testcases,
            time_limit=time_limit,
            memory_limit_mb=memory_limit_mb,
            comparison_mode=comparison_mode,
        )

    async def _get_active_nodes(self, redis: Any) -> List[str]:
        """Returns list of node IDs whose heartbeats are currently active."""
        node_ids = await redis.smembers("ccc:nodes:registered")
        active = []
        for nid in node_ids:
            raw_id = nid.decode() if isinstance(nid, bytes) else str(nid)
            is_alive = await redis.exists(f"ccc:node:{raw_id}:heartbeat")
            if is_alive:
                active.append(raw_id)
        return active

    def _format_execution_result(
        self, res_dict: Optional[dict], testcases: list[Any], job_id: str
    ) -> ExecutionResult:
        """Converts node JSON result into typed ExecutionResult schema."""
        if not res_dict or not isinstance(res_dict, dict):
            return ExecutionResult(
                success=False,
                submission_id=job_id,
                status=ExecutionStatus.FAILED,
                verdict=Verdict.SYSTEM_ERROR,
                failure_code="EXECUTION_RESULT_MISSING",
                error="Execution result missing from runner",
                testcase_results=[],
                passed_testcases=0,
                total_testcases=len(testcases),
            )

        raw_verdict = res_dict.get("verdict", "SYSTEM_ERROR")
        try:
            enum_verdict = Verdict(raw_verdict)
        except Exception:
            enum_verdict = Verdict.SYSTEM_ERROR

        # Handle Compilation Error explicitly
        if enum_verdict == Verdict.COMPILATION_ERROR:
            comp_out = res_dict.get("compile_output") or res_dict.get("error") or ""
            not_exec_tcs = [
                TestCaseResult(
                    testcase_id=str(getattr(tc, "id", f"tc_{i+1}")),
                    name=getattr(tc, "name", None),
                    hidden=getattr(tc, "hidden", False),
                    passed=False,
                    verdict=Verdict.NOT_EXECUTED,
                    compile_output=comp_out,
                )
                for i, tc in enumerate(testcases)
            ]
            return ExecutionResult(
                success=False,
                submission_id=job_id,
                status=ExecutionStatus.COMPLETED,
                verdict=Verdict.COMPILATION_ERROR,
                compile_output=comp_out,
                testcase_results=not_exec_tcs,
                passed_testcases=0,
                total_testcases=len(testcases),
                compile_time_ms=float(res_dict.get("compile_time_ms", 0.0)),
            )

        tc_results = []
        passed_count = 0
        raw_tc_list = res_dict.get("testcase_results", [])

        for i, r in enumerate(raw_tc_list):
            v_str = r.get("verdict", "SYSTEM_ERROR")
            try:
                tc_verdict = Verdict(v_str)
            except Exception:
                tc_verdict = Verdict.SYSTEM_ERROR

            passed = bool(r.get("passed", False))
            if passed:
                passed_count += 1

            tc_id = r.get("testcase_id") or (testcases[i].id if i < len(testcases) else f"tc_{i+1}")
            tc_results.append(
                TestCaseResult(
                    testcase_id=str(tc_id),
                    name=getattr(testcases[i], "name", None) if i < len(testcases) else None,
                    hidden=getattr(testcases[i], "hidden", False) if i < len(testcases) else False,
                    passed=passed,
                    verdict=tc_verdict,
                    stdout=r.get("stdout", ""),
                    expected_output=r.get("expected_output", ""),
                    stderr=r.get("stderr", ""),
                    compile_output=r.get("compile_output") or "",
                    wall_time_ms=float(r.get("wall_time_ms", 0.0)),
                    runtime_ms=float(r.get("wall_time_ms", 0.0)),
                )
            )

        total_tcs = len(tc_results) if tc_results else len(testcases)
        all_passed = (passed_count == total_tcs) and total_tcs > 0

        total_tc_cpu = sum(r.runtime_ms for r in tc_results)
        max_tc_wall = float(res_dict.get("runtime_ms", 0.0))
        compile_ms = float(res_dict.get("compile_time_ms", 0.0))

        return ExecutionResult(
            success=all_passed,
            submission_id=job_id,
            status=ExecutionStatus.COMPLETED,
            verdict=enum_verdict if not all_passed else Verdict.ACCEPTED,
            testcase_results=tc_results,
            passed_testcases=passed_count,
            total_testcases=total_tcs,
            time=max_tc_wall / 1000.0,
            compile_time_ms=compile_ms,
            execution_time_ms=total_tc_cpu,
            execution_cpu_ms=total_tc_cpu,
            execution_wall_ms=max_tc_wall,
            provider_turnaround_ms=compile_ms + max_tc_wall,
            memory=float(res_dict.get("memory_mb", 0.0)),
            compile_output=res_dict.get("compile_output") or "",
            error=res_dict.get("error"),
        )
