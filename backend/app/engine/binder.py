"""
Chaos Computer Club — Production LeetCode-Style Input & Argument Binder
Parses, binds, validates, and serializes testcase arguments against the problem's
canonical FunctionSignature with positional binding and strict type checking.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Tuple, Union
from pydantic import BaseModel, Field

from app.engine.contracts import (
    DataType,
    FunctionSignature,
    ParameterDefinition,
    TypeDescriptor,
    TypeKind,
    parse_type_descriptor,
)


class BoundArgument(BaseModel):
    name: str = Field(..., description="Parameter identifier name")
    type: str = Field(..., description="Declared parameter data type")
    value: Any = Field(..., description="Strongly-typed parsed and validated parameter value")


class InputBindingError(Exception):
    """Raised when testcase input cannot be parsed, has an argument count mismatch, or fails type validation."""
    def __init__(self, message: str, parameter_name: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.parameter_name = parameter_name


class InputBinder:
    """
    Dedicated, authoritative argument binding engine.
    Ensures input values bind strictly by position to FunctionSignature parameters
    without converting missing or malformed parameters into null.
    """

    @classmethod
    def parse_raw_input(cls, raw: Any) -> Any:
        """
        Parses raw testcase input from DB or network into a structured Python representation.
        Handles JSON strings, container wrappers (raw, input, args), and legacy formats.
        """
        if raw is None:
            return None

        # Container unwrapping: {'raw': ...}, {'args': ...}, {'input': ...}, {'stdin': ...}
        if isinstance(raw, dict):
            # If dictionary has standard wrapper keys and not problem parameter keys
            for wrap_key in ("raw", "args", "input", "stdin", "arguments", "parameters"):
                if wrap_key in raw and raw[wrap_key] is not None:
                    return cls.parse_raw_input(raw[wrap_key])
            return raw

        if isinstance(raw, str):
            s = raw.strip()
            if not s:
                return ""

            # Try parsing as standard JSON
            try:
                return json.loads(s)
            except Exception:
                pass

            # Try JSON with single-quote normalization
            try:
                return json.loads(s.replace("'", '"'))
            except Exception:
                pass

            # Check if this is a multiline string
            lines = [l.strip() for l in s.splitlines() if l.strip()]
            if len(lines) > 1:
                parsed_lines = []
                for line in lines:
                    try:
                        parsed_lines.append(json.loads(line))
                    except Exception:
                        parsed_lines.append(line)
                return parsed_lines

            return s

        return raw

    @classmethod
    def bind(cls, signature: FunctionSignature, raw_input: Any) -> List[BoundArgument]:
        """
        Binds raw testcase input strictly to the FunctionSignature parameters by position.
        Validates argument count and data types.
        Returns a list of BoundArgument objects.
        """
        if not signature or not signature.parameters:
            return []

        parsed = cls.parse_raw_input(raw_input)
        params = signature.parameters
        num_params = len(params)
        param_names = [p.name for p in params]

        raw_args: List[Any] = []

        # 1. Named or index-keyed dictionary binding (legacy compatibility)
        if isinstance(parsed, dict):
            if any(p.name in parsed for p in params):
                missing_names = [p.name for p in params if p.name not in parsed]
                if missing_names:
                    raise InputBindingError(
                        f"Testcase is missing required parameter '{missing_names[0]}'"
                    )
                raw_args = [parsed[p.name] for p in params]
            elif all((str(i) in parsed or i in parsed) for i in range(num_params)):
                raw_args = [parsed[str(i)] if str(i) in parsed else parsed[i] for i in range(num_params)]

        # 2. LeetCode assignment string (e.g. 's = "anagram", t = "nagaram"')
        elif isinstance(parsed, str) and any(re.search(rf"\b{re.escape(p.name)}\s*=", parsed) for p in params):
            extracted = {}
            for p in params:
                other_params = "|".join(re.escape(other.name) for other in params if other.name != p.name)
                pattern = rf"\b{re.escape(p.name)}\s*=\s*(.+?)(?:,\s*(?:{other_params})\s*=|\n|$)" if other_params else rf"\b{re.escape(p.name)}\s*=\s*(.+?)(?:\n|$)"
                m = re.search(pattern, parsed, re.DOTALL)
                if not m:
                    raise InputBindingError(f"Could not bind parameter '{p.name}' from assignment string: {parsed}")
                raw_val = m.group(1).strip()
                if raw_val.endswith(","):
                    raw_val = raw_val[:-1].strip()
                try:
                    extracted[p.name] = json.loads(raw_val)
                except Exception:
                    extracted[p.name] = raw_val
            raw_args = [extracted[p.name] for p in params]

        # 3. Positional array/tuple (CANONICAL FORMAT)
        elif isinstance(parsed, (list, tuple)):
            # Special case: single parameter expecting array/list or object
            # e.g. reverseList(nums: array<int>) where input is [1, 2, 3]
            if num_params == 1:
                p0 = params[0]
                td = parse_type_descriptor(p0.type)
                # If the single param expects an array, and the input is [1, 2, 3]
                # Check if parsed itself is valid as the argument value
                val_as_is, _ = td.validate_value(parsed)
                if val_as_is:
                    raw_args = [parsed]
                elif len(parsed) == 1:
                    raw_args = [parsed[0]]
                else:
                    raw_args = [parsed]
            else:
                raw_args = list(parsed)

        # 4. Single scalar for 1-parameter signature
        elif num_params == 1:
            raw_args = [parsed]

        else:
            raise InputBindingError(
                f"Expected positional argument array for {num_params} parameters, received {type(parsed).__name__}: {parsed}"
            )

        # Validate argument count
        if len(raw_args) != num_params:
            raise InputBindingError(
                f"Argument count mismatch: Function '{signature.name}' expects {num_params} arguments, received {len(raw_args)}"
            )

        # Validate argument types strictly against declared contract
        bound_arguments: List[BoundArgument] = []
        for idx, (param, arg_val) in enumerate(zip(params, raw_args)):
            td = parse_type_descriptor(param.type)
            ok, err_msg = td.validate_value(arg_val)
            if not ok:
                raise InputBindingError(
                    f"Type validation error for parameter '{param.name}' (position {idx}, expected {td.raw_type}): {err_msg}",
                    parameter_name=param.name,
                )
            bound_arguments.append(
                BoundArgument(
                    name=param.name,
                    type=td.raw_type,
                    value=arg_val,
                )
            )

        return bound_arguments

    @classmethod
    def to_dict(cls, bound_args: List[BoundArgument]) -> Dict[str, Any]:
        """Returns a name -> value dictionary representation."""
        return {arg.name: arg.value for arg in bound_args}

    @classmethod
    def to_list(cls, bound_args: List[BoundArgument]) -> List[Any]:
        """Returns ordered positional argument list."""
        return [arg.value for arg in bound_args]

    @classmethod
    def to_serialized_payload(cls, bound_args: List[BoundArgument]) -> str:
        """
        Produces a canonical JSON string payload containing both named and positional
        argument data for language execution drivers.
        """
        payload = {arg.name: arg.value for arg in bound_args}
        return json.dumps(payload, ensure_ascii=False)
