"""
Chaos Computer Club — Deterministic Output Normalizer & Evaluator
Strictly compares contestant execution stdout against expected return values
without dynamic eval(), supporting EXACT_MATCH, NORMALIZED_MATCH, and FLOAT_TOLERANCE.

BUG FIX: parse_raw_output was hard-failing when the declared return_type didn't match
the actual output shape (e.g., problem declared return_type=integer but the function
actually returns an array). This caused WRONG_ANSWER for semantically correct outputs.
Fix: when typed parse fails, fall back to JSON semantic comparison before giving up.
"""

from __future__ import annotations

import json
import math
from typing import Any, Tuple
from app.engine.contracts import DataType, EvaluationConfig, MatchType


class OutputEvaluator:
    """Production evaluation engine for comparing contestant outputs against expected results."""

    @staticmethod
    def parse_raw_output(raw: str, return_type: DataType) -> Tuple[bool, Any, str]:
        """
        Safely parses the raw stdout emitted by the language driver.
        Returns (success, parsed_val, error_message).

        BUG FIX: Previously hard-failed when type parsing failed (e.g., return_type=integer
        but output is "[0,1]"). Now falls through to JSON parsing as a universal fallback,
        since a mismatched declared type should not cause a semantic failure.
        """
        s = raw.strip()
        t = return_type.value if isinstance(return_type, DataType) else str(return_type)

        if not s:
            return False, None, "No output returned by function execution"

        # Boolean
        if t == DataType.BOOLEAN.value:
            s_lower = s.lower()
            if s_lower in ("true", "1"):
                return True, True, ""
            elif s_lower in ("false", "0"):
                return True, False, ""
            # Don't hard-fail — fall through to JSON in case it's a boolean expression
            try:
                val = json.loads(s)
                if isinstance(val, bool):
                    return True, val, ""
            except Exception:
                pass
            return False, None, f"Could not parse '{s}' as boolean"

        # Integer / Long
        if t in (DataType.INTEGER.value, DataType.LONG.value):
            try:
                return True, int(s), ""
            except ValueError:
                pass
            # Try JSON: handles both plain ints and mismatched array outputs
            try:
                val = json.loads(s)
                # If it parsed as an int, accept it
                if isinstance(val, int) and not isinstance(val, bool):
                    return True, val, ""
                # BUG FIX: If declared integer but output looks like an array/object,
                # return the parsed JSON value anyway — the compare() layer will handle
                # semantic equality. Mismatched declared type != wrong answer.
                if isinstance(val, (list, dict, float)):
                    return True, val, ""
            except Exception:
                pass
            # Final fallback: return raw string so compare() can do token comparison
            return True, s, f"Could not parse '{s}' as integer; treating as string"

        # Float / Double
        if t in (DataType.FLOAT.value, DataType.DOUBLE.value):
            try:
                return True, float(s), ""
            except ValueError:
                pass
            try:
                val = json.loads(s)
                return True, val, ""
            except Exception:
                pass
            return False, None, f"Could not parse '{s}' as float"

        # String
        if t == DataType.STRING.value:
            # Check if JSON-encoded string with surrounding quotes
            if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
                try:
                    return True, json.loads(s), ""
                except Exception:
                    return True, s[1:-1], ""
            return True, s, ""

        # Array / 2D Array / Object / Map
        if "[]" in t or t in (DataType.OBJECT.value, DataType.MAP.value):
            try:
                val = json.loads(s)
                return True, val, ""
            except Exception as e:
                # Try single quotes replacement if emitted from non-standard printers
                try:
                    val = json.loads(s.replace("'", '"'))
                    return True, val, ""
                except Exception:
                    pass
                return False, None, f"Could not parse '{s}' as JSON: {e}"

        # Default fallback: try json.loads then raw string
        try:
            val = json.loads(s)
            return True, val, ""
        except Exception:
            return True, s, ""

    @classmethod
    def compare(
        cls,
        actual_raw: str,
        expected_val: Any,
        return_type: DataType,
        eval_config: EvaluationConfig | None = None,
    ) -> Tuple[bool, str, Any]:
        """
        Compares contestant execution stdout against expected value.
        Returns:
            (passed: bool, message: str, parsed_actual: Any)

        BUG FIX: When parse_raw_output fails (type error, mismatched declared type),
        fall back to JSON semantic comparison instead of immediately returning False.
        This catches the case where return_type is wrong in the DB but the output is
        semantically correct (e.g., declared integer but returns [0, 1]).
        """
        cfg = eval_config or EvaluationConfig()
        match_type = cfg.match_type

        # Parse the contestant's output safely
        ok, actual_val, err_msg = cls.parse_raw_output(actual_raw, return_type)
        if not ok:
            # BUG FIX: Before hard-failing, attempt JSON semantic fallback.
            # Covers cases where the declared return_type is wrong but output is correct.
            act_s = actual_raw.strip()
            exp_s = str(expected_val).strip() if not isinstance(expected_val, str) else expected_val.strip()
            if act_s and exp_s:
                try:
                    act_json = json.loads(act_s)
                    exp_json = json.loads(exp_s) if isinstance(expected_val, str) else expected_val
                    if act_json == exp_json:
                        return True, "Accepted (JSON semantic fallback)", act_json
                except Exception:
                    pass
                # Token-level fallback
                if act_s.split() == exp_s.split():
                    return True, "Accepted (token fallback)", act_s
            return False, f"Output format error: {err_msg}", actual_raw

        # If expected_val is passed as a string but return_type is structured/scalar,
        # normalize expected_val by parsing it through the same type contract
        norm_expected = expected_val
        if isinstance(expected_val, str) and return_type != DataType.STRING:
            exp_ok, exp_parsed, _ = cls.parse_raw_output(expected_val, return_type)
            if exp_ok:
                norm_expected = exp_parsed

        # Compare based on match_type
        if match_type == MatchType.FLOAT_TOLERANCE:
            tol = cfg.float_tolerance or 1e-6
            try:
                act_f = float(actual_val)
                exp_f = float(norm_expected)
                diff = abs(act_f - exp_f)
                if diff <= tol or math.isclose(act_f, exp_f, rel_tol=tol, abs_tol=tol):
                    return True, "Accepted", actual_val
                return False, f"Float mismatch: got {act_f}, expected {exp_f} (diff={diff} > tol={tol})", actual_val
            except (ValueError, TypeError):
                return False, f"Expected numeric float values for tolerance match, got {actual_val} vs {norm_expected}", actual_val

        elif match_type == MatchType.NORMALIZED_MATCH:
            # Trim whitespace, optional case insensitivity
            if isinstance(actual_val, str) and isinstance(norm_expected, str):
                act_s = actual_val.strip()
                exp_s = norm_expected.strip()
                if cfg.ignore_case:
                    act_s = act_s.lower()
                    exp_s = exp_s.lower()
                passed = act_s == exp_s
                msg = "Accepted" if passed else f"Mismatch: got '{act_s}', expected '{exp_s}'"
                return passed, msg, actual_val
            elif isinstance(actual_val, (list, dict)) and isinstance(norm_expected, (list, dict)):
                passed = actual_val == norm_expected
                msg = "Accepted" if passed else f"Data mismatch: got {actual_val}, expected {norm_expected}"
                return passed, msg, actual_val
            else:
                passed = actual_val == norm_expected
                msg = "Accepted" if passed else f"Mismatch: got {actual_val}, expected {norm_expected}"
                return passed, msg, actual_val

        else:
            # Default: EXACT_MATCH
            if isinstance(actual_val, (list, dict)) and isinstance(norm_expected, (list, dict)):
                # Structured types: deep equality (handles [0, 1] == [0, 1] regardless of spacing)
                passed = actual_val == norm_expected
            elif isinstance(actual_val, (int, float)) and isinstance(norm_expected, (int, float)):
                # If return type is float, allow standard floating point equality
                if return_type in (DataType.FLOAT, DataType.DOUBLE):
                    diff = abs(float(actual_val) - float(norm_expected))
                    passed = diff < 1e-9
                else:
                    passed = actual_val == norm_expected
            elif isinstance(actual_val, str) and isinstance(norm_expected, str):
                if cfg.ignore_whitespace:
                    passed = actual_val.strip() == norm_expected.strip()
                else:
                    passed = actual_val == norm_expected
            else:
                # Cross-type: try JSON semantic comparison as final resort
                try:
                    act_j = json.loads(str(actual_val)) if not isinstance(actual_val, (list, dict)) else actual_val
                    exp_j = json.loads(str(norm_expected)) if not isinstance(norm_expected, (list, dict)) else norm_expected
                    passed = act_j == exp_j
                except Exception:
                    passed = actual_val == norm_expected

            msg = "Accepted" if passed else f"Expected {norm_expected}, got {actual_val}"
            return passed, msg, actual_val
