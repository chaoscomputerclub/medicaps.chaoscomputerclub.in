"""
Chaos Computer Club — Production-Grade LeetCode-Style Function Contract Architecture
Comprehensive Regression Test Suite (12 Core Contract Invariants)

Invariants Verified:
1. Test 1 — Two Sum: twoSum(array<int>, int) -> array<int> executed across all supported languages.
2. Test 2 — Valid Anagram: isAnagram(string, string) -> boolean (verifies parameters never become null).
3. Test 3 — Multiple parameters: Function with 3+ parameters (e.g. networkDelayTime(int, array<array<int>>, int) -> int).
4. Test 4 — Nested arrays: Multidimensional array support (array<array<int>>).
5. Test 5 — Boolean: boolean parameter and boolean return evaluation.
6. Test 6 — Empty values: Preserving empty string "" and empty array [] without null coercion.
7. Test 7 — Nullable: Explicit nullable parameter (nullable<string>, nullable<int>) support.
8. Test 8 — Invalid argument count: Deterministically fails with InputBindingError before candidate execution.
9. Test 9 — Invalid type: Deterministically fails with InputBindingError without unsafe coercion before candidate execution.
10. Test 10 — Special characters: Unicode, escaped quotes, backslashes, tabs, and newlines.
11. Test 11 — Cross-language isolation: Pure language wrappers with zero foreign marker contamination.
12. Test 12 — Run vs Submit: Both use the identical FunctionSignature -> InputBinder -> Adapter -> Sandbox -> OutputEvaluator engine.
"""

import json
import pytest
import asyncio

from app.engine.contracts import (
    DataType,
    FunctionSignature,
    ParameterDefinition,
    EvaluationConfig,
    MatchType,
    parse_type_descriptor,
    TypeKind,
)
from app.engine.binder import InputBinder, InputBindingError
from app.engine.languages import Language, LanguageRegistry
from app.engine.adapters import get_adapter, OutputEvaluator
from app.engine.providers.factory import get_judge_provider
from app.engine.schemas import TestCaseSchema
from app.engine.enums import ComparisonMode, Verdict


# ===========================================================================
# TEST 1: TWO SUM ACROSS ALL SUPPORTED LANGUAGES
# ===========================================================================

@pytest.mark.asyncio
async def test_01_two_sum_all_languages():
    """
    Test 1 — Two Sum
    Signature: twoSum(array<int>, int) -> array<int>
    Input: [[2, 7, 11, 15], 9]
    Expected: [0, 1]
    Must execute correctly in every supported language.
    """
    sig = FunctionSignature(
        class_name="Solution",
        function_name="twoSum",
        parameters=[
            ParameterDefinition(name="nums", type="array<int>"),
            ParameterDefinition(name="target", type="int"),
        ],
        return_type="array<int>",
    )

    testcases = [
        ([[2, 7, 11, 15], 9], "[0, 1]"),
        ([[3, 2, 4], 6], "[1, 2]"),
    ]

    solutions = {
        Language.PYTHON: """
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        lookup = {}
        for i, num in enumerate(nums):
            diff = target - num
            if diff in lookup:
                return [lookup[diff], i]
            lookup[num] = i
        return []
""",
        Language.JAVASCRIPT: """
class Solution {
    twoSum(nums, target) {
        const map = new Map();
        for (let i = 0; i < nums.length; i++) {
            const comp = target - nums[i];
            if (map.has(comp)) return [map.get(comp), i];
            map.set(nums[i], i);
        }
        return [];
    }
}
""",
        Language.CPP: """
#include <vector>
#include <unordered_map>
using namespace std;
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> map;
        for (int i = 0; i < (int)nums.size(); i++) {
            int comp = target - nums[i];
            if (map.count(comp)) return {map[comp], i};
            map[nums[i]] = i;
        }
        return {};
    }
};
""",
        Language.C: """
#include <stdlib.h>
int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    *returnSize = 2;
    int* res = (int*)malloc(2 * sizeof(int));
    for (int i = 0; i < numsSize; i++) {
        for (int j = i + 1; j < numsSize; j++) {
            if (nums[i] + nums[j] == target) {
                res[0] = i;
                res[1] = j;
                return res;
            }
        }
    }
    return res;
}
""",
        Language.JAVA: """
class Solution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++) {
            for (int j = i + 1; j < nums.length; j++) {
                if (nums[i] + nums[j] == target) {
                    return new int[]{i, j};
                }
            }
        }
        return new int[]{};
    }
}
""",
    }

    provider = get_judge_provider()
    for lang, sol in solutions.items():
        adapter = LanguageRegistry.get_adapter(lang)
        code = adapter.generate_wrapper(sig, sol)
        tcs = [
            TestCaseSchema(
                id=f"tc_{idx}",
                stdin=adapter.serialize_input(sig, tc_in),
                expected_output=tc_out,
            )
            for idx, (tc_in, tc_out) in enumerate(testcases)
        ]
        res = await provider.execute_batch(lang, code, tcs, time_limit=5.0)
        assert res.verdict == Verdict.ACCEPTED, f"{lang} failed Two Sum: {res.compile_output} | {res.stderr}"
        assert res.passed_testcases == len(testcases)


