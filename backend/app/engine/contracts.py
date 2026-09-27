"""
Chaos Computer Club — Function Execution Contract & Type System
Provides structured type validation, function signature contracts, parameter definitions,
and validation logic for LeetCode-style competitive programming problems.
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Tuple, Union
from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Supported Type Definition Hierarchy
# ---------------------------------------------------------------------------

class DataType(str, Enum):
    # Primitive Scalars
    INTEGER = "integer"
    LONG = "long"
    FLOAT = "float"
    DOUBLE = "double"
    BOOLEAN = "boolean"
    STRING = "string"

    # 1D Arrays / Lists
    INTEGER_ARRAY = "integer[]"
    LONG_ARRAY = "long[]"
    FLOAT_ARRAY = "float[]"
    DOUBLE_ARRAY = "double[]"
    STRING_ARRAY = "string[]"
    BOOLEAN_ARRAY = "boolean[]"

    # 2D Arrays / Matrices
    INTEGER_2D_ARRAY = "integer[][]"
    LONG_2D_ARRAY = "long[][]"
    FLOAT_2D_ARRAY = "float[][]"
    DOUBLE_2D_ARRAY = "double[][]"
    STRING_2D_ARRAY = "string[][]"

    # Complex / Map / Object
    OBJECT = "object"
    MAP = "map"


SUPPORTED_DATA_TYPES = {t.value for t in DataType}


class ExecutionMode(str, Enum):
    FUNCTION = "FUNCTION"
    STDIN_STDOUT = "STDIN_STDOUT"


class ProblemStatus(str, Enum):
    DRAFT = "DRAFT"
    VALIDATING = "VALIDATING"
    VALIDATED = "VALIDATED"
    REVIEW = "REVIEW"
    PUBLISHED = "PUBLISHED"
    LOCKED = "LOCKED"
    ARCHIVED = "ARCHIVED"


# ---------------------------------------------------------------------------
# Parameter & Function Signature
# ---------------------------------------------------------------------------

class ParameterDefinition(BaseModel):
    name: str = Field(..., description="Parameter variable name")
    type: DataType = Field(..., description="Standardized parameter data type")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", cleaned):
            raise ValueError(
                f"Parameter name '{cleaned}' must be a valid programming identifier (alphanumeric and underscores, starting with letter or underscore)."
            )
        # Reserved words across Python, C++, Java, JS
        reserved = {
            "class", "def", "public", "private", "protected", "void", "int", "float",
            "double", "char", "bool", "boolean", "return", "if", "else", "for", "while",
            "do", "switch", "case", "default", "break", "continue", "import", "from",
            "package", "new", "this", "super", "self", "true", "false", "null", "none",
            "try", "catch", "finally", "throw", "throws", "function", "var", "let", "const",
        }
        if cleaned.lower() in reserved:
            raise ValueError(f"Parameter name '{cleaned}' cannot be a reserved programming keyword.")
        return cleaned


class FunctionSignature(BaseModel):
    name: str = Field(..., description="Target function/method name in Solution class")
    parameters: List[ParameterDefinition] = Field(
        default_factory=list,
        description="Ordered list of function parameters",
    )
    return_type: DataType = Field(
        DataType.INTEGER,
        description="Expected return data type",
    )

    @field_validator("name")
    @classmethod
    def validate_function_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", cleaned):
            raise ValueError(
                f"Function name '{cleaned}' must be a valid identifier starting with a letter or underscore."
            )
        # Strictly forbid dangerous characters or injection patterns
        dangerous = {";", "{", "}", "(", ")", "\"", "'", "\n", "\r", "$", "`", "\\", "/", " "}
        if any(c in cleaned for c in dangerous):
            raise ValueError("Function name contains disallowed characters or injection syntax.")
        
        # Disallow well-known construct names
        if cleaned in {"__init__", "main", "Solution", "constructor"}:
            raise ValueError(f"Function name '{cleaned}' conflicts with class or runtime entry points.")
        return cleaned

    @model_validator(mode="after")
    def validate_unique_parameters(self) -> FunctionSignature:
        names = [p.name for p in self.parameters]
        if len(names) != len(set(names)):
            duplicates = [n for n in names if names.count(n) > 1]
            raise ValueError(f"Duplicate parameter names detected: {set(duplicates)}")
        if len(self.parameters) > 16:
            raise ValueError("A problem cannot have more than 16 function parameters.")
        return self


# ---------------------------------------------------------------------------
# Evaluation Rules & Comparison Configuration
# ---------------------------------------------------------------------------

class MatchType(str, Enum):
    EXACT_MATCH = "EXACT_MATCH"
    NORMALIZED_MATCH = "NORMALIZED_MATCH"
    FLOAT_TOLERANCE = "FLOAT_TOLERANCE"
    CUSTOM_CHECKER = "CUSTOM_CHECKER"


class EvaluationConfig(BaseModel):
    match_type: MatchType = Field(MatchType.EXACT_MATCH, description="Result comparison strategy")
    float_tolerance: float = Field(1e-6, ge=1e-12, le=1e-1, description="Epsilon tolerance for float comparison")
    ignore_whitespace: bool = Field(True, description="Trim leading/trailing whitespace")
    ignore_case: bool = Field(False, description="Case-insensitive comparison where applicable")
    custom_checker_code: Optional[str] = Field(None, description="Optional custom evaluation script")


class SandboxConfig(BaseModel):
    time_limit_sec: float = Field(2.0, ge=0.1, le=15.0, description="CPU execution wall time in seconds")
    memory_limit_mb: int = Field(256, ge=16, le=1024, description="Maximum RSS memory limit in Megabytes")
    network_enabled: bool = Field(False, description="Whether network sockets are permitted (always False for contestants)")
    process_limit: int = Field(16, ge=1, le=64, description="Max concurrent process threads")
    output_limit_kb: int = Field(1024, ge=16, le=8192, description="Stdout/stderr capture cap in Kilobytes")


# ---------------------------------------------------------------------------
# Structured Testcase Contracts
# ---------------------------------------------------------------------------

class StructuredTestCase(BaseModel):
    testcase_id: str = Field(..., description="Unique testcase identifier (e.g. TC-01)")
    input: Dict[str, Any] = Field(..., description="Dictionary mapping parameter name -> input value")
    expected_output: Any = Field(..., description="Structured expected output value matching return_type")
    explanation: Optional[str] = Field(None, description="Optional educational explanation for sample cases")
    weight: float = Field(1.0, ge=0.0, description="Score weight for scoring evaluation")
    hidden: bool = Field(False, description="Whether this testcase is hidden from contestants")
    order: int = Field(0, description="Display or execution ordering index")
    is_active: bool = Field(True, description="Whether testcase participates in scoring")


# ---------------------------------------------------------------------------
# Type System Validator Helpers
# ---------------------------------------------------------------------------

def validate_value_type(value: Any, expected_type: DataType | str) -> Tuple[bool, Optional[str]]:
    """
    Validates whether a python object matches the specified DataType contract.
    Returns (True, None) or (False, error_message).
    """
    t_str = expected_type.value if isinstance(expected_type, DataType) else str(expected_type)

    if t_str == DataType.INTEGER.value or t_str == DataType.LONG.value:
        if isinstance(value, bool):
            return False, f"Expected integer, got boolean ({value})"
        if not isinstance(value, int):
            return False, f"Expected integer, got {type(value).__name__}"
        return True, None

    elif t_str == DataType.FLOAT.value or t_str == DataType.DOUBLE.value:
        if isinstance(value, bool):
            return False, f"Expected float/double, got boolean ({value})"
        if not isinstance(value, (int, float)):
            return False, f"Expected float/double, got {type(value).__name__}"
        return True, None

    elif t_str == DataType.BOOLEAN.value:
        if not isinstance(value, bool):
            return False, f"Expected boolean, got {type(value).__name__}"
        return True, None

    elif t_str == DataType.STRING.value:
        if not isinstance(value, str):
            return False, f"Expected string, got {type(value).__name__}"
        return True, None

    elif t_str == DataType.INTEGER_ARRAY.value or t_str == DataType.LONG_ARRAY.value:
        if not isinstance(value, list):
            return False, f"Expected list of integers, got {type(value).__name__}"
        for idx, item in enumerate(value):
            if isinstance(item, bool) or not isinstance(item, int):
                return False, f"Element at index {idx} is not an integer ({type(item).__name__})"
        return True, None

    elif t_str == DataType.FLOAT_ARRAY.value or t_str == DataType.DOUBLE_ARRAY.value:
        if not isinstance(value, list):
            return False, f"Expected list of floats, got {type(value).__name__}"
        for idx, item in enumerate(value):
            if isinstance(item, bool) or not isinstance(item, (int, float)):
                return False, f"Element at index {idx} is not a float ({type(item).__name__})"
        return True, None

    elif t_str == DataType.STRING_ARRAY.value:
        if not isinstance(value, list):
            return False, f"Expected list of strings, got {type(value).__name__}"
        for idx, item in enumerate(value):
            if not isinstance(item, str):
                return False, f"Element at index {idx} is not a string ({type(item).__name__})"
        return True, None

    elif t_str == DataType.BOOLEAN_ARRAY.value:
        if not isinstance(value, list):
            return False, f"Expected list of booleans, got {type(value).__name__}"
        for idx, item in enumerate(value):
            if not isinstance(item, bool):
                return False, f"Element at index {idx} is not a boolean ({type(item).__name__})"
        return True, None

    elif t_str == DataType.INTEGER_2D_ARRAY.value or t_str == DataType.LONG_2D_ARRAY.value:
        if not isinstance(value, list):
            return False, f"Expected 2D list of integers, got {type(value).__name__}"
        for r_idx, row in enumerate(value):
            if not isinstance(row, list):
                return False, f"Row {r_idx} is not a list ({type(row).__name__})"
            for c_idx, item in enumerate(row):
                if isinstance(item, bool) or not isinstance(item, int):
                    return False, f"Element at [{r_idx}][{c_idx}] is not an integer"
        return True, None

    elif t_str == DataType.FLOAT_2D_ARRAY.value or t_str == DataType.DOUBLE_2D_ARRAY.value:
        if not isinstance(value, list):
            return False, f"Expected 2D list of floats, got {type(value).__name__}"
        for r_idx, row in enumerate(value):
            if not isinstance(row, list):
                return False, f"Row {r_idx} is not a list ({type(row).__name__})"
            for c_idx, item in enumerate(row):
                if isinstance(item, bool) or not isinstance(item, (int, float)):
                    return False, f"Element at [{r_idx}][{c_idx}] is not a float"
        return True, None

    elif t_str == DataType.STRING_2D_ARRAY.value:
        if not isinstance(value, list):
            return False, f"Expected 2D list of strings, got {type(value).__name__}"
        for r_idx, row in enumerate(value):
            if not isinstance(row, list):
                return False, f"Row {r_idx} is not a list ({type(row).__name__})"
            for c_idx, item in enumerate(row):
                if not isinstance(item, str):
                    return False, f"Element at [{r_idx}][{c_idx}] is not a string"
        return True, None

    elif t_str == DataType.OBJECT.value or t_str == DataType.MAP.value:
        if not isinstance(value, dict):
            return False, f"Expected object/dictionary, got {type(value).__name__}"
        return True, None

    return True, None
