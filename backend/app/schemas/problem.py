"""
Chaos Computer Club — Master Problem Domain Schemas
Pydantic schemas for problem authoring, function contracts, testcase vaults, and versioning.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

from app.engine.contracts import DataType, FunctionSignature, EvaluationConfig, SandboxConfig


class TestCaseInputSchema(BaseModel):
    __test__ = False
    testcase_id: str = Field(..., description="Unique testcase identifier (e.g. SAMPLE-01, TC-01)")
    input: Dict[str, Any] = Field(..., description="Structured dictionary mapping parameter name -> value")
    expected_output: Any = Field(..., description="Expected output value")
    explanation: Optional[str] = Field(None, description="Optional explanation for visible testcase")
    weight: float = Field(1.0, ge=0.0, description="Testcase score weight")
    is_hidden: bool = Field(False, description="True for hidden edge cases, False for visible sample cases")
    order: int = Field(0, description="Display/execution ordering")


class TestCaseUpdateSchema(BaseModel):
    __test__ = False
    input: Optional[Dict[str, Any]] = Field(None, description="Structured parameter values")
    expected_output: Optional[Any] = Field(None, description="Expected return value")
    explanation: Optional[str] = None
    weight: Optional[float] = Field(None, ge=0.0)
    is_hidden: Optional[bool] = None
    order: Optional[int] = None



class ProblemCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    slug: Optional[str] = Field(None, max_length=80, description="URL slug (auto-generated from title if blank)")
    problem_index: str = Field("A", max_length=5)
    difficulty: Literal["EASY", "MEDIUM", "HARD"] = Field("MEDIUM")
    topic: str = Field("Algorithms", max_length=60)
    points: int = Field(100, ge=10, le=1000)
    description: str = Field(..., min_length=10)
    constraints: Optional[str] = None
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    execution_mode: Literal["FUNCTION", "STDIN_STDOUT"] = Field("FUNCTION")
    function_signature: Optional[FunctionSignature] = None
    starter_code: Optional[Dict[str, str]] = None
    time_limit: float = Field(2.0, ge=0.1, le=15.0)
    memory_limit: int = Field(256, ge=16, le=1024)
    evaluation_config: Optional[EvaluationConfig] = None
    sandbox_config: Optional[SandboxConfig] = None
    reference_solution: Optional[Dict[str, str]] = None
    sample_testcases: Optional[List[TestCaseInputSchema]] = None
    hidden_testcases: Optional[List[TestCaseInputSchema]] = None


class ProblemUpdateRequest(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    problem_index: Optional[str] = None
    difficulty: Optional[Literal["EASY", "MEDIUM", "HARD"]] = None
    topic: Optional[str] = None
    points: Optional[int] = None
    description: Optional[str] = None
    constraints: Optional[str] = None
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    execution_mode: Optional[Literal["FUNCTION", "STDIN_STDOUT"]] = None
    function_signature: Optional[FunctionSignature] = None
    starter_code: Optional[Dict[str, str]] = None
    time_limit: Optional[float] = None
    memory_limit: Optional[int] = None
    evaluation_config: Optional[EvaluationConfig] = None
    sandbox_config: Optional[SandboxConfig] = None
    reference_solution: Optional[Dict[str, str]] = None


class TestCaseVaultResponse(BaseModel):
    __test__ = False
    id: str

    problem_id: str
    version: int
    testcase_id: str
    input: Dict[str, Any]
    expected_output: Optional[Any] = None
    explanation: Optional[str] = None
    weight: float
    is_hidden: bool
    order: int
    is_active: bool
    created_at: datetime


class ProblemSummaryResponse(BaseModel):
    id: str
    slug: str
    problem_index: str
    title: str
    difficulty: str
    topic: str
    points: int
    status: str
    version: int
    execution_mode: str
    created_at: datetime
    updated_at: datetime


class ProblemDetailResponse(BaseModel):
    id: str
    slug: str
    problem_index: str
    title: str
    difficulty: str
    topic: str
    points: int
    description: str
    constraints: Optional[str] = None
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    execution_mode: str
    function_signature: Dict[str, Any]
    starter_code: Dict[str, str]
    time_limit: float
    memory_limit: int
    evaluation_config: Dict[str, Any]
    sandbox_config: Dict[str, Any]
    reference_solution: Optional[Dict[str, str]] = None
    status: str
    version: int
    created_at: datetime
    updated_at: datetime
    visible_testcases: List[Dict[str, Any]] = []
    hidden_testcases: Optional[List[Dict[str, Any]]] = None  # None for contestants, populated for authorized admins


class ProblemVersionResponse(BaseModel):
    id: str
    problem_id: str
    version: int
    title: str
    slug: str
    difficulty: str
    topic: str
    points: int
    execution_mode: str
    function_signature: Dict[str, Any]
    starter_code: Dict[str, str]
    time_limit: float
    memory_limit: int
    created_at: datetime