# ===========================================================================
# TEST 2: VALID ANAGRAM (NEVER NULL)
# ===========================================================================

@pytest.mark.asyncio
async def test_02_valid_anagram_never_null():
    """
    Test 2 — Valid Anagram
    Signature: isAnagram(string, string) -> boolean
    Input: ["anagram", "nagaram"]
    Expected: true
    Must NOT become: s = null, t = null.
    """
    sig = FunctionSignature(
        class_name="Solution",
        function_name="isAnagram",
        parameters=[
            ParameterDefinition(name="s", type="string"),
            ParameterDefinition(name="t", type="string"),
        ],
        return_type="boolean",
    )

    # 1. Verify InputBinder positional binding
    bound = InputBinder.bind(sig, ["anagram", "nagaram"])
    assert len(bound) == 2
    assert bound[0].name == "s"
    assert bound[0].value == "anagram"
    assert bound[1].name == "t"
    assert bound[1].value == "nagaram"

    # 2. Execution test with strict null assertions
    py_sol = """
class Solution:
    def isAnagram(self, s: str, t: str) -> bool:
        if s is None or t is None:
            raise ValueError("s and t must NEVER be None!")
        return sorted(s) == sorted(t)
"""
    js_sol = """
class Solution {
    isAnagram(s, t) {
        if (s === null || s === undefined || t === null || t === undefined) {
            throw new Error("s and t must NEVER be null/undefined!");
        }
        return s.split('').sort().join('') === t.split('').sort().join('');
    }
}
"""
    testcases = [
        (["anagram", "nagaram"], "true"),
        (["rat", "car"], "false"),
    ]

    provider = get_judge_provider()
    for lang, sol in [(Language.PYTHON, py_sol), (Language.JAVASCRIPT, js_sol)]:
        adapter = LanguageRegistry.get_adapter(lang)
        code = adapter.generate_wrapper(sig, sol)
        tcs = [
            TestCaseSchema(
                id=f"tc_{idx}",
                stdin=adapter.serialize_input(sig, tc_in),
                expected_output=tc_out,
            )
            for idx, (tc_in, tc_out) in enumerate(testcases)
        ]
        res = await provider.execute_batch(lang, code, tcs, time_limit=3.0)
        assert res.verdict == Verdict.ACCEPTED, f"{lang} failed Anagram: {res.compile_output} | {res.stderr}"
        assert res.passed_testcases == 2


# ===========================================================================
# TEST 3: MULTIPLE PARAMETERS (3+ PARAMS)
# ===========================================================================

@pytest.mark.asyncio
async def test_03_multiple_parameters_3_plus():
    """
    Test 3 — Multiple parameters
    Function with 3+ parameters.
    networkDelayTime(int, array<array<int>>, int) -> int
    """
    sig = FunctionSignature(
        class_name="Solution",
        function_name="networkDelayTime",
        parameters=[
            ParameterDefinition(name="n", type="int"),
            ParameterDefinition(name="edges", type="array<array<int>>"),
            ParameterDefinition(name="source", type="int"),
        ],
        return_type="int",
    )

    raw_input = [4, [[2, 1, 1], [2, 3, 1], [3, 4, 1]], 2]
    bound = InputBinder.bind(sig, raw_input)
    assert len(bound) == 3
    assert bound[0].name == "n" and bound[0].value == 4
    assert bound[1].name == "edges" and bound[1].value == [[2, 1, 1], [2, 3, 1], [3, 4, 1]]
    assert bound[2].name == "source" and bound[2].value == 2

    py_sol = """
class Solution:
    def networkDelayTime(self, n: int, edges: list[list[int]], source: int) -> int:
        assert n == 4
        assert source == 2
        return len(edges)
"""
    adapter = LanguageRegistry.get_adapter(Language.PYTHON)
    code = adapter.generate_wrapper(sig, py_sol)
    provider = get_judge_provider()
    res = await provider.execute_batch(
        Language.PYTHON,
        code,
        [TestCaseSchema(id="tc1", stdin=adapter.serialize_input(sig, raw_input), expected_output="3")],
    )
    assert res.verdict == Verdict.ACCEPTED
    assert res.passed_testcases == 1


