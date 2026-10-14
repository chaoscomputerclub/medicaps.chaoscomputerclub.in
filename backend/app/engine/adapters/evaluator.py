"""
Chaos Computer Club — Type-Safe Return Value Normalizer & Evaluator
Strictly compares contestant execution results against expected return values
without dynamic eval(), distinguishing semantic types from serialized representations,
and supporting EXACT_MATCH, NORMALIZED_MATCH, and FLOAT_TOLERANCE.
"""

from __future__ import annotations

import json
import math
import re
from typing import Any, Dict, Optional, Tuple, Union

from app.engine.contracts import DataType, EvaluationConfig, MatchType, parse_type_descriptor, TypeKind


class OutputEvaluator:
    """Production evaluation engine for comparing contestant outputs against expected results."""

    @staticmethod
    def extract_envelope(raw: Any) -> Tuple[Optional[Dict[str, Any]], str]:
        """
        Safely extracts CCC_RUNNER_RESULT envelope if present in raw string.
        Returns: (envelope_dict_or_None, remaining_user_stdout)
        """
        if not isinstance(raw, str):
            if isinstance(raw, dict) and "status" in raw:
                return raw, ""
            return None, ""

        marker = "<<<CCC_RUNNER_RESULT>>>"
        if marker not in raw:
            return None, raw

        # Split on delimiter
        parts = raw.split(marker)
        if len(parts) >= 3:
            envelope_str = parts[1].strip()
            user_stdout = (parts[0] + "".join(parts[2:])).strip()
            try:
                envelope = json.loads(envelope_str)
                if isinstance(envelope, dict):
                    return envelope, user_stdout
            except Exception:
                return {"status": "PROTOCOL_ERROR", "error": "Malformed runner result payload"}, user_stdout

        return None, raw

    @classmethod
    def parse_raw_output(cls, raw: str, return_type: Union[DataType, str]) -> Tuple[bool, Any, str]:
        """
        Safely parses the raw stdout emitted by the language driver.
        Returns (success, parsed_val, error_message).
        Distinguishes between a genuine string and a numeric/boolean literal.
        """
        if not isinstance(raw, str):
            # Already a typed Python value
            return True, raw, ""

        s = raw.strip()
        if not s:
            return False, None, "No output returned by function execution"

        # Check if an execution envelope is embedded in raw stdout
        env, _ = cls.extract_envelope(s)
        if env is not None:
            status = env.get("status")
            if status == "SUCCESS":
                return True, env.get("return_value"), ""
            elif status in ("RUNTIME_ERROR", "FUNCTION_NOT_FOUND", "PROTOCOL_ERROR"):
                return False, None, env.get("error") or status
            return False, None, f"Envelope status: {status}"

        try:
            td = parse_type_descriptor(return_type)
        except Exception:
            td = None

        # Boolean
        if td and td.base == "boolean":
            # Quoted string is NOT a boolean
            if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
                return False, None, f"Could not parse '{s}' as boolean: quoted string received"
            s_lower = s.lower()
            if s_lower == "true":
                return True, True, ""
            elif s_lower == "false":
                return True, False, ""
            return False, None, f"Could not parse '{s}' as boolean"

        # Integer / Long
        if td and td.base == "int" and td.kind == TypeKind.PRIMITIVE:
            # Quoted string is NOT an integer
            if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
                return False, None, f"Could not parse '{s}' as integer: quoted string received"
            if re.match(r"^-?\d+$", s):
                try:
                    return True, int(s), ""
                except ValueError:
                    pass
            try:
                val = json.loads(s)
                if isinstance(val, int) and not isinstance(val, bool):
                    return True, val, ""
            except Exception:
                pass
            return False, None, f"Could not parse '{s}' as integer"

        # Float / Double
        if td and td.base == "float" and td.kind == TypeKind.PRIMITIVE:
            if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
                return False, None, f"Could not parse '{s}' as float: quoted string received"
            try:
                val = float(s)
                if math.isnan(val) or math.isinf(val):
                    return False, None, f"Non-finite float value: {val}"
                return True, val, ""
            except ValueError:
                pass
            return False, None, f"Could not parse '{s}' as float"

        # String
        if td and td.base == "string" and td.kind == TypeKind.PRIMITIVE:
            if (s.startswith('"') and s.endswith('"') and len(s) >= 2) or (s.startswith("'") and s.endswith("'") and len(s) >= 2):
                try:
                    return True, json.loads(s) if s.startswith('"') else s[1:-1], ""
                except Exception:
                    return True, s[1:-1], ""
            return True, s, ""

        # Array / 2D Array / Object / Map
        if td and (td.kind in (TypeKind.ARRAY, TypeKind.OBJECT)):
            try:
                val = json.loads(s)
                if td.kind == TypeKind.ARRAY and isinstance(val, list):
                    return True, val, ""
                if td.kind == TypeKind.OBJECT and isinstance(val, dict):
                    return True, val, ""
            except Exception:
                try:
                    val = json.loads(s.replace("'", '"'))
                    if td.kind == TypeKind.ARRAY and isinstance(val, list):
                        return True, val, ""
                    if td.kind == TypeKind.OBJECT and isinstance(val, dict):
                        return True, val, ""
                except Exception:
                    pass
            return False, None, f"Could not parse '{s}' as valid structured {td.kind.value}"

        # Void
        if td and td.kind == TypeKind.VOID:
            if s.lower() in ("null", "none", "undefined", "void", "()"):
                return True, None, ""
            # Might be an in-place post-execution state
            try:
                val = json.loads(s)
                return True, val, ""
            except Exception:
                return True, s, ""

        # Default fallback
        try:
            val = json.loads(s)
            return True, val, ""
        except Exception:
            return True, s, ""

    @classmethod
    def evaluate_typed_value(
        cls,
        actual_val: Any,
        expected_val: Any,
        return_type: Union[DataType, str],
        eval_config: Optional[EvaluationConfig] = None,
    ) -> Tuple[bool, str, Any]:
        """
        Authoritative type-safe comparison of a semantically typed actual execution value
        against expected value according to the problem's declared return type.
        """
        cfg = eval_config or EvaluationConfig()
        match_type = cfg.match_type

        try:
            td = parse_type_descriptor(return_type)
        except Exception:
            td = None

        # ----------------------------------------------------------------------
        # 1. Integer return types
        # ----------------------------------------------------------------------
        if td and td.base == "int" and td.kind == TypeKind.PRIMITIVE:
            if isinstance(actual_val, bool):
                return False, f"Type mismatch: expected integer return value, received boolean ({actual_val})", actual_val
            if isinstance(actual_val, str):
                return False, f"Type mismatch: expected integer return value, received string '{actual_val}'", actual_val
            if isinstance(actual_val, float):
                if not actual_val.is_integer():
                    return False, f"Type mismatch: expected integer return value, received non-integral float ({actual_val})", actual_val
                act_int = int(actual_val)
            elif isinstance(actual_val, int):
                act_int = actual_val
            else:
                return False, f"Type mismatch: expected integer return value, received {type(actual_val).__name__}", actual_val

            # Normalize expected
            if isinstance(expected_val, bool):
                return False, "Invalid expected value: expected is boolean", None
            if isinstance(expected_val, int) and not isinstance(expected_val, bool):
                exp_int = expected_val
            elif isinstance(expected_val, str):
                s_exp = expected_val.strip()
                if re.match(r"^-?\d+$", s_exp):
                    exp_int = int(s_exp)
                else:
                    return False, f"Invalid expected integer: '{expected_val}'", None
            elif isinstance(expected_val, float) and expected_val.is_integer():
                exp_int = int(expected_val)
            else:
                try:
                    exp_int = int(expected_val)
                except Exception:
                    return False, f"Invalid expected integer value: {expected_val}", None

            if act_int == exp_int:
                return True, "Accepted", act_int
            return False, f"Expected {exp_int}, got {act_int}", act_int

        # ----------------------------------------------------------------------
        # 2. String return types
        # ----------------------------------------------------------------------
        if td and td.base == "string" and td.kind == TypeKind.PRIMITIVE:
            if not isinstance(actual_val, str):
                return False, f"Type mismatch: expected string return value, received {type(actual_val).__name__} ({actual_val})", actual_val

            act_str = actual_val
            # Normalize expected
            if isinstance(expected_val, str):
                exp_s = expected_val
                # Strip outermost quotes if expected_val was passed as JSON-quoted string literal
                if (exp_s.startswith('"') and exp_s.endswith('"') and len(exp_s) >= 2) or (
                    exp_s.startswith("'") and exp_s.endswith("'") and len(exp_s) >= 2
                ):
                    try:
                        exp_str = json.loads(exp_s) if exp_s.startswith('"') else exp_s[1:-1]
                    except Exception:
                        exp_str = exp_s[1:-1]
                else:
                    exp_str = exp_s
            else:
                return False, f"Type mismatch: expected string return value, expected target is {type(expected_val).__name__}", actual_val

            act_cmp = act_str
            exp_cmp = exp_str
            if cfg.ignore_whitespace:
                act_cmp = act_cmp.strip()
                exp_cmp = exp_cmp.strip()
            if cfg.ignore_case:
                act_cmp = act_cmp.lower()
                exp_cmp = exp_cmp.lower()

            if act_cmp == exp_cmp:
                return True, "Accepted", act_str
            return False, f"Mismatch: expected '{exp_str}', got '{act_str}'", act_str

        # ----------------------------------------------------------------------
        # 3. Boolean return types
        # ----------------------------------------------------------------------
        if td and td.base == "boolean" and td.kind == TypeKind.PRIMITIVE:
            if not isinstance(actual_val, bool):
                return False, f"Type mismatch: expected boolean return value, received {type(actual_val).__name__} ({actual_val})", actual_val

            if isinstance(expected_val, bool):
                exp_bool = expected_val
            elif isinstance(expected_val, str):
                s_lower = expected_val.strip().lower()
                if s_lower == "true":
                    exp_bool = True
                elif s_lower == "false":
                    exp_bool = False
                else:
                    return False, f"Invalid expected boolean value: '{expected_val}'", None
            else:
                return False, f"Invalid expected boolean value: {expected_val}", None

            if actual_val is exp_bool:
                return True, "Accepted", actual_val
            return False, f"Expected {exp_bool}, got {actual_val}", actual_val

        # ----------------------------------------------------------------------
        # 4. Floating-point return types
        # ----------------------------------------------------------------------
        if td and td.base == "float" and td.kind == TypeKind.PRIMITIVE:
            if isinstance(actual_val, bool) or not isinstance(actual_val, (int, float)):
                return False, f"Type mismatch: expected float return value, received {type(actual_val).__name__}", actual_val

            act_f = float(actual_val)
            if math.isnan(act_f) or math.isinf(act_f):
                return False, f"Non-finite float value returned: {act_f}", actual_val

            try:
                exp_f = float(expected_val)
            except (ValueError, TypeError):
                return False, f"Invalid expected float value: {expected_val}", None

            tol = cfg.float_tolerance or 1e-6
            diff = abs(act_f - exp_f)
            if diff <= tol or math.isclose(act_f, exp_f, rel_tol=tol, abs_tol=tol):
                return True, "Accepted", act_f
            return False, f"Float mismatch: got {act_f}, expected {exp_f} (diff={diff} > tol={tol})", act_f

        # ----------------------------------------------------------------------
        # 5. Arrays and Matrices
        # ----------------------------------------------------------------------
        if td and td.kind == TypeKind.ARRAY:
            if not isinstance(actual_val, (list, tuple)):
                return False, f"Type mismatch: expected array return value, received {type(actual_val).__name__}", actual_val

            act_arr = list(actual_val)
            if isinstance(expected_val, (list, tuple)):
                exp_arr = list(expected_val)
            elif isinstance(expected_val, str):
                try:
                    parsed = json.loads(expected_val)
                    exp_arr = list(parsed) if isinstance(parsed, (list, tuple)) else None
                except Exception:
                    exp_arr = None
            else:
                exp_arr = None

            if exp_arr is None:
                return False, f"Invalid expected array value: {expected_val}", None

            if act_arr == exp_arr:
                return True, "Accepted", act_arr
            return False, f"Mismatch: Expected {exp_arr}, got {act_arr}", act_arr

        # ----------------------------------------------------------------------
        # 6. Objects and Maps
        # ----------------------------------------------------------------------
        if td and td.kind == TypeKind.OBJECT:
            if not isinstance(actual_val, dict):
                return False, f"Type mismatch: expected object return value, received {type(actual_val).__name__}", actual_val

            if isinstance(expected_val, dict):
                exp_obj = expected_val
            elif isinstance(expected_val, str):
                try:
                    exp_obj = json.loads(expected_val)
                except Exception:
                    exp_obj = None
            else:
                exp_obj = None

            if not isinstance(exp_obj, dict):
                return False, f"Invalid expected object value: {expected_val}", None

            if actual_val == exp_obj:
                return True, "Accepted", actual_val
            return False, f"Object mismatch: got {actual_val}, expected {exp_obj}", actual_val

        # ----------------------------------------------------------------------
        # 7. Void / In-place problems
        # ----------------------------------------------------------------------
        if td and td.kind == TypeKind.VOID:
            exp_is_empty = (
                expected_val is None
                or str(expected_val).strip() in ("", "null", "none", "void", "()")
            )
            if exp_is_empty:
                return True, "Accepted", actual_val

            # Problem specifies expected post-execution state
            if actual_val is None:
                return False, "Missing return value: function did not return modified in-place state", None

            # Compare post-execution state
            if isinstance(expected_val, (list, tuple)) or (
                isinstance(expected_val, str) and expected_val.strip().startswith("[")
            ):
                try:
                    exp_parsed = json.loads(expected_val) if isinstance(expected_val, str) else list(expected_val)
                except Exception:
                    exp_parsed = expected_val
                if actual_val == exp_parsed or list(actual_val) == exp_parsed:
                    return True, "Accepted", actual_val
                return False, f"In-place state mismatch: got {actual_val}, expected {exp_parsed}", actual_val

            if actual_val == expected_val:
                return True, "Accepted", actual_val
            return False, f"In-place state mismatch: got {actual_val}, expected {expected_val}", actual_val

        # ----------------------------------------------------------------------
        # 8. Fallback for untyped or exact match
        # ----------------------------------------------------------------------
        if actual_val == expected_val:
            return True, "Accepted", actual_val
        return False, f"Expected {expected_val}, got {actual_val}", actual_val

    @classmethod
    def compare(
        cls,
        actual_raw: Any,
        expected_val: Any,
        return_type: Union[DataType, str],
        eval_config: Optional[EvaluationConfig] = None,
        is_typed_result: Optional[bool] = None,
        cfg: Optional[EvaluationConfig] = None,
        **kwargs: Any,
    ) -> Tuple[bool, str, Any]:
        """
        Main entry point for comparing actual execution output against expected value.
        Handles typed envelopes, raw stdout text, and already-extracted typed Python values.
        Returns:
            (passed: bool, message: str, parsed_actual: Any)
        """
        config_obj = eval_config or cfg or kwargs.get("config") or EvaluationConfig()
        cfg = config_obj

        # 1. Check if actual_raw is an execution envelope dict
        if isinstance(actual_raw, dict) and "status" in actual_raw:
            status = actual_raw.get("status")
            if status == "RUNTIME_ERROR":
                err = actual_raw.get("error") or "Runtime Error"
                return False, f"Runtime Exception: {err}", None
            if status == "FUNCTION_NOT_FOUND":
                err = actual_raw.get("error") or "Function Not Found"
                return False, f"Function Not Found: {err}", None
            if status == "PROTOCOL_ERROR":
                return False, f"Protocol Error: {actual_raw.get('error')}", None
            if status == "SUCCESS":
                return cls.evaluate_typed_value(
                    actual_val=actual_raw.get("return_value"),
                    expected_val=expected_val,
                    return_type=return_type,
                    eval_config=cfg,
                )

        # 2. Check if actual_raw is a string containing runner envelope
        if isinstance(actual_raw, str) and "<<<CCC_RUNNER_RESULT>>>" in actual_raw:
            env, _ = cls.extract_envelope(actual_raw)
            if env is not None:
                return cls.compare(env, expected_val, return_type, eval_config=cfg, is_typed_result=True)

        # 3. If caller explicitly marks this as a typed value or it is already non-str
        if is_typed_result is True or (not isinstance(actual_raw, str)):
            return cls.evaluate_typed_value(
                actual_val=actual_raw,
                expected_val=expected_val,
                return_type=return_type,
                eval_config=cfg,
            )

        # 4. Raw string output from stdout
        raw_str = str(actual_raw)
        s_trimmed = raw_str.strip()

        try:
            td = parse_type_descriptor(return_type)
        except Exception:
            td = None

        # Check for quoted string literal vs unquoted transport
        is_quoted_str = (
            (s_trimmed.startswith('"') and s_trimmed.endswith('"') and len(s_trimmed) >= 2)
            or (s_trimmed.startswith("'") and s_trimmed.endswith("'") and len(s_trimmed) >= 2)
        )

        # If declared return type is integer, a quoted string literal is a genuine string -> REJECT
        if td and td.base == "int" and td.kind == TypeKind.PRIMITIVE:
            if is_quoted_str:
                return False, f"Type mismatch: expected integer return value, received string {s_trimmed}", s_trimmed
            # If caller passed a bare string "6" with no newline and expected is int,
            # check if is_typed_result is None:
            # If actual_raw had NO newline and matches an integer, it's either transport or typed string.
            # But if actual_raw is literally "6" and expected is 6:
            # For stdout-based tests like "42\n", raw_str ends with \n.
            # If raw_str == "6" without \n and is_typed_result is None:
            # If expected_val is int, we accept transport integer if it parses.
            # BUT if caller passed typed string '"6"', it was caught by is_quoted_str above.
            if re.match(r"^-?\d+$", s_trimmed):
                return cls.evaluate_typed_value(int(s_trimmed), expected_val, return_type, eval_config=cfg)
            return False, f"Could not parse '{s_trimmed}' as integer", s_trimmed

        # If declared return type is boolean, a quoted string literal is a genuine string -> REJECT
        if td and td.base == "boolean" and td.kind == TypeKind.PRIMITIVE:
            if is_quoted_str:
                return False, f"Type mismatch: expected boolean return value, received string {s_trimmed}", s_trimmed
            s_lower = s_trimmed.lower()
            if s_lower == "true":
                return cls.evaluate_typed_value(True, expected_val, return_type, eval_config=cfg)
            if s_lower == "false":
                return cls.evaluate_typed_value(False, expected_val, return_type, eval_config=cfg)
            return False, f"Could not parse '{s_trimmed}' as boolean", s_trimmed

        # For all other types, parse raw output and compare
        ok, parsed_val, err = cls.parse_raw_output(raw_str, return_type)
        if not ok:
            return False, f"Output format error: {err}", raw_str

        return cls.evaluate_typed_value(parsed_val, expected_val, return_type, eval_config=cfg)
