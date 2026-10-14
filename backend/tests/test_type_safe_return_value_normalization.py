"""
Interleet Judge: Type-Safe Return Value Normalization Test Suite

Validates production-grade, language-independent type-safe return-value normalization
across supported languages (JavaScript, Python, Java, C, Go, Rust), ensuring:
1. Strict type contract enforcement (e.g. int 6 vs str "6", bool true vs str "true")
2. Console output (stdout) and envelope separation
3. Floating-point epsilon tolerance comparisons
4. Array and matrix structural equivalence and order preservation
5. Void / in-place state mutation handling
6. Resilience against envelope corruption (fail-closed PROTOCOL_ERROR)
7. Full JavaScript Maximum Subarray scenario (integer vs toString)
8. Identical evaluation semantics across Run and Submit with hidden testcase masking
"""

import json
import pytest
from app.engine.adapters.evaluator import OutputEvaluator, EvaluationConfig
from app.engine.contracts import DataType, FunctionSignature, ParameterDefinition
from app.engine.enums import ComparisonMode, Language, Verdict
from app.engine.judge import JudgeEngine
from app.engine.languages import LanguageRegistry
from app.engine.schemas import TestCaseSchema, TestCaseResult, SandboxResult


# =============================================================================
# 1. SEMANTIC TYPE VS TRANSPORT SERIALIZATION MATRIX
# =============================================================================

def test_integer_type_contract_rejects_string():
    """Integer problem accepts integer 6, rejects string '6'."""
    cfg = EvaluationConfig()

    # Pass: Integer 6
    passed, msg, val = OutputEvaluator.compare(
        actual_raw=6,
        expected_val=6,
        return_type=DataType.INTEGER,
        cfg=cfg,
    )
    assert passed is True
    assert val == 6

    # Pass: JSON string representing integer 6 from runner envelope
    passed, msg, val = OutputEvaluator.compare(
        actual_raw="6\n",
        expected_val=6,
        return_type=DataType.INTEGER,
        cfg=cfg,
    )
    assert passed is True
    assert val == 6

    # Fail: Actual return value is a genuine quoted string "6"
    passed, msg, val = OutputEvaluator.compare(
        actual_raw='"6"',
        expected_val=6,
        return_type=DataType.INTEGER,
        cfg=cfg,
    )
    assert passed is False
    assert "Type mismatch" in msg
    assert "expected integer" in msg

    # Fail: Actual return value in envelope was string "6"
    envelope_raw = '\n<<<CCC_RUNNER_RESULT>>>\n{"status":"SUCCESS","return_value":"6"}\n<<<CCC_RUNNER_RESULT>>>\n'
    passed, msg, val = OutputEvaluator.compare(
        actual_raw=envelope_raw,
        expected_val=6,
        return_type=DataType.INTEGER,
        cfg=cfg,
    )
    assert passed is False
    assert "Type mismatch" in msg


def test_string_type_contract_rejects_integer():
    """String problem accepts string '6', rejects integer 6."""
    cfg = EvaluationConfig()

    # Pass: Genuine string "6"
    passed, msg, val = OutputEvaluator.compare(
        actual_raw='"6"',
        expected_val="6",
        return_type=DataType.STRING,
        cfg=cfg,
    )
    assert passed is True
    assert val == "6"

    # Pass: String in envelope
    envelope_raw = '\n<<<CCC_RUNNER_RESULT>>>\n{"status":"SUCCESS","return_value":"6"}\n<<<CCC_RUNNER_RESULT>>>\n'
    passed, msg, val = OutputEvaluator.compare(
        actual_raw=envelope_raw,
        expected_val="6",
        return_type=DataType.STRING,
        cfg=cfg,
    )
    assert passed is True
    assert val == "6"

    # Fail: Actual return value is integer 6
    passed, msg, val = OutputEvaluator.compare(
        actual_raw=6,
        expected_val="6",
        return_type=DataType.STRING,
        cfg=cfg,
    )
    assert passed is False
    assert "Type mismatch" in msg
    assert "expected string" in msg

    # Fail: Envelope with integer 6 rejected for string return type
    envelope_int = '\n<<<CCC_RUNNER_RESULT>>>\n{"status":"SUCCESS","return_value":6}\n<<<CCC_RUNNER_RESULT>>>\n'
    passed, msg, val = OutputEvaluator.compare(
        actual_raw=envelope_int,
        expected_val="6",
        return_type=DataType.STRING,
        cfg=cfg,
    )
    assert passed is False
    assert "Type mismatch" in msg


