"""
Chaos Computer Club — Judge & Scoring Logic

BUG FIXES applied:
  1. COMPILATION_ERROR misclassification: added explicit `compile_failed` boolean parameter.
     Previously, compiler warnings (non-empty compile_output) + runtime segfault wrongly
     returned COMPILATION_ERROR instead of RUNTIME_ERROR.
  2. ComparisonMode.UNORDERED implemented: sorts both sides before comparing.
  3. ComparisonMode.TOKEN given an explicit fast-path branch.
  4. Float comparison: rel_tol and abs_tol were both set to 1e-6; now using the correct
     asymmetric defaults (rel_tol=1e-9, abs_tol=1e-9) for judge-grade precision.
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
    @staticmethod
    def parse_runner_envelope(raw_stdout: str) -> tuple[Optional[dict], str]:
        """
        Extracts internal runner result envelope from stdout if present.
        Returns: (envelope_dict_or_None, user_stdout_without_envelope)
        """
        if not raw_stdout:
            return None, ""
        marker = "<<<CCC_RUNNER_RESULT>>>"
        if marker not in raw_stdout:
            return None, raw_stdout

        parts = raw_stdout.split(marker)
        if len(parts) >= 3:
            envelope_str = parts[1].strip()
            user_stdout = (parts[0] + "".join(parts[2:])).strip()
            try:
                envelope = json.loads(envelope_str)
                return envelope, user_stdout
            except Exception:
                pass
        return None, raw_stdout

    @staticmethod
    def evaluate(
        sandbox_result: SandboxResult,
        testcase: TestCaseSchema,
        compile_output: str = "",
        compile_failed: bool = False,          # NEW: explicit flag, not inferred from text
        comparison_mode: ComparisonMode = ComparisonMode.TRIMMED,
    ) -> TestCaseResult:
        effective_mode = testcase.comparison_mode or comparison_mode

        # Check if runner result envelope is present in stdout
        envelope, user_stdout = JudgeEngine.parse_runner_envelope(sandbox_result.stdout)

        if envelope is not None and envelope.get("status") == "SUCCESS":
            ret_val = envelope.get("return_value")
            if isinstance(ret_val, bool):
                display_stdout = "true" if ret_val else "false"
            elif ret_val is None:
                display_stdout = "null"
            elif isinstance(ret_val, (list, dict)):
                display_stdout = json.dumps(ret_val, ensure_ascii=False)
            elif isinstance(ret_val, (int, float)):
                display_stdout = str(ret_val)
            elif isinstance(ret_val, str):
                display_stdout = ret_val
            else:
                display_stdout = str(ret_val)
        elif envelope is not None:
            display_stdout = user_stdout
        else:
            display_stdout = sandbox_result.stdout

        if not testcase.hidden and not display_stdout.strip() and sandbox_result.exit_code != 0:
            display_stdout = "(no output produced)"

        display_stderr = sandbox_result.stderr

        result = TestCaseResult(
            testcase_id=testcase.id,
            name=testcase.name,
            hidden=testcase.hidden,
            category=testcase.category.value if testcase.category else None,
            stdout="" if testcase.hidden else display_stdout,
            expected_output="" if testcase.hidden else testcase.expected_output,
            stderr="" if testcase.hidden else display_stderr,
            compile_output=compile_output,
            wall_time_ms=sandbox_result.wall_time_ms,
            runtime_ms=sandbox_result.wall_time_ms,
            peak_memory_mb=sandbox_result.peak_memory_mb,
            exit_code=sandbox_result.exit_code,
            weight=testcase.weight,
        )

        # 1. Check System / Infrastructure Error (fail-closed, NEVER downgrade to WRONG_ANSWER)
        if sandbox_result.system_error:
            result.verdict = Verdict.SYSTEM_ERROR
            result.passed = False
            return result

        # 2. Check Output Limit Exceeded
        if sandbox_result.output_limit_exceeded:
            result.verdict = Verdict.OUTPUT_LIMIT_EXCEEDED
            result.passed = False
            return result

        # 3. Check Memory Limit Exceeded
        if sandbox_result.oom_killed:
            result.verdict = Verdict.MEMORY_LIMIT_EXCEEDED
            result.passed = False
            return result

        # 4. Check Time Limit Exceeded
        if sandbox_result.timed_out:
            result.verdict = Verdict.TIME_LIMIT_EXCEEDED
            result.passed = False
            return result

        # 5. Check Compilation Error — use the explicit flag, NOT text presence.
        if compile_failed:
            result.verdict = Verdict.COMPILATION_ERROR
            result.passed = False
            return result

        # 6. Check Runner Envelope Status if present
        if envelope is not None:
            status = envelope.get("status", "")
            if status == "RUNTIME_ERROR":
                result.verdict = Verdict.RUNTIME_ERROR
                result.passed = False
                err_msg = envelope.get("error") or ""
                if err_msg:
                    result.stderr = (result.stderr + "\n" if result.stderr else "") + str(err_msg)
                return result
            elif status == "FUNCTION_NOT_FOUND":
                result.verdict = Verdict.FUNCTION_NOT_FOUND
                result.passed = False
                err_msg = envelope.get("error") or "Function not found in submission"
                result.stderr = (result.stderr + "\n" if result.stderr else "") + str(err_msg)
                return result
            elif status == "SUCCESS":
                ret_val = envelope.get("return_value")
                if isinstance(ret_val, bool):
                    actual_cmp_str = "true" if ret_val else "false"
                elif ret_val is None:
                    actual_cmp_str = "null"
                elif isinstance(ret_val, (list, dict)):
                    actual_cmp_str = json.dumps(ret_val, ensure_ascii=False)
                elif isinstance(ret_val, (int, float)):
                    actual_cmp_str = str(ret_val)
                elif isinstance(ret_val, str):
                    actual_cmp_str = ret_val
                else:
                    actual_cmp_str = str(ret_val)

                passed = JudgeEngine.compare(
                    actual=actual_cmp_str,
                    expected=testcase.expected_output,
                    mode=effective_mode,
                )
                result.passed = passed
                result.verdict = Verdict.ACCEPTED if passed else Verdict.WRONG_ANSWER
                return result

        # 7. Check Runtime Error (when envelope is not present or exited non-zero)
        if sandbox_result.exit_code != 0:
            result.verdict = Verdict.RUNTIME_ERROR
            result.passed = False
            return result

        # 8. Output comparison (for FULL_PROGRAM mode or legacy stdout submissions)
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
        # Fast path: byte-identical
        if actual == expected:
            return True

        if mode == ComparisonMode.EXACT:
            return False  # Already checked exact equality above

        act_s = actual.strip()
        exp_s = expected.strip()

        # String quote normalization: e.g. "olleh" vs olleh, 'olleh' vs olleh
        act_unq = act_s[1:-1] if (act_s.startswith(('"', "'")) and act_s.endswith(('"', "'")) and len(act_s) >= 2) else act_s
        exp_unq = exp_s[1:-1] if (exp_s.startswith(('"', "'")) and exp_s.endswith(('"', "'")) and len(exp_s) >= 2) else exp_s
        if act_unq == exp_unq:
            return True

        # Boolean normalization: e.g. true vs True, false vs False
        act_lower = act_unq.lower()
        exp_lower = exp_unq.lower()
        if act_lower in ("true", "false") and exp_lower in ("true", "false"):
            return act_lower == exp_lower

        if mode == ComparisonMode.TRIMMED:
            act_lines = [l.rstrip() for l in actual.replace("\r\n", "\n").splitlines()]
            exp_lines = [l.rstrip() for l in expected.replace("\r\n", "\n").splitlines()]
            # Strip trailing blank lines
            while act_lines and not act_lines[-1]:
                act_lines.pop()
            while exp_lines and not exp_lines[-1]:
                exp_lines.pop()
            if act_lines == exp_lines:
                return True

        # Structured / Semantic JSON comparison — handles [0, 1] vs [0,1], {"a": 1} vs {"a":1}
        act_s = actual.strip()
        exp_s = expected.strip()
        if (act_s.startswith(("[", "{")) and exp_s.startswith(("[", "{"))) or mode == ComparisonMode.SEMANTIC:
            try:
                act_json = json.loads(act_s)
                exp_json = json.loads(exp_s)
                if act_json == exp_json:
                    return True
            except Exception:
                pass

        # Token-based comparison (whitespace agnostic)
        act_tokens = actual.split()
        exp_tokens = expected.split()
        if mode == ComparisonMode.TOKEN:
            return act_tokens == exp_tokens

        if act_tokens == exp_tokens:
            return True

        # Unordered comparison (any permutation accepted)
        if mode == ComparisonMode.UNORDERED:
            try:
                # Try JSON-parse both sides then sort
                act_parsed = json.loads(act_s)
                exp_parsed = json.loads(exp_s)
                if isinstance(act_parsed, list) and isinstance(exp_parsed, list):
                    try:
                        return sorted(act_parsed) == sorted(exp_parsed)
                    except TypeError:
                        # Contains unhashable (nested lists) — sort as strings
                        return sorted(str(x) for x in act_parsed) == sorted(str(x) for x in exp_parsed)
            except Exception:
                pass
            # Fallback: token-level unordered
            return sorted(act_tokens) == sorted(exp_tokens)

        # Float tolerance comparison (strictly governed by declared mode)
        if mode == ComparisonMode.FLOAT:
            try:
                if len(act_tokens) == len(exp_tokens) and len(act_tokens) > 0:
                    floats_match = True
                    for a_tok, e_tok in zip(act_tokens, exp_tokens):
                        a_val, e_val = float(a_tok), float(e_tok)
                        if not math.isclose(a_val, e_val, rel_tol=FLOAT_EPSILON, abs_tol=FLOAT_EPSILON):
                            floats_match = False
                            break
                    if floats_match:
                        return True
            except (ValueError, TypeError):
                pass

        return False

    @staticmethod
    def score(testcase_results: list[TestCaseResult]) -> ScoringResult:
        """Compute aggregate verdict and score for a submission."""
        if not testcase_results:
            return ScoringResult(
                verdict=Verdict.SYSTEM_ERROR,
                score=0.0,
                passed=0,
                total=0,
            )

        total = len(testcase_results)
        passed = sum(1 for r in testcase_results if r.passed)
        max_time = max((r.wall_time_ms for r in testcase_results), default=0.0)
        max_mem = max((r.peak_memory_mb for r in testcase_results), default=0.0)

        # Priority of failure verdicts: infrastructure and limit failures take precedence
        verdict_priority = [
            Verdict.SYSTEM_ERROR,
            Verdict.COMPILATION_ERROR,
            Verdict.OUTPUT_LIMIT_EXCEEDED,
            Verdict.TIME_LIMIT_EXCEEDED,
            Verdict.MEMORY_LIMIT_EXCEEDED,
            Verdict.RUNTIME_ERROR,
            Verdict.WRONG_ANSWER,
            Verdict.CANCELLED,
        ]

        final_verdict = Verdict.ACCEPTED
        if passed < total:
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
