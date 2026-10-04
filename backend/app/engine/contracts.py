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
    VOID = "void"


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
# Type Descriptor & Parser
# ---------------------------------------------------------------------------

class TypeKind(str, Enum):
    PRIMITIVE = "PRIMITIVE"
    ARRAY = "ARRAY"
    OBJECT = "OBJECT"
    NULLABLE = "NULLABLE"
    VOID = "VOID"


class TypeDescriptor(BaseModel):
    raw_type: str
    kind: TypeKind
    base: str  # "int", "float", "boolean", "string", "object", "void"
    dimensions: int = 0
    is_nullable: bool = False
    element_type: Optional[TypeDescriptor] = None

    def validate_value(self, value: Any) -> Tuple[bool, Optional[str]]:
        """
        Validates whether a python object strictly matches this TypeDescriptor.
        Does not perform unsafe coercion (e.g. string "123" is NOT an integer;
        boolean True is NOT an integer).
        """
        if self.is_nullable:
            if value is None or value == "null":
                return True, None
            if self.element_type:
                return self.element_type.validate_value(value)

        if value is None:
            return False, f"Non-nullable parameter declared as '{self.raw_type}' received null/None"

        if self.kind == TypeKind.PRIMITIVE:
            if self.base == "int":
                if isinstance(value, bool):
                    return False, f"Expected int, got boolean ({value})"
                if not isinstance(value, int):
                    return False, f"Expected int, got {type(value).__name__}"
                return True, None

            elif self.base == "float":
                if isinstance(value, bool):
                    return False, f"Expected float, got boolean ({value})"
                if not isinstance(value, (int, float)):
                    return False, f"Expected float, got {type(value).__name__}"
                return True, None

            elif self.base == "boolean":
                if not isinstance(value, bool):
                    return False, f"Expected boolean, got {type(value).__name__}"
                return True, None

            elif self.base == "string":
                if not isinstance(value, str):
                    return False, f"Expected string, got {type(value).__name__}"
                return True, None

        elif self.kind == TypeKind.ARRAY:
            if not isinstance(value, (list, tuple)):
                return False, f"Expected array/list, got {type(value).__name__}"
            elem_desc = self.element_type or parse_type_descriptor(self.base)
            for idx, item in enumerate(value):
                ok, err = elem_desc.validate_value(item)
                if not ok:
                    return False, f"Array element at index [{idx}]: {err}"
            return True, None

        elif self.kind == TypeKind.OBJECT:
            if not isinstance(value, dict):
                return False, f"Expected object/dictionary, got {type(value).__name__}"
            return True, None

        elif self.kind == TypeKind.VOID:
            return True, None

        return True, None


