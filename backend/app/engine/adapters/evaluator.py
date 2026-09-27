"""
Chaos Computer Club — Deterministic Output Normalizer & Evaluator
Strictly compares contestant execution stdout against expected return values
without dynamic eval(), supporting EXACT_MATCH, NORMALIZED_MATCH, and FLOAT_TOLERANCE.
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
            return False, None, f"Could not parse '{s}' as boolean"

        # Integer / Long
        if t in (DataType.INTEGER.value, DataType.LONG.value):
            try:
                # Handle possible floating string like 2.0 or scientific notation if necessary
                return True, int(s), ""
            except ValueError:
                # Try JSON parse first
                try:
                    val = json.loads(s)
                    if isinstance(val, int) and not isinstance(val, bool):
                        return True, val, ""
                except Exception:
                    pass
                return False, None, f"Could not parse '{s}' as integer"

        # Float / Double
        if t in (DataType.FLOAT.value, DataType.DOUBLE.value):
            try:
                return True, float(s), ""
            except ValueError:
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
        """
        cfg = eval_config or EvaluationConfig()
        match_type = cfg.match_type

        # Parse the contestant's output safely
        ok, actual_val, err_msg = cls.parse_raw_output(actual_raw, return_type)
        if not ok:
            return False, f"Output format error: {err_msg}", actual_raw

        # Compare based on match_type
        if match_type == MatchType.FLOAT_TOLERANCE:
            tol = cfg.float_tolerance or 1e-6
            try:
                act_f = float(actual_val)
                exp_f = float(expected_val)
                diff = abs(act_f - exp_f)
                if diff <= tol or math.isclose(act_f, exp_f, rel_tol=tol, abs_tol=tol):
                    return True, "Accepted", actual_val
                return False, f"Float mismatch: got {act_f}, expected {exp_f} (diff={diff} > tol={tol})", actual_val
            except (ValueError, TypeError):
                return False, f"Expected numeric float values for tolerance match, got {actual_val} vs {expected_val}", actual_val

        elif match_type == MatchType.NORMALIZED_MATCH:
            # Trim whitespace, optional case insensitivity
            if isinstance(actual_val, str) and isinstance(expected_val, str):
                act_s = actual_val.strip()
                exp_s = expected_val.strip()
                if cfg.ignore_case:
                    act_s = act_s.lower()
                    exp_s = exp_s.lower()
                passed = act_s == exp_s
                msg = "Accepted" if passed else f"Mismatch: got '{act_s}', expected '{exp_s}'"
                return passed, msg, actual_val
            elif isinstance(actual_val, (list, dict)) and isinstance(expected_val, (list, dict)):
                passed = actual_val == expected_val
                msg = "Accepted" if passed else f"Data mismatch: got {actual_val}, expected {expected_val}"
                return passed, msg, actual_val
            else:
                passed = actual_val == expected_val
                msg = "Accepted" if passed else f"Mismatch: got {actual_val}, expected {expected_val}"
                return passed, msg, actual_val

        else:
            # Default: EXACT_MATCH
            if isinstance(actual_val, (int, float)) and isinstance(expected_val, (int, float)):
                # If return type is float, allow standard floating point equality
                if return_type in (DataType.FLOAT, DataType.DOUBLE):
                    diff = abs(float(actual_val) - float(expected_val))
                    passed = diff < 1e-9
                else:
                    passed = actual_val == expected_val
            elif isinstance(actual_val, str) and isinstance(expected_val, str):
                if cfg.ignore_whitespace:
                    passed = actual_val.strip() == expected_val.strip()
                else:
                    passed = actual_val == expected_val
            else:
                passed = actual_val == expected_val

            msg = "Accepted" if passed else f"Expected {expected_val}, got {actual_val}"
            return passed, msg, actual_val