def test_boolean_type_contract_rejects_string():
    """Boolean problem accepts boolean True/False, rejects string 'true'/'false'."""
    cfg = EvaluationConfig()

    # Pass: Boolean true
    passed, msg, val = OutputEvaluator.compare(
        actual_raw=True,
        expected_val="true",
        return_type=DataType.BOOLEAN,
        cfg=cfg,
    )
    assert passed is True
    assert val is True

    # Pass: Unquoted 'true' from transport stdout
    passed, msg, val = OutputEvaluator.compare(
        actual_raw="true\n",
        expected_val=True,
        return_type=DataType.BOOLEAN,
        cfg=cfg,
    )
    assert passed is True
    assert val is True

    # Fail: Genuine string '"true"'
    passed, msg, val = OutputEvaluator.compare(
        actual_raw='"true"',
        expected_val=True,
        return_type=DataType.BOOLEAN,
        cfg=cfg,
    )
    assert passed is False
    assert "Type mismatch" in msg

    # Fail: String return type rejecting boolean
    passed, msg, val = OutputEvaluator.compare(
        actual_raw=True,
        expected_val="true",
        return_type=DataType.STRING,
        cfg=cfg,
    )
    assert passed is False
    assert "Type mismatch" in msg


def test_float_tolerance_and_bounds():
    """Float return types evaluate within epsilon tolerance."""
    cfg = EvaluationConfig(float_tolerance=1e-5)

    # Within tolerance
    passed, msg, val = OutputEvaluator.compare(
        actual_raw=3.1415926,
        expected_val=3.1415927,
        return_type=DataType.FLOAT,
        cfg=cfg,
    )
    assert passed is True

    # Outside tolerance
    passed, msg, val = OutputEvaluator.compare(
        actual_raw=3.14,
        expected_val=3.14159,
        return_type=DataType.FLOAT,
        cfg=cfg,
    )
    assert passed is False
    assert "Float mismatch" in msg

    # NaN and Inf fail closed
    passed, msg, val = OutputEvaluator.compare(
        actual_raw=float("nan"),
        expected_val=0.0,
        return_type=DataType.FLOAT,
        cfg=cfg,
    )
    assert passed is False
    assert "Non-finite" in msg


def test_array_structural_equivalence_and_order():
    """Arrays must preserve order while normalizing formatting."""
    cfg = EvaluationConfig()

    # Formatting normalized: [0, 1] vs [0,1]
    passed, msg, val = OutputEvaluator.compare(
        actual_raw="[0, 1]",
        expected_val="[0,1]",
        return_type=DataType.INTEGER_ARRAY,
        cfg=cfg,
    )
    assert passed is True
    assert val == [0, 1]

    # Order preserved: [1, 0] vs [0, 1] MUST fail
    passed, msg, val = OutputEvaluator.compare(
        actual_raw="[1, 0]",
        expected_val="[0, 1]",
        return_type=DataType.INTEGER_ARRAY,
        cfg=cfg,
    )
    assert passed is False
    assert "Mismatch" in msg or "Expected" in msg


def test_void_inplace_mutation_evaluation():
    """Void return type evaluates mutated parameter state against expected output."""
    cfg = EvaluationConfig()

    # Contestant modified in-place array to [1, 2, 3, 4]
    passed, msg, val = OutputEvaluator.compare(
        actual_raw=[1, 2, 3, 4],
        expected_val="[1, 2, 3, 4]",
        return_type=DataType.VOID,
        cfg=cfg,
    )
    assert passed is True
    assert val == [1, 2, 3, 4]

    # In-place modification incorrect
    passed, msg, val = OutputEvaluator.compare(
        actual_raw=[4, 3, 2, 1],
        expected_val="[1, 2, 3, 4]",
        return_type=DataType.VOID,
        cfg=cfg,
    )
    assert passed is False

    # Genuine void with empty expected output
    passed, msg, val = OutputEvaluator.compare(
        actual_raw=None,
        expected_val="",
        return_type=DataType.VOID,
        config=cfg,
    )
    assert passed is True


