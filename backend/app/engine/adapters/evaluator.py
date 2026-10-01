"""
Chaos Computer Club — Deterministic Output Normalizer & Evaluator
Strictly compares contestant execution stdout against expected return values
without dynamic eval(), supporting EXACT_MATCH, NORMALIZED_MATCH, and FLOAT_TOLERANCE.
"""

from __future__ import annotations

import json
import math
from typing import Any, Tuple, Union
from app.engine.contracts import DataType, EvaluationConfig, MatchType, parse_type_descriptor, TypeKind


class OutputEvaluator:
    """Production evaluation engine for comparing contestant outputs against expected results."""

    @staticmethod
    def parse_raw_output(raw: str, return_type: Union[DataType, str]) -> Tuple[bool, Any, str]:
        """
        Safely parses the raw stdout emitted by the language driver.
        Returns (success, parsed_val, error_message).
        """
        s = raw.strip()
        if not s:
            return False, None, "No output returned by function execution"

        try:
            td = parse_type_descriptor(return_type)
        except Exception:
            td = None

        # Boolean
        if td and td.base == "boolean":
            s_lower = s.lower()
            if s_lower in ("true", "1"):
                return True, True, ""
            elif s_lower in ("false", "0"):
                return True, False, ""
            try:
                val = json.loads(s)
                if isinstance(val, bool):
                    return True, val, ""
            except Exception:
                pass
            return False, None, f"Could not parse '{s}' as boolean"

        # Integer / Long
        if td and td.base == "int" and td.kind == TypeKind.PRIMITIVE:
            try:
                return True, int(s), ""
            except ValueError:
                pass
            try:
                val = json.loads(s)
                if isinstance(val, int) and not isinstance(val, bool):
                    return True, val, ""
                if isinstance(val, (list, dict, float)):
                    return True, val, ""
            except Exception:
                pass
            return True, s, f"Could not parse '{s}' as integer; treating as string"

        # Float / Double
        if td and td.base == "float" and td.kind == TypeKind.PRIMITIVE:
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
        if td and td.base == "string" and td.kind == TypeKind.PRIMITIVE:
            if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
                try:
                    return True, json.loads(s), ""
                except Exception:
                    return True, s[1:-1], ""
            return True, s, ""

        # Array / 2D Array / Object / Map
        if td and (td.kind in (TypeKind.ARRAY, TypeKind.OBJECT)):
            try:
                val = json.loads(s)
                return True, val, ""
            except Exception as e:
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
        return_type: Union[DataType, str],
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
            # Semantic JSON fallback before hard-failing
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
                if act_s.split() == exp_s.split():
                    return True, "Accepted (token fallback)", act_s
            return False, f"Output format error: {err_msg}", actual_raw

        # Normalize expected value
        norm_expected = expected_val
        is_str_type = False
        try:
            td = parse_type_descriptor(return_type)
            is_str_type = (td.base == "string" and td.kind == TypeKind.PRIMITIVE)
        except Exception:
            pass

        if isinstance(expected_val, str):
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
            if isinstance(actual_val, str) and isinstance(norm_expected, str):
                act_s = actual_val.strip()
                exp_s = norm_expected.strip()
                if (act_s.startswith(('"', "'")) and act_s.endswith(('"', "'")) and len(act_s) >= 2):
                    act_s = act_s[1:-1]
                if (exp_s.startswith(('"', "'")) and exp_s.endswith(('"', "'")) and len(exp_s) >= 2):
                    exp_s = exp_s[1:-1]
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
                # Deep structural equality: [0, 1] == [0,1], but [0,1] != [1,0]
                passed = actual_val == norm_expected
            elif isinstance(actual_val, (int, float)) and isinstance(norm_expected, (int, float)):
                if isinstance(return_type, str) and "float" in return_type.lower():
                    diff = abs(float(actual_val) - float(norm_expected))
                    passed = diff < 1e-9
                else:
                    passed = actual_val == norm_expected
            elif isinstance(actual_val, str) and isinstance(norm_expected, str):
                act_s = actual_val.strip() if cfg.ignore_whitespace else actual_val
                exp_s = norm_expected.strip() if cfg.ignore_whitespace else norm_expected
                if (act_s.startswith(('"', "'")) and act_s.endswith(('"', "'")) and len(act_s) >= 2):
                    act_s = act_s[1:-1]
                if (exp_s.startswith(('"', "'")) and exp_s.endswith(('"', "'")) and len(exp_s) >= 2):
                    exp_s = exp_s[1:-1]
                passed = act_s == exp_s
            elif isinstance(actual_val, bool) and isinstance(norm_expected, bool):
                passed = actual_val == norm_expected
            else:
                try:
                    act_j = json.loads(str(actual_val)) if not isinstance(actual_val, (list, dict)) else actual_val
                    exp_j = json.loads(str(norm_expected)) if not isinstance(norm_expected, (list, dict)) else norm_expected
                    passed = act_j == exp_j
                except Exception:
                    passed = actual_val == norm_expected

            msg = "Accepted" if passed else f"Expected {norm_expected}, got {actual_val}"
            return passed, msg, actual_val
