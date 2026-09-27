"""
Chaos Computer Club — Problem Authoring & Pre-Publish Validation Service
Validates algorithmic challenge definitions, function signatures, typed parameters,
starter code coverage, testcase vaults, and optional reference solution verification.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.engine.contracts import (
    DataType,
    FunctionSignature,
    ParameterDefinition,
    EvaluationConfig,
    SandboxConfig,
    StructuredTestCase,
    validate_value_type,
)
from app.engine.adapters import get_adapter, OutputEvaluator


class ValidationReport(BaseModel):
    is_valid: bool = Field(..., description="Whether problem passes all mandatory criteria for publishing")
    errors: List[str] = Field(default_factory=list, description="List of blocking validation failure reasons")
    warnings: List[str] = Field(default_factory=list, description="Non-blocking recommendations and advice")
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Summary audit metrics")


class ProblemValidator:
    """Pre-publish validation engine ensuring 100% correctness of problem definitions."""

    @classmethod
    async def validate_problem(
        cls,
        problem_data: Dict[str, Any],
        visible_testcases: List[Dict[str, Any]],
        hidden_testcases: List[Dict[str, Any]],
        run_reference_solution: bool = False,
    ) -> ValidationReport:
        errors: List[str] = []
        warnings: List[str] = []

        # 1. Basic Information
        title = (problem_data.get("title") or "").strip()
        if not title:
            errors.append("Problem title is required and cannot be empty.")
        elif len(title) < 3:
            errors.append("Problem title must be at least 3 characters.")

        slug = (problem_data.get("slug") or "").strip()
        if not slug:
            errors.append("Problem slug is required.")
        elif not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", slug):
            errors.append("Problem slug must contain only lowercase alphanumeric characters and hyphens (e.g. 'network-route').")

        description = (problem_data.get("description") or "").strip()
        if not description:
            errors.append("Problem statement description is required.")
        elif len(description) < 20:
            errors.append("Problem statement description must provide adequate context (at least 20 characters).")

        constraints = (problem_data.get("constraints") or "").strip()
        if not constraints:
            errors.append("Problem constraints must be specified (e.g. time, memory, data bounds).")

        # 2. Execution Mode & Function Signature
        exec_mode = problem_data.get("execution_mode", "FUNCTION")
        raw_sig = problem_data.get("function_signature") or {}

        parsed_sig: Optional[FunctionSignature] = None
        if exec_mode == "FUNCTION":
            fn_name = (raw_sig.get("name") or problem_data.get("function_name") or "").strip()
            if not fn_name:
                errors.append("Function name is required for FUNCTION execution mode.")
            else:
                try:
                    # Validate identifier
                    FunctionSignature.validate_function_name(fn_name)
                except Exception as e:
                    errors.append(f"Invalid function name '{fn_name}': {e}")

            raw_params = raw_sig.get("parameters") or []
            parsed_params: List[ParameterDefinition] = []
            param_names_seen = set()

            for idx, p in enumerate(raw_params):
                p_name = (p.get("name") or "").strip()
                p_type_val = p.get("type")
                if not p_name:
                    errors.append(f"Parameter #{idx+1} name is missing.")
                    continue
                if p_name in param_names_seen:
                    errors.append(f"Duplicate parameter name '{p_name}'.")
                param_names_seen.add(p_name)

                try:
                    p_type = DataType(p_type_val)
                except Exception:
                    errors.append(f"Parameter '{p_name}' has unrecognized data type '{p_type_val}'.")
                    continue

                try:
                    parsed_params.append(ParameterDefinition(name=p_name, type=p_type))
                except Exception as e:
                    errors.append(f"Parameter '{p_name}' definition error: {e}")

            ret_type_val = raw_sig.get("return_type", "integer")
            try:
                ret_type = DataType(ret_type_val)
            except Exception:
                errors.append(f"Unrecognized return type '{ret_type_val}'.")
                ret_type = DataType.INTEGER

            if fn_name and not errors:
                try:
                    parsed_sig = FunctionSignature(
                        name=fn_name,
                        parameters=parsed_params,
                        return_type=ret_type,
                    )
                except Exception as e:
                    errors.append(f"Function signature validation failed: {e}")

        # 3. Starter Code Coverage
        starter_code = problem_data.get("starter_code") or {}
        required_langs = ["python", "cpp", "c", "java", "javascript", "typescript"]
        for lang in required_langs:
            code_snippet = starter_code.get(lang, "").strip()
            if not code_snippet:
                if parsed_sig:
                    warnings.append(f"Starter code for '{lang}' was missing; can be auto-generated from signature.")
                else:
                    errors.append(f"Missing starter code for required language '{lang}'.")

        # 4. Resource & Sandbox Bounds
        time_limit = float(problem_data.get("time_limit", 2.0) or 2.0)
        if time_limit < 0.1 or time_limit > 15.0:
            errors.append(f"Time limit {time_limit}s is out of safe range [0.1s, 15.0s].")

        memory_limit = int(problem_data.get("memory_limit", 256) or 256)
        if memory_limit < 16 or memory_limit > 1024:
            errors.append(f"Memory limit {memory_limit}MB is out of safe range [16MB, 1024MB].")

        # 5. Visible Testcase Suite
        if not visible_testcases:
            errors.append("At least 1 visible sample testcase must be provided.")
        elif len(visible_testcases) < 3:
            warnings.append(f"Recommended 3 visible sample testcases (current count: {len(visible_testcases)}).")

        # 6. Hidden Testcase Vault
        if not hidden_testcases:
            errors.append("At least 1 hidden edge-case testcase must be stored in the cryptographic vault.")
        elif len(hidden_testcases) < 15:
            warnings.append(f"Collegiate standard recommends at least 15 hidden testcases for robust evaluation (current count: {len(hidden_testcases)}).")

        # 7. Testcase Structure & Type Compatibility Checks
        all_cases = [("visible", c) for c in visible_testcases] + [("hidden", c) for c in hidden_testcases]
        tc_ids_seen = set()

        for case_type, tc in all_cases:
            tc_id = tc.get("testcase_id") or tc.get("id") or ""
            if not tc_id:
                errors.append(f"A {case_type} testcase is missing a unique 'testcase_id'.")
            elif tc_id in tc_ids_seen:
                errors.append(f"Duplicate testcase_id '{tc_id}' detected.")
            else:
                tc_ids_seen.add(tc_id)

            if parsed_sig:
                tc_input = tc.get("input_data") or tc.get("input") or {}
                # In function mode, input must be a dictionary mapping parameter names to values
                if not isinstance(tc_input, dict):
                    errors.append(f"Testcase '{tc_id}' input must be a structured JSON dictionary mapping parameter names to values.")
                else:
                    for p in parsed_sig.parameters:
                        if p.name not in tc_input:
                            errors.append(f"Testcase '{tc_id}' is missing required parameter '{p.name}'.")
                        else:
                            val = tc_input[p.name]
                            valid, err_msg = validate_value_type(val, p.type)
                            if not valid:
                                errors.append(f"Testcase '{tc_id}' parameter '{p.name}' invalid: {err_msg}")

                # Validate expected_output matches return_type
                expected_out = tc.get("expected_output")
                if expected_out is None and tc.get("output") is not None:
                    expected_out = tc.get("output")

                if expected_out is None:
                    errors.append(f"Testcase '{tc_id}' must provide an 'expected_output'.")
                else:
                    valid, err_msg = validate_value_type(expected_out, parsed_sig.return_type)
                    if not valid:
                        errors.append(f"Testcase '{tc_id}' expected_output invalid for return type {parsed_sig.return_type.value}: {err_msg}")

        # 8. Reference Solution Execution (Optional verification)
        ref_solutions = problem_data.get("reference_solution") or {}
        if run_reference_solution and ref_solutions.get("python") and parsed_sig and not errors:
            py_code = ref_solutions["python"]
            ref_err = await cls._verify_python_reference_solution(
                py_code=py_code,
                signature=parsed_sig,
                testcases=visible_testcases + hidden_testcases,
                time_limit=time_limit,
                memory_limit=memory_limit,
            )
            if ref_err:
                errors.append(f"Reference Solution failed verification: {ref_err}")

        is_valid = len(errors) == 0
        return ValidationReport(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
            metrics={
                "visible_count": len(visible_testcases),
                "hidden_count": len(hidden_testcases),
                "parameter_count": len(parsed_sig.parameters) if parsed_sig else 0,
                "has_reference_solution": bool(ref_solutions),
            },
        )

    @classmethod
    async def _verify_python_reference_solution(
        cls,
        py_code: str,
        signature: FunctionSignature,
        testcases: List[Dict[str, Any]],
        time_limit: float,
        memory_limit: int,
    ) -> Optional[str]:
        """Runs the reference solution against testcases in the sandbox to verify 100% acceptance."""
        from app.engine.providers.factory import get_judge_provider
        from app.engine.schemas import TestCaseSchema
        from app.engine.enums import Language, ComparisonMode

        adapter = get_adapter("python")
        exec_code = adapter.generate_wrapper(signature, py_code)

        tc_schemas: List[TestCaseSchema] = []
        for idx, tc in enumerate(testcases):
            tc_id = tc.get("testcase_id") or tc.get("id") or f"tc_{idx+1}"
            raw_input = tc.get("input_data") or tc.get("input") or {}
            serialized_stdin = adapter.serialize_input(signature, raw_input) if isinstance(raw_input, dict) else str(raw_input)
            tc_schemas.append(
                TestCaseSchema(
                    id=tc_id,
                    name=tc_id,
                    stdin=serialized_stdin,
                    expected_output="",
                )
            )

        provider = get_judge_provider()
        try:
            res = await provider.execute_batch(
                language=Language.PYTHON,
                code=exec_code,
                testcases=tc_schemas,
                time_limit=time_limit,
                memory_limit_mb=memory_limit,
                comparison_mode=ComparisonMode.TRIMMED,
            )
            for idx, tr in enumerate(res.testcase_results):
                orig_tc = testcases[idx]
                expected_out = orig_tc.get("expected_output") if orig_tc.get("expected_output") is not None else orig_tc.get("output")
                passed, msg, _ = OutputEvaluator.compare(tr.stdout or "", expected_out, signature.return_type)
                if not passed:
                    return f"Failed on testcase '{tr.testcase_id}': {msg} (stdout: '{tr.stdout.strip()}')"
            return None
        except Exception as e:
            return f"Sandbox execution error: {e}"