def parse_type_descriptor(type_input: Union[str, DataType, TypeDescriptor]) -> TypeDescriptor:
    """
    Parses any valid type expression into a canonical TypeDescriptor.
    Supports:
      - Primitives: int, integer, long, float, double, boolean, bool, string, str
      - Generic arrays: array<T>, list<T>, list[T]
      - Bracket arrays: T[], T[][]
      - Nullables: nullable<T>, T?
      - Objects: object, map, dict
      - Void: void
    """
    if isinstance(type_input, TypeDescriptor):
        return type_input

    raw = type_input.value if isinstance(type_input, DataType) else str(type_input).strip()
    s = raw.strip().lower()

    # Nullable wrapper: nullable<T> or T?
    if s.startswith("nullable<") and s.endswith(">"):
        inner = parse_type_descriptor(raw[9:-1].strip())
        return TypeDescriptor(
            raw_type=f"nullable<{inner.raw_type}>",
            kind=TypeKind.NULLABLE,
            base=inner.base,
            dimensions=inner.dimensions,
            is_nullable=True,
            element_type=inner,
        )
    if s.endswith("?") and len(s) > 1:
        inner = parse_type_descriptor(raw[:-1].strip())
        return TypeDescriptor(
            raw_type=f"nullable<{inner.raw_type}>",
            kind=TypeKind.NULLABLE,
            base=inner.base,
            dimensions=inner.dimensions,
            is_nullable=True,
            element_type=inner,
        )

    # Generic Array: array<T> or list<T> or list[T]
    if s.startswith("array<") and s.endswith(">"):
        inner = parse_type_descriptor(raw[6:-1].strip())
        return TypeDescriptor(
            raw_type=f"array<{inner.raw_type}>",
            kind=TypeKind.ARRAY,
            base=inner.base,
            dimensions=inner.dimensions + 1,
            is_nullable=False,
            element_type=inner,
        )
    if s.startswith("list<") and s.endswith(">"):
        inner = parse_type_descriptor(raw[5:-1].strip())
        return TypeDescriptor(
            raw_type=f"array<{inner.raw_type}>",
            kind=TypeKind.ARRAY,
            base=inner.base,
            dimensions=inner.dimensions + 1,
            is_nullable=False,
            element_type=inner,
        )
    if s.startswith("list[") and s.endswith("]"):
        inner = parse_type_descriptor(raw[5:-1].strip())
        return TypeDescriptor(
            raw_type=f"array<{inner.raw_type}>",
            kind=TypeKind.ARRAY,
            base=inner.base,
            dimensions=inner.dimensions + 1,
            is_nullable=False,
            element_type=inner,
        )

    # Bracket Array: T[] or T[][]
    if s.endswith("[]"):
        inner = parse_type_descriptor(raw[:-2].strip())
        return TypeDescriptor(
            raw_type=f"array<{inner.raw_type}>",
            kind=TypeKind.ARRAY,
            base=inner.base,
            dimensions=inner.dimensions + 1,
            is_nullable=False,
            element_type=inner,
        )

    # Primitives & Scalars
    if s in ("int", "integer", "long", "long long", "number", "size_t", "usize", "isize", "u32", "u64", "i32", "i64", "int32", "int64"):
        return TypeDescriptor(raw_type="int", kind=TypeKind.PRIMITIVE, base="int", dimensions=0)
    elif s in ("float", "double", "f32", "f64"):
        return TypeDescriptor(raw_type="float", kind=TypeKind.PRIMITIVE, base="float", dimensions=0)
    elif s in ("boolean", "bool"):
        return TypeDescriptor(raw_type="boolean", kind=TypeKind.PRIMITIVE, base="boolean", dimensions=0)
    elif s in ("string", "str", "char*", "char", "&str", "string_view"):
        return TypeDescriptor(raw_type="string", kind=TypeKind.PRIMITIVE, base="string", dimensions=0)
    elif s in ("object", "map", "dict", "any", "unknown", "auto"):
        return TypeDescriptor(raw_type="object", kind=TypeKind.OBJECT, base="object", dimensions=0)
    elif s in ("void", "none"):
        return TypeDescriptor(raw_type="void", kind=TypeKind.VOID, base="void", dimensions=0)

    raise ValueError(f"Unsupported data type: '{raw}'. Valid types: int, float, boolean, string, array<T>, object, nullable<T>.")


# ---------------------------------------------------------------------------
# Parameter & Function Signature
# ---------------------------------------------------------------------------

class ParameterDefinition(BaseModel):
    name: str = Field(..., description="Parameter variable name")
    type: str = Field(..., description="Standardized parameter data type")

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

    @field_validator("type", mode="before")
    @classmethod
    def validate_type(cls, v: Any) -> str:
        td = parse_type_descriptor(v)
        return td.raw_type


class FunctionSignature(BaseModel):
    class_name: str = Field(
        default="Solution",
        description="Target class name in contestant code (default: Solution)",
    )
    name: str = Field(
        default="",
        description="Target function/method name in Solution class",
    )
    function_name: Optional[str] = Field(
        default=None,
        description="Explicit function name alias (matches LeetCode contract)",
    )
    parameters: List[ParameterDefinition] = Field(
        default_factory=list,
        description="Ordered list of function parameters",
    )
    return_type: str = Field(
        default="int",
        description="Expected return data type",
    )

    @model_validator(mode="before")
    @classmethod
    def sync_names_and_defaults(cls, data: Any) -> Any:
        if isinstance(data, dict):
            fn = data.get("function_name") or data.get("name")
            if fn:
                data["name"] = fn
                data["function_name"] = fn
            if not data.get("class_name"):
                data["class_name"] = "Solution"
        return data

    @field_validator("class_name")
    @classmethod
    def validate_class_name(cls, v: str) -> str:
        cleaned = (v or "Solution").strip()
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", cleaned):
            raise ValueError(f"Class name '{cleaned}' must be a valid programming identifier.")
        return cleaned

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
        if cleaned in {"__init__", "main", "constructor"}:
            raise ValueError(f"Function name '{cleaned}' conflicts with class or runtime entry points.")
        return cleaned

    @field_validator("return_type", mode="before")
    @classmethod
    def validate_return_type(cls, v: Any) -> str:
        td = parse_type_descriptor(v)
        return td.raw_type

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
    input: Any = Field(..., description="Positional argument array or parameter dictionary")
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
    Validates whether a python object matches the specified DataType or type string contract.
    Returns (True, None) or (False, error_message).
    """
    try:
        desc = parse_type_descriptor(expected_type)
        return desc.validate_value(value)
    except Exception as e:
        return False, str(e)