# =============================================================================
# 2. SEPARATION OF CONSOLE STDOUT FROM RUNNER ENVELOPE
# =============================================================================

def test_stdout_separation_from_envelope():
    """Contestant debug logs must not corrupt evaluation or envelope extraction."""
    raw_output = """Debug log: processing index 0
Debug log: sum = 42
Console.log output
<<<CCC_RUNNER_RESULT>>>
{"status": "SUCCESS", "return_value": 42}
<<<CCC_RUNNER_RESULT>>>
Extra trailing output"""

    envelope, user_stdout = JudgeEngine.parse_runner_envelope(raw_output)
    assert envelope is not None
    assert envelope["status"] == "SUCCESS"
    assert envelope["return_value"] == 42
    assert "Debug log: processing index 0" in user_stdout
    assert "Console.log output" in user_stdout
    assert "<<<CCC_RUNNER_RESULT>>>" not in user_stdout


def test_corrupt_envelope_handling_fail_closed():
    """Corrupt envelope JSON fails closed with PROTOCOL_ERROR."""
    corrupt_output = """Debug log line
<<<CCC_RUNNER_RESULT>>>
{not valid json!!!}
<<<CCC_RUNNER_RESULT>>>
"""
    envelope, user_stdout = JudgeEngine.parse_runner_envelope(corrupt_output)
    assert envelope is not None
    assert envelope["status"] == "PROTOCOL_ERROR"
    assert "Malformed runner result" in envelope.get("error", "")

    # JudgeEngine evaluation marks this as SYSTEM_ERROR / PROTOCOL_ERROR
    tc = TestCaseSchema(id="tc1", name="Test 1", stdin="", expected_output="42", return_type="int")
    sb_res = SandboxResult(stdout=corrupt_output, stderr="", exit_code=0)
    tc_res = JudgeEngine.evaluate(sb_res, tc)

    assert tc_res.passed is False
    assert tc_res.verdict in (Verdict.RUNTIME_ERROR, Verdict.SYSTEM_ERROR)
    assert "Malformed runner result" in (tc_res.stderr or "") or "Runner protocol" in (tc_res.stderr or "")


# =============================================================================
# 3. END-TO-END MAXIMUM SUBARRAY JAVASCRIPT SCENARIO
# =============================================================================

@pytest.mark.asyncio
async def test_javascript_max_subarray_type_safety():
    """
    Validates the user's specific JavaScript scenario:
    - Solution returning `maxSum` (number) -> ACCEPTED
    - Solution returning `maxSum.toString()` (string) -> WRONG_ANSWER (type contract rejection)
    """
    max_subarray_sig = FunctionSignature(
        name="maxSubArray",
        parameters=[ParameterDefinition(name="nums", type=DataType.INTEGER_ARRAY)],
        return_type=DataType.INTEGER,
    )

    js_adapter = LanguageRegistry.get_adapter(Language.JAVASCRIPT)

    # Correct JS solution: returns number
    correct_js = """
var maxSubArray = function(nums) {
    let max = nums[0];
    let cur = nums[0];
    for (let i = 1; i < nums.length; i++) {
        cur = Math.max(nums[i], cur + nums[i]);
        max = Math.max(max, cur);
    }
    return max;
};
"""
    # Flawed JS solution: returns string via .toString()
    flawed_js = """
var maxSubArray = function(nums) {
    let max = nums[0];
    let cur = nums[0];
    for (let i = 1; i < nums.length; i++) {
        cur = Math.max(nums[i], cur + nums[i]);
        max = Math.max(max, cur);
    }
    return max.toString();
};
"""

    correct_wrapper = js_adapter.generate_wrapper(max_subarray_sig, correct_js)
    flawed_wrapper = js_adapter.generate_wrapper(max_subarray_sig, flawed_js)

    # Testcase: nums = [-2,1,-3,4,-1,2,1,-5,4] -> expected: 6
    tc_input = "nums = [-2,1,-3,4,-1,2,1,-5,4]"
    tc = TestCaseSchema(
        id="tc_sample",
        name="Sample 1",
        stdin=tc_input,
        expected_output="6",
        return_type="int",
        expected_val=6,
    )

    from app.engine.pipeline import LanguageAwareExecutionEngine
    pipeline = LanguageAwareExecutionEngine.get_instance()

    # 1. Run correct code
    res_correct = await pipeline.execute(
        language=Language.JAVASCRIPT,
        code=correct_wrapper,
        testcases=[tc],
    )
    assert res_correct.testcase_results[0].passed is True
    assert res_correct.testcase_results[0].verdict == Verdict.ACCEPTED
    assert res_correct.testcase_results[0].actual_value == 6

    # 2. Run flawed code (string return)
    res_flawed = await pipeline.execute(
        language=Language.JAVASCRIPT,
        code=flawed_wrapper,
        testcases=[tc],
    )
    assert res_flawed.testcase_results[0].passed is False
    assert res_flawed.testcase_results[0].verdict == Verdict.WRONG_ANSWER
    assert res_flawed.testcase_results[0].actual_value == "6"
    assert "Type mismatch" in (res_flawed.testcase_results[0].error_message or "")