# ===========================================================================
# TEST 4: NESTED ARRAYS
# ===========================================================================

@pytest.mark.asyncio
async def test_04_nested_arrays():
    """
    Test 4 — Nested arrays
    Example: array<array<int>>
    matrixSum(array<array<int>>) -> int
    """
    sig = FunctionSignature(
        class_name="Solution",
        function_name="matrixSum",
        parameters=[
            ParameterDefinition(name="grid", type="array<array<int>>"),
        ],
        return_type="int",
    )

    raw_input = [[[1, 2, 3], [4, 5, 6], [7, 8, 9]]]
    bound = InputBinder.bind(sig, raw_input)
    assert len(bound) == 1
    assert bound[0].name == "grid"
    assert bound[0].value == [[1, 2, 3], [4, 5, 6], [7, 8, 9]]

    py_sol = """
class Solution:
    def matrixSum(self, grid: list[list[int]]) -> int:
        return sum(sum(row) for row in grid)
"""
    adapter = LanguageRegistry.get_adapter(Language.PYTHON)
    code = adapter.generate_wrapper(sig, py_sol)
    provider = get_judge_provider()
    res = await provider.execute_batch(
        Language.PYTHON,
        code,
        [TestCaseSchema(id="tc1", stdin=adapter.serialize_input(sig, raw_input), expected_output="45")],
    )
    assert res.verdict == Verdict.ACCEPTED
    assert res.passed_testcases == 1


# ===========================================================================
# TEST 5: BOOLEAN PARAMETER AND RETURN
# ===========================================================================

@pytest.mark.asyncio
async def test_05_boolean_param_and_return():
    """
    Test 5 — Boolean
    boolean parameter and boolean return.
    logicalXor(boolean, boolean) -> boolean
    """
    sig = FunctionSignature(
        class_name="Solution",
        function_name="logicalXor",
        parameters=[
            ParameterDefinition(name="a", type="boolean"),
            ParameterDefinition(name="b", type="boolean"),
        ],
        return_type="boolean",
    )

    testcases = [
        ([True, False], "true"),
        ([True, True], "false"),
        ([False, False], "false"),
        ([False, True], "true"),
    ]

    py_sol = """
class Solution:
    def logicalXor(self, a: bool, b: bool) -> bool:
        assert isinstance(a, bool) and isinstance(b, bool)
        return a ^ b
"""
    adapter = LanguageRegistry.get_adapter(Language.PYTHON)
    code = adapter.generate_wrapper(sig, py_sol)
    provider = get_judge_provider()
    tcs = [
        TestCaseSchema(id=f"tc_{i}", stdin=adapter.serialize_input(sig, inp), expected_output=out)
        for i, (inp, out) in enumerate(testcases)
    ]
    res = await provider.execute_batch(Language.PYTHON, code, tcs)
    assert res.verdict == Verdict.ACCEPTED
    assert res.passed_testcases == 4


# ===========================================================================
# TEST 6: EMPTY VALUES (STRING & ARRAY)
# ===========================================================================

@pytest.mark.asyncio
async def test_06_empty_values_preservation():
    """
    Test 6 — Empty values
    Empty string "" and empty array [].
    Must NOT become null.
    """
    sig = FunctionSignature(
        class_name="Solution",
        function_name="processEmpty",
        parameters=[
            ParameterDefinition(name="s", type="string"),
            ParameterDefinition(name="nums", type="array<int>"),
        ],
        return_type="int",
    )

    bound = InputBinder.bind(sig, ["", []])
    assert len(bound) == 2
    assert bound[0].value == ""
    assert bound[1].value == []

    py_sol = """
class Solution:
    def processEmpty(self, s: str, nums: list[int]) -> int:
        if s is None or nums is None:
            raise ValueError("Arguments must not be None!")
        assert s == ""
        assert nums == []
        return len(s) + len(nums)
"""
    adapter = LanguageRegistry.get_adapter(Language.PYTHON)
    code = adapter.generate_wrapper(sig, py_sol)
    provider = get_judge_provider()
    res = await provider.execute_batch(
        Language.PYTHON,
        code,
        [TestCaseSchema(id="tc1", stdin=adapter.serialize_input(sig, ["", []]), expected_output="0")],
    )
    assert res.verdict == Verdict.ACCEPTED
    assert res.passed_testcases == 1


# ===========================================================================
# TEST 7: EXPLICIT NULLABLE PARAMETER
# ===========================================================================

