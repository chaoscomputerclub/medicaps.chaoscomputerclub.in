"""
Chaos Computer Club — Judge & Scoring Logic
Ported directly from Interleet Judge Engine
"""

from __future__ import annotations

import json
import logging
import math
import re
from typing import Optional

from app.engine.enums import ComparisonMode, Verdict
from app.engine.schemas import (
    SandboxResult,
    ScoringResult,
    TestCaseResult,
    TestCaseSchema,
)

logger = logging.getLogger(__name__)
FLOAT_EPSILON = 1e-6


class JudgeEngine:
    """Evaluates sandbox execution output against expected outputs."""

    @staticmethod
    def evaluate(
        sandbox_result: SandboxResult,
        testcase: TestCaseSchema,
        compile_output: str = "",
        comparison_mode: ComparisonMode = ComparisonMode.TRIMMED,
    ) -> TestCaseResult:
        effective_mode = testcase.comparison_mode or comparison_mode

        display_stdout = sandbox_result.stdout
        if not testcase.hidden and not display_stdout.strip() and sandbox_result.exit_code != 0:
            display_stdout = "(no output produced)"

        result = TestCaseResult(
            testcase_id=testcase.id,
            name=testcase.name,
            hidden=testcase.hidden,
            category=testcase.category.value if testcase.category else None,
            stdout="" if testcase.hidden else display_stdout,
            expected_output="" if testcase.hidden else testcase.expected_output,
            stderr=sandbox_result.stderr,
            compile_output=compile_output,
            wall_time_ms=sandbox_result.wall_time_ms,
            runtime_ms=sandbox_result.wall_time_ms,
            peak_memory_mb=sandbox_result.peak_memory_mb,
            exit_code=sandbox_result.exit_code,
            weight=testcase.weight,
        )

        # 1. Check Memory Limit Exceeded
        if sandbox_result.oom_killed:
            result.verdict = Verdict.MEMORY_LIMIT_EXCEEDED
            result.passed = False
            return result

        # 2. Check Time Limit Exceeded
        if sandbox_result.timed_out:
            result.verdict = Verdict.TIME_LIMIT_EXCEEDED
            result.passed = False
            return result

        # 3. Check Compilation Error
        if compile_output and sandbox_result.exit_code != 0:
            result.verdict = Verdict.COMPILATION_ERROR
            result.passed = False
            return result

        # 4. Check Runtime Error
        if sandbox_result.exit_code != 0:
            result.verdict = Verdict.RUNTIME_ERROR
            result.passed = False
            return result

        # 5. Output comparison
        passed = JudgeEngine.compare(
            actual=sandbox_result.stdout,
            expected=testcase.expected_output,
            mode=effective_mode,
        )

        result.passed = passed
        result.verdict = Verdict.ACCEPTED if passed else Verdict.WRONG_ANSWER
        return result

    @staticmethod
    def compare(
        actual: str,
        expected: str,
        mode: ComparisonMode = ComparisonMode.TRIMMED,
    ) -> bool:
        """Layered output comparison pipeline with short-circuit evaluation."""
        if actual == expected:
            return True

        if mode == ComparisonMode.EXACT:
            return actual == expected

        if mode == ComparisonMode.TRIMMED:
            # Per-line trailing whitespace stripping and CRLF normalization
            act_lines = [l.rstrip() for l in actual.replace("\r\n", "\n").splitlines()]
            exp_lines = [l.rstrip() for l in expected.replace("\r\n", "\n").splitlines()]
            while act_lines and not act_lines[-1]:
                act_lines.pop()
            while exp_lines and not exp_lines[-1]:
                exp_lines.pop()
            if act_lines == exp_lines:
                return True

        # Token-based comparison (whitespace agnostic)
        act_tokens = actual.split()
        exp_tokens = expected.split()
        if act_tokens == exp_tokens:
            return True

        # Float tolerance comparison
        if mode == ComparisonMode.FLOAT or (len(act_tokens) == len(exp_tokens) and len(act_tokens) > 0):
            try:
                floats_match = True
                for a_tok, e_tok in zip(act_tokens, exp_tokens):
                    a_val, e_val = float(a_tok), float(e_tok)
                    if not (math.isclose(a_val, e_val, rel_tol=FLOAT_EPSILON, abs_tol=FLOAT_EPSILON)):
                        floats_match = False
                        break
                if floats_match:
                    return True
            except (ValueError, TypeError):
                pass

        # Semantic JSON comparison
        if mode == ComparisonMode.SEMANTIC:
            try:
                act_json = json.loads(actual.strip())
                exp_json = json.loads(expected.strip())
                if act_json == exp_json:
                    return True
            except Exception:
                pass

        return False

    @staticmethod
    def score(testcase_results: list[TestCaseResult]) -> ScoringResult:
        """Compute aggregate verdict and score for a submission."""
        if not testcase_results:
            return ScoringResult(
                verdict=Verdict.INTERNAL_ERROR,
                score=0.0,
                passed=0,
                total=0,
            )

        total = len(testcase_results)
        passed = sum(1 for r in testcase_results if r.passed)
        max_time = max((r.wall_time_ms for r in testcase_results), default=0.0)
        max_mem = max((r.peak_memory_mb for r in testcase_results), default=0.0)

        # Priority of failure verdicts
        verdict_priority = [
            Verdict.COMPILATION_ERROR,
            Verdict.TIME_LIMIT_EXCEEDED,
            Verdict.MEMORY_LIMIT_EXCEEDED,
            Verdict.RUNTIME_ERROR,
            Verdict.WRONG_ANSWER,
            Verdict.INTERNAL_ERROR,
        ]

        final_verdict = Verdict.ACCEPTED
        if passed < total:
            # Pick highest-priority failure verdict
            failed_verdicts = {r.verdict for r in testcase_results if not r.passed}
            for v in verdict_priority:
                if v in failed_verdicts:
                    final_verdict = v
                    break

        total_weight = sum(r.weight for r in testcase_results) or float(total)
        earned_weight = sum(r.weight for r in testcase_results if r.passed)
        score = round((earned_weight / total_weight) * 100.0, 2)

        return ScoringResult(
            verdict=final_verdict,
            score=score,
            passed=passed,
            total=total,
            max_time_ms=round(max_time, 2),
            max_memory_mb=round(max_mem, 2),
        )