# =============================================================================
# 4. RUN VS SUBMIT SEMANTIC CONSISTENCY AND MASKING
# =============================================================================

def test_run_vs_submit_identical_semantics_with_hidden_masking():
    """
    Verifies that Run (sample/visible) and Submit (hidden) testcases
    evaluate with identical typed logic, but Submit strictly masks actual/expected data.
    """
    raw_success_stdout = '\n<<<CCC_RUNNER_RESULT>>>\n{"status":"SUCCESS","return_value":6}\n<<<CCC_RUNNER_RESULT>>>\n'
    raw_wrong_stdout = '\n<<<CCC_RUNNER_RESULT>>>\n{"status":"SUCCESS","return_value":"6"}\n<<<CCC_RUNNER_RESULT>>>\n'

    sb_pass = SandboxResult(stdout=raw_success_stdout, stderr="", exit_code=0)
    sb_fail = SandboxResult(stdout=raw_wrong_stdout, stderr="", exit_code=0)

    # Visible testcase (Run)
    tc_visible = TestCaseSchema(
        id="sample_1",
        name="Sample 1",
        stdin="[1, 2, 3]",
        expected_output="6",
        hidden=False,
        return_type="int",
        expected_val=6,
    )

    # Hidden testcase (Submit)
    tc_hidden = TestCaseSchema(
        id="hidden_1",
        name="Hidden 1",
        stdin="[1, 2, 3]",
        expected_output="6",
        hidden=True,
        return_type="int",
        expected_val=6,
    )

    # Evaluate visible pass
    vis_res = JudgeEngine.evaluate(sb_pass, tc_visible)
    assert vis_res.passed is True
    assert vis_res.verdict == Verdict.ACCEPTED
    assert vis_res.stdout == "6"
    assert vis_res.actual_value == 6
    assert vis_res.expected_output == "6"

    # Evaluate hidden pass (must be ACCEPTED, but stdout and actual_value masked)
    hid_res = JudgeEngine.evaluate(sb_pass, tc_hidden)
    assert hid_res.passed is True
    assert hid_res.verdict == Verdict.ACCEPTED
    assert hid_res.stdout == ""
    assert hid_res.actual_value is None
    assert hid_res.expected_output == ""

    # Evaluate hidden fail (must be WRONG_ANSWER, but stdout and actual_value masked)
    hid_fail_res = JudgeEngine.evaluate(sb_fail, tc_hidden)
    assert hid_fail_res.passed is False
    assert hid_fail_res.verdict == Verdict.WRONG_ANSWER
    assert hid_fail_res.stdout == ""
    assert hid_fail_res.actual_value is None
    assert hid_fail_res.expected_output == ""