def test_07_nullable_parameter():
    """
    Test 7 — Nullable
    Explicit nullable parameter nullable<string>.
    """
    sig = FunctionSignature(
        class_name="Solution",
        function_name="checkNullable",
        parameters=[
            ParameterDefinition(name="tag", type="nullable<string>"),
            ParameterDefinition(name="count", type="int"),
        ],
        return_type="boolean",
    )

    # 1. Null value passes validation for nullable
    bound_null = InputBinder.bind(sig, [None, 5])
    assert bound_null[0].value is None
    assert bound_null[1].value == 5

    # 2. String value passes validation for nullable
    bound_val = InputBinder.bind(sig, ["urgent", 10])
    assert bound_val[0].value == "urgent"
    assert bound_val[1].value == 10

    # 3. Non-nullable parameter rejects None
    with pytest.raises(InputBindingError, match="Type validation error for parameter 'count'"):
        InputBinder.bind(sig, ["urgent", None])


# ===========================================================================
# TEST 8: INVALID ARGUMENT COUNT FAILS DETERMINISTICALLY
# ===========================================================================

def test_08_invalid_argument_count_fails_before_execution():
    """
    Test 8 — Invalid argument count
    Must fail before candidate execution.
    """
    sig = FunctionSignature(
        class_name="Solution",
        function_name="twoSum",
        parameters=[
            ParameterDefinition(name="nums", type="array<int>"),
            ParameterDefinition(name="target", type="int"),
        ],
        return_type="array<int>",
    )

    # Case A: Too few arguments (1 provided, 2 expected)
    with pytest.raises(InputBindingError, match="Argument count mismatch"):
        InputBinder.bind(sig, "[[1, 2, 3]]")

    # Case B: Too many arguments (3 provided, 2 expected)
    with pytest.raises(InputBindingError, match="Argument count mismatch"):
        InputBinder.bind(sig, "[[1, 2, 3], 9, 42]")


# ===========================================================================
# TEST 9: INVALID TYPE FAILS DETERMINISTICALLY WITHOUT COERCION
# ===========================================================================

def test_09_invalid_type_fails_without_unsafe_coercion():
    """
    Test 9 — Invalid type
    Must fail deterministically before candidate execution.
    Unsafe coercion (e.g. "123" -> 123) is forbidden.
    """
    sig = FunctionSignature(
        class_name="Solution",
        function_name="twoSum",
        parameters=[
            ParameterDefinition(name="nums", type="array<int>"),
            ParameterDefinition(name="target", type="int"),
        ],
        return_type="array<int>",
    )

    # String passed instead of int — must NOT coerce "9" to 9
    with pytest.raises(InputBindingError, match="Type validation error for parameter 'target'"):
        InputBinder.bind(sig, [[1, 2, 3], "9"])

    # Boolean passed instead of int — must NOT coerce True to 1
    with pytest.raises(InputBindingError, match="Type validation error for parameter 'target'"):
        InputBinder.bind(sig, [[1, 2, 3], True])

    # String in int array — must fail
    with pytest.raises(InputBindingError, match="Type validation error for parameter 'nums'"):
        InputBinder.bind(sig, [[1, "two", 3], 9])


# ===========================================================================
# TEST 10: SPECIAL CHARACTERS (UNICODE, QUOTES, NEWLINES)
# ===========================================================================

@pytest.mark.asyncio
async def test_10_special_characters_and_unicode():
    """
    Test 10 — Special characters
    Unicode, quotes, backslashes and newlines.
    """
    sig = FunctionSignature(
        class_name="Solution",
        function_name="echoString",
        parameters=[
            ParameterDefinition(name="text", type="string"),
        ],
        return_type="string",
    )

    complex_string = "Line 1\nLine 2 with \"quotes\" and \\backslash and unicode: 你好 🌍 🚀"

    bound = InputBinder.bind(sig, [complex_string])
    assert bound[0].value == complex_string

    py_sol = """
class Solution:
    def echoString(self, text: str) -> str:
        return text
"""
    adapter = LanguageRegistry.get_adapter(Language.PYTHON)
    code = adapter.generate_wrapper(sig, py_sol)
    provider = get_judge_provider()
    res = await provider.execute_batch(
        Language.PYTHON,
        code,
        [TestCaseSchema(id="tc1", stdin=adapter.serialize_input(sig, [complex_string]), expected_output=complex_string)],
    )
    assert res.verdict == Verdict.ACCEPTED
    assert res.passed_testcases == 1


# ===========================================================================
# TEST 11: CROSS-LANGUAGE ISOLATION
# ===========================================================================

