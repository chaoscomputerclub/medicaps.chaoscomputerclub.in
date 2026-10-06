"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/judge/test_language_conformance.py — Multi-Language Execution & Sandbox Invariants

Linked Bugs: REG-0005, REG-0006, REG-0007, REG-0008
Invariant: EXECUTION_RUNNERS_MUST_PRESERVE_SUBMISSION_MODE_AND_ISOLATE_SANDBOX
"""

import pytest
import json
from app.engine.adapters.python_adapter import PythonAdapter
from app.engine.adapters.rust_adapter import RustAdapter
from app.engine.adapters.javascript_adapter import JavaScriptAdapter
from app.engine.adapters.cpp_adapter import CppAdapter
from app.engine.contracts import FunctionSignature, ParameterDefinition


@pytest.fixture
def sample_signature() -> FunctionSignature:
    return FunctionSignature(
        class_name="Solution",
        name="twoSum",
        return_type="integer[]",
        parameters=[
            ParameterDefinition(name="nums", type="integer[]"),
            ParameterDefinition(name="target", type="int"),
        ],
    )


@pytest.mark.regression("REG-0005")
def test_python_adapter_null_return_and_delimiter_contract(sample_signature):
    """
    REG-0005 Invariant:
    Python runner driver must preserve None/null return values as canonical JSON null
    rather than stringifying to 'None' or crashing, and must wrap outputs in <<<CCC_RUNNER_RESULT>>>.
    """
    adapter = PythonAdapter()
    user_code = "class Solution:\n    def twoSum(self, nums, target):\n        return None"
    wrapper = adapter.generate_wrapper(sample_signature, user_code)

    # Invariant checks:
    # 1. Delimiter must be present
    assert "<<<CCC_RUNNER_RESULT>>>" in wrapper
    # 2. None return value must be preserved as JSON null, not "None"
    assert "or result is None" in wrapper
    assert 'json.dumps({"status": "SUCCESS", "return_value": canonical_val}' in wrapper or 'canonical_val' in wrapper


@pytest.mark.regression("REG-0006")
def test_rust_adapter_escaped_templates_and_starter_generation(sample_signature):
    """
    REG-0006 Invariant:
    Rust adapter must produce valid Rust syntax for starter code without broken
    f-string brace escaping.
    """
    adapter = RustAdapter()
    starter = adapter.generate_starter_code(sample_signature)

    assert "impl Solution" in starter
    assert "pub fn two_sum" in starter or "pub fn twoSum" in starter
    assert "Vec<i32>" in starter or "i32" in starter

    user_code = "impl Solution { pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> { vec![] } }"
    wrapper = adapter.generate_wrapper(sample_signature, user_code)
    assert "fn main()" in wrapper
    assert "<<<CCC_RUNNER_RESULT>>>" in wrapper


@pytest.mark.regression("REG-0007")
def test_javascript_and_cpp_adapter_starter_generation(sample_signature):
    """
    REG-0007 Invariant:
    JavaScript and C++ adapters must support the unified FunctionSignature contract
    and generate standard starter templates.
    """
    js_adapter = JavaScriptAdapter()
    js_starter = js_adapter.generate_starter_code(sample_signature)
    assert "twoSum" in js_starter
    assert "function" in js_starter or "var" in js_starter or "let" in js_starter or "class" in js_starter

    cpp_adapter = CppAdapter()
    cpp_starter = cpp_adapter.generate_starter_code(sample_signature)
    assert "class Solution" in cpp_starter
    assert "twoSum" in cpp_starter
    assert "vector<int>" in cpp_starter


@pytest.mark.regression("REG-0008")
def test_python_driver_stdin_param_assignment_parsing():
    """
    REG-0008 Invariant:
    Python runner driver must parse LeetCode-style 'paramName = value' stdin lines correctly.
    """
    adapter = PythonAdapter()
    sig = FunctionSignature(
        class_name="Solution",
        name="isPalindrome",
        return_type="boolean",
        parameters=[ParameterDefinition(name="s", type="string")],
    )
    wrapper = adapter.generate_wrapper(sig, "class Solution:\n    def isPalindrome(self, s): return True")
    assert "_ccc_parse_param_assign" in wrapper