def test_11_cross_language_isolation():
    """
    Test 11 — Cross-language isolation
    Verify that each language receives its own correct wrapper without foreign tokens.
    """
    sig = FunctionSignature(
        class_name="Solution",
        function_name="twoSum",
        parameters=[
            ParameterDefinition(name="nums", type="array<int>"),
            ParameterDefinition(name="target", type="int"),
        ],
        return_type="array<int>",
    )

    # 1. C++ must NOT have Python markers
    cpp_adapter = LanguageRegistry.get_adapter(Language.CPP)
    cpp_wrapped = cpp_adapter.generate_wrapper(sig, "class Solution { public: vector<int> twoSum(vector<int>& n, int t) { return {}; } };")
    assert "if __name__ == '__main__':" not in cpp_wrapped
    assert "sys.stdin.read()" not in cpp_wrapped
    LanguageRegistry.validate_source(Language.CPP, cpp_wrapped)

    # 2. Python must NOT have C++ includes
    py_adapter = LanguageRegistry.get_adapter(Language.PYTHON)
    py_wrapped = py_adapter.generate_wrapper(sig, "class Solution:\n    def twoSum(self, nums, target):\n        return []")
    assert "#include <vector>" not in py_wrapped
    assert "using namespace std;" not in py_wrapped
    LanguageRegistry.validate_source(Language.PYTHON, py_wrapped)

    # 3. JS must NOT have Python driver markers
    js_adapter = LanguageRegistry.get_adapter(Language.JAVASCRIPT)
    js_wrapped = js_adapter.generate_wrapper(sig, "class Solution { twoSum(nums, target) { return []; } }")
    assert "if __name__ == '__main__':" not in js_wrapped
    LanguageRegistry.validate_source(Language.JAVASCRIPT, js_wrapped)

    # 4. Java must have pure Java syntax
    java_adapter = LanguageRegistry.get_adapter(Language.JAVA)
    java_wrapped = java_adapter.generate_wrapper(sig, "class Solution { public int[] twoSum(int[] nums, int target) { return new int[]{}; } }")
    assert "if __name__ == '__main__':" not in java_wrapped
    assert "#include" not in java_wrapped
    LanguageRegistry.validate_source(Language.JAVA, java_wrapped)


# ===========================================================================
# TEST 12: RUN VS SUBMIT SHARE IDENTICAL EXECUTION PIPELINE
# ===========================================================================

@pytest.mark.asyncio
async def test_12_run_vs_submit_pipeline_parity():
    """
    Test 12 — Run vs Submit
    Both must produce identical results for the same testcase through the shared
    FunctionSignature -> InputBinder -> LanguageAdapter -> Sandbox -> OutputEvaluator path.
    """
    sig = FunctionSignature(
        class_name="Solution",
        function_name="twoSum",
        parameters=[
            ParameterDefinition(name="nums", type="array<int>"),
            ParameterDefinition(name="target", type="int"),
        ],
        return_type="array<int>",
    )

    py_sol = """
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        lookup = {}
        for i, num in enumerate(nums):
            diff = target - num
            if diff in lookup:
                return [lookup[diff], i]
            lookup[num] = i
        return []
"""

    adapter = LanguageRegistry.get_adapter(Language.PYTHON)
    code = adapter.generate_wrapper(sig, py_sol)

    testcase_input = [[2, 7, 11, 15], 9]
    expected_output = "[0, 1]"

    # Both run and submit use InputBinder to bind arguments and serialize input
    bound = InputBinder.bind(sig, testcase_input)
    serialized_stdin = InputBinder.to_serialized_payload(bound)

    provider = get_judge_provider()

    # Simulate "Run" (sample testcase)
    run_res = await provider.execute_batch(
        Language.PYTHON,
        code,
        [TestCaseSchema(id="run_sample", stdin=serialized_stdin, expected_output=expected_output)],
    )

    # Simulate "Submit" (hidden testcase)
    submit_res = await provider.execute_batch(
        Language.PYTHON,
        code,
        [TestCaseSchema(id="submit_hidden", stdin=serialized_stdin, expected_output=expected_output)],
    )

    assert run_res.verdict == submit_res.verdict == Verdict.ACCEPTED
    assert run_res.passed_testcases == submit_res.passed_testcases == 1
    assert run_res.stdout.strip() == submit_res.stdout.strip()

    # Verify both pass identical OutputEvaluator comparison
    run_ok, _, _ = OutputEvaluator.compare(run_res.stdout, expected_output, sig.return_type)
    submit_ok, _, _ = OutputEvaluator.compare(submit_res.stdout, expected_output, sig.return_type)
    assert run_ok is True
    assert submit_ok is True
