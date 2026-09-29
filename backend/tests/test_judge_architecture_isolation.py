"""
Chaos Computer Club — Online Judge Architecture, Isolation & Regression Test Suite
Tests language isolation, foreign token contamination prevention, deterministic output
comparators, sandbox secret isolation, and the Two Sum golden suite across Python, C++, C, and JavaScript.
"""

import asyncio
import os
import shutil
import tempfile
from pathlib import Path
import pytest

from app.engine.contracts import (
    DataType,
    FunctionSignature,
    ParameterDefinition,
    EvaluationConfig,
    MatchType,
)
from app.engine.enums import ComparisonMode, Verdict
from app.engine.languages import (
    Language,
    LanguageRegistry,
    LanguageContaminationError,
    UnsupportedLanguageError,
    normalize_language,
)
from app.engine.adapters import get_adapter, OutputEvaluator
from app.engine.adapters.cpp_adapter import CppAdapter
from app.engine.adapters.c_adapter import CAdapter
from app.engine.adapters.javascript_adapter import JavaScriptAdapter
from app.engine.adapters.python_adapter import PythonAdapter
from app.engine.judge import JudgeEngine
from app.engine.providers.factory import get_judge_provider
from app.engine.sandbox import Sandbox, _clean_env
from app.engine.schemas import TestCaseSchema


# ===========================================================================
# 1. LANGUAGE REGISTRY & NORMALIZATION TESTS
# ===========================================================================

def test_language_normalization_strict():
    """Verify type-safe language normalization across stringified enums, aliases, and cases."""
    # Canonical enum
    assert normalize_language(Language.CPP) == Language.CPP
    assert normalize_language(Language.C) == Language.C
    assert normalize_language(Language.PYTHON) == Language.PYTHON
    assert normalize_language(Language.JAVASCRIPT) == Language.JAVASCRIPT

    # Stringified enums from Python 3.11+
    assert normalize_language("Language.CPP") == Language.CPP
    assert normalize_language("<Language.CPP: 'cpp'>") == Language.CPP
    assert normalize_language("language.cpp") == Language.CPP
    assert normalize_language("language.c") == Language.C
    assert normalize_language("language.javascript") == Language.JAVASCRIPT

    # Common aliases
    assert normalize_language("cpp") == Language.CPP
    assert normalize_language("c++") == Language.CPP
    assert normalize_language("g++") == Language.CPP
    assert normalize_language("c") == Language.C
    assert normalize_language("gcc") == Language.C
    assert normalize_language("python3") == Language.PYTHON
    assert normalize_language("py") == Language.PYTHON
    assert normalize_language("node") == Language.JAVASCRIPT
    assert normalize_language("js") == Language.JAVASCRIPT

    # Unknown language raises UnsupportedLanguageError (NEVER silent fallback to Python)
    with pytest.raises(UnsupportedLanguageError):
        normalize_language("brainfuck")

    with pytest.raises(UnsupportedLanguageError):
        normalize_language("")

    with pytest.raises(UnsupportedLanguageError):
        normalize_language(None)


def test_adapter_registry_isolation():
    """Ensure each language resolves to its dedicated immutable adapter without cross-contamination."""
    assert isinstance(LanguageRegistry.get_adapter(Language.CPP), CppAdapter)
    assert isinstance(LanguageRegistry.get_adapter(Language.C), CAdapter)
    assert isinstance(LanguageRegistry.get_adapter(Language.JAVASCRIPT), JavaScriptAdapter)
    assert isinstance(LanguageRegistry.get_adapter(Language.PYTHON), PythonAdapter)

    # get_adapter via string
    assert isinstance(get_adapter("cpp"), CppAdapter)
    assert isinstance(get_adapter("c"), CAdapter)
    assert isinstance(get_adapter("javascript"), JavaScriptAdapter)
    assert isinstance(get_adapter("python"), PythonAdapter)

    # Unknown language must fail fast
    with pytest.raises(UnsupportedLanguageError):
        get_adapter("unknown_lang")


# ===========================================================================
# 2. CROSS-LANGUAGE CONTAMINATION REGRESSION TESTS (Requirement 42)
# ===========================================================================

def test_source_isolation_blocks_foreign_tokens():
    """Verify that foreign language drivers/tokens are structurally rejected before compilation."""
    # 1. C++ source contaminated with Python driver markers
    contaminated_cpp = """
    #include <vector>
    using namespace std;
    class Solution { public: vector<int> twoSum(vector<int>& n, int t) { return {}; } };
    # CCC Trusted Judge Execution Driver (Python)
    if __name__ == '__main__':
        pass
    """
    with pytest.raises(LanguageContaminationError, match="prohibited foreign driver token"):
        LanguageRegistry.validate_source(Language.CPP, contaminated_cpp)

    # 2. C source contaminated with Python driver markers
    contaminated_c = """
    #include <stdio.h>
    int* twoSum(int* nums, int numsSize, int target, int* returnSize) { return NULL; }
    if __name__ == '__main__':
        main()
    """
    with pytest.raises(LanguageContaminationError, match="prohibited foreign driver token"):
        LanguageRegistry.validate_source(Language.C, contaminated_c)

    # 3. JavaScript contaminated with Python driver markers
    contaminated_js = """
    var twoSum = function(nums, target) { return []; };
    # CCC Trusted Judge Execution Driver (Python)
    """
    with pytest.raises(LanguageContaminationError, match="prohibited foreign driver token"):
        LanguageRegistry.validate_source(Language.JAVASCRIPT, contaminated_js)

    # 4. Python contaminated with C++ include markers
    contaminated_py = """
    #include <iostream>
    class Solution:
        def twoSum(self, nums, target): return []
    """
    with pytest.raises(LanguageContaminationError, match="prohibited foreign driver token"):
        LanguageRegistry.validate_source(Language.PYTHON, contaminated_py)

    # 5. Clean sources pass validation without error
    LanguageRegistry.validate_source(Language.CPP, "int main() { return 0; }")
    LanguageRegistry.validate_source(Language.C, "int main() { return 0; }")
    LanguageRegistry.validate_source(Language.JAVASCRIPT, "console.log('clean');")
    LanguageRegistry.validate_source(Language.PYTHON, "print('clean')")


def test_generated_wrappers_never_cross_contaminate():
    """Verify that wrapper generation produces only language-pure source code."""
    sig = FunctionSignature(
        name="twoSum",
        parameters=[
            ParameterDefinition(name="nums", type=DataType.INTEGER_ARRAY),
            ParameterDefinition(name="target", type=DataType.INTEGER),
        ],
        return_type=DataType.INTEGER_ARRAY,
    )

    # C++ wrapper
    cpp_wrapped = LanguageRegistry.get_adapter(Language.CPP).generate_wrapper(
        sig, "class Solution { public: vector<int> twoSum(vector<int>& n, int t) { return {0,1}; } };"
    )
    assert "# CCC Trusted Judge Execution Driver (Python)" not in cpp_wrapped
    assert "if __name__ == '__main__':" not in cpp_wrapped
    LanguageRegistry.validate_source(Language.CPP, cpp_wrapped)

    # C wrapper
    c_wrapped = LanguageRegistry.get_adapter(Language.C).generate_wrapper(
        sig, "int* twoSum(int* n, int s, int t, int* r) { *r = 2; int* p = malloc(8); p[0]=0; p[1]=1; return p; }"
    )
    assert "# CCC Trusted Judge Execution Driver (Python)" not in c_wrapped
    assert "if __name__ == '__main__':" not in c_wrapped
    LanguageRegistry.validate_source(Language.C, c_wrapped)

    # JS wrapper
    js_wrapped = LanguageRegistry.get_adapter(Language.JAVASCRIPT).generate_wrapper(
        sig, "var twoSum = function(nums, target) { return [0, 1]; };"
    )
    assert "# CCC Trusted Judge Execution Driver (Python)" not in js_wrapped
    assert "if __name__ == '__main__':" not in js_wrapped
    LanguageRegistry.validate_source(Language.JAVASCRIPT, js_wrapped)


# ===========================================================================
# 3. OUTPUT COMPARATOR & NORMALIZATION TESTS (Requirements 14, 15, 16, 43)
# ===========================================================================

def test_output_comparator_structured_equivalence():
    """Verify [0, 1] vs [0,1] passes while preserving order sensitivity ([0, 1] vs [1, 0] fails)."""
    # 1. Spaced vs unspaced array outputs are equivalent in TRIMMED and SEMANTIC modes
    assert JudgeEngine.compare("[0, 1]", "[0,1]", ComparisonMode.TRIMMED) is True
    assert JudgeEngine.compare("[0, 1]", "[0,1]", ComparisonMode.SEMANTIC) is True
    assert JudgeEngine.compare(" [0,  1] \n", "[0,1]", ComparisonMode.TRIMMED) is True

    # 2. Order sensitivity: [0, 1] vs [1, 0] MUST NOT pass
    assert JudgeEngine.compare("[0, 1]", "[1, 0]", ComparisonMode.TRIMMED) is False
    assert JudgeEngine.compare("[0, 1]", "[1, 0]", ComparisonMode.SEMANTIC) is False

    # 3. Booleans must not conflate
    assert JudgeEngine.compare("true", "false", ComparisonMode.TRIMMED) is False
    assert JudgeEngine.compare("true", "true", ComparisonMode.TRIMMED) is True

    # 4. CRLF vs LF and trailing whitespace normalization
    assert JudgeEngine.compare("42\r\n", "42\n", ComparisonMode.TRIMMED) is True
    assert JudgeEngine.compare("line1  \nline2   \n", "line1\nline2\n", ComparisonMode.TRIMMED) is True


def test_output_comparator_float_semantics():
    """Verify float comparisons honor declared mode."""
    # Under FLOAT mode, 1 and 1.0 match within tolerance
    assert JudgeEngine.compare("1", "1.0", ComparisonMode.FLOAT) is True
    assert JudgeEngine.compare("3.1415926", "3.1415927", ComparisonMode.FLOAT) is True

    # Under EXACT mode, 1 and 1.0 do NOT match
    assert JudgeEngine.compare("1", "1.0", ComparisonMode.EXACT) is False


def test_output_evaluator_typed_contract_comparison():
    """Verify OutputEvaluator handles typed returns and normalizes string vs list expectations."""
    # INTEGER_ARRAY: actual is spaced string, expected is unspaced string
    passed, msg, val = OutputEvaluator.compare(
        actual_raw="[0, 1]",
        expected_val="[0,1]",
        return_type=DataType.INTEGER_ARRAY,
    )
    assert passed is True
    assert val == [0, 1]

    # INTEGER_ARRAY: actual is spaced string, expected is python list
    passed, msg, val = OutputEvaluator.compare(
        actual_raw="[0, 1]",
        expected_val=[0, 1],
        return_type=DataType.INTEGER_ARRAY,
    )
    assert passed is True
    assert val == [0, 1]

    # INTEGER_ARRAY: wrong order fails
    passed, msg, val = OutputEvaluator.compare(
        actual_raw="[1, 0]",
        expected_val=[0, 1],
        return_type=DataType.INTEGER_ARRAY,
    )
    assert passed is False
    assert "Expected" in msg or "Mismatch" in msg


# ===========================================================================
# 4. GOLDEN TEST: TWO SUM ACROSS C++, C, JS, PYTHON (Requirement 44)
# ===========================================================================

TWO_SUM_SIG = FunctionSignature(
    name="twoSum",
    parameters=[
        ParameterDefinition(name="nums", type=DataType.INTEGER_ARRAY),
        ParameterDefinition(name="target", type=DataType.INTEGER),
    ],
    return_type=DataType.INTEGER_ARRAY,
)

SAMPLE_CASES = [
    {"input": {"nums": [2, 7, 11, 15], "target": 9}, "expected_output": "[0,1]"},
    {"input": {"nums": [3, 2, 4], "target": 6}, "expected_output": "[1,2]"},
]


@pytest.mark.asyncio
async def test_golden_two_sum_python():
    """Verify Python Two Sum solution executes and passes with zero contamination."""
    py_sol = """
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, x in enumerate(nums):
            comp = target - x
            if comp in seen:
                return [seen[comp], i]
            seen[x] = i
        return []
"""
    adapter = LanguageRegistry.get_adapter(Language.PYTHON)
    exec_code = adapter.generate_wrapper(TWO_SUM_SIG, py_sol)
    LanguageRegistry.validate_source(Language.PYTHON, exec_code)

    tcs = [
        TestCaseSchema(
            id=f"tc_{i+1}",
            stdin=adapter.serialize_input(TWO_SUM_SIG, case["input"]),
            expected_output=case["expected_output"],
        )
        for i, case in enumerate(SAMPLE_CASES)
    ]

    provider = get_judge_provider()
    res = await provider.execute_batch(
        language=Language.PYTHON,
        code=exec_code,
        testcases=tcs,
        time_limit=2.0,
        memory_limit_mb=256,
        comparison_mode=ComparisonMode.TRIMMED,
    )

    assert res.success is True
    assert res.verdict == Verdict.ACCEPTED
    assert res.passed_testcases == 2
    assert res.score == 100.0


@pytest.mark.asyncio
async def test_golden_two_sum_javascript():
    """Verify JavaScript Two Sum solution executes and passes with zero contamination."""
    js_sol = """
var twoSum = function(nums, target) {
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
        const comp = target - nums[i];
        if (seen.has(comp)) return [seen.get(comp), i];
        seen.set(nums[i], i);
    }
    return [];
};
"""
    adapter = LanguageRegistry.get_adapter(Language.JAVASCRIPT)
    exec_code = adapter.generate_wrapper(TWO_SUM_SIG, js_sol)
    LanguageRegistry.validate_source(Language.JAVASCRIPT, exec_code)

    tcs = [
        TestCaseSchema(
            id=f"tc_{i+1}",
            stdin=adapter.serialize_input(TWO_SUM_SIG, case["input"]),
            expected_output=case["expected_output"],
        )
        for i, case in enumerate(SAMPLE_CASES)
    ]

    provider = get_judge_provider()
    res = await provider.execute_batch(
        language=Language.JAVASCRIPT,
        code=exec_code,
        testcases=tcs,
        time_limit=2.0,
        memory_limit_mb=256,
        comparison_mode=ComparisonMode.TRIMMED,
    )

    assert res.success is True
    assert res.verdict == Verdict.ACCEPTED
    assert res.passed_testcases == 2
    assert res.score == 100.0


@pytest.mark.asyncio
async def test_golden_two_sum_cpp():
    """Verify C++ Two Sum solution compiles cleanly and passes with zero Python contamination."""
    cpp_sol = """
#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            int comp = target - nums[i];
            if (seen.count(comp)) return {seen[comp], i};
            seen[nums[i]] = i;
        }
        return {};
    }
};
"""
    adapter = LanguageRegistry.get_adapter(Language.CPP)
    exec_code = adapter.generate_wrapper(TWO_SUM_SIG, cpp_sol)
    LanguageRegistry.validate_source(Language.CPP, exec_code)

    tcs = [
        TestCaseSchema(
            id=f"tc_{i+1}",
            stdin=adapter.serialize_input(TWO_SUM_SIG, case["input"]),
            expected_output=case["expected_output"],
        )
        for i, case in enumerate(SAMPLE_CASES)
    ]

    provider = get_judge_provider()
    res = await provider.execute_batch(
        language=Language.CPP,
        code=exec_code,
        testcases=tcs,
        time_limit=3.0,
        memory_limit_mb=256,
        comparison_mode=ComparisonMode.TRIMMED,
    )

    assert res.success is True
    assert res.verdict == Verdict.ACCEPTED
    assert res.passed_testcases == 2
    assert res.score == 100.0


@pytest.mark.asyncio
async def test_golden_two_sum_c():
    """Verify C Two Sum solution compiles and passes using native C toolchain."""
    c_sol = """
#include <stdlib.h>

int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    *returnSize = 2;
    int* result = (int*)malloc(2 * sizeof(int));
    for (int i = 0; i < numsSize; i++) {
        for (int j = i + 1; j < numsSize; j++) {
            if (nums[i] + nums[j] == target) {
                result[0] = i;
                result[1] = j;
                return result;
            }
        }
    }
    return result;
}
"""
    adapter = LanguageRegistry.get_adapter(Language.C)
    exec_code = adapter.generate_wrapper(TWO_SUM_SIG, c_sol)
    LanguageRegistry.validate_source(Language.C, exec_code)

    tcs = [
        TestCaseSchema(
            id=f"tc_{i+1}",
            stdin=adapter.serialize_input(TWO_SUM_SIG, case["input"]),
            expected_output=case["expected_output"],
        )
        for i, case in enumerate(SAMPLE_CASES)
    ]

    provider = get_judge_provider()
    res = await provider.execute_batch(
        language=Language.C,
        code=exec_code,
        testcases=tcs,
        time_limit=3.0,
        memory_limit_mb=256,
        comparison_mode=ComparisonMode.TRIMMED,
    )

    assert res.success is True
    assert res.verdict == Verdict.ACCEPTED
    assert res.passed_testcases == 2
    assert res.score == 100.0


# ===========================================================================
# 5. VERDICT ERROR BOUNDARIES (Requirements 18, 19, 20)
# ===========================================================================

@pytest.mark.asyncio
async def test_compilation_error_classification():
    """Compilation failure must return COMPILATION_ERROR, never WRONG_ANSWER."""
    bad_cpp = """
    #include <iostream>
    int main() {
        this_is_an_intentional_syntax_error();;;
        return 0;
    }
    """
    provider = get_judge_provider()
    res = await provider.execute_batch(
        language=Language.CPP,
        code=bad_cpp,
        testcases=[TestCaseSchema(id="tc1", stdin="", expected_output="0")],
    )
    assert res.success is False
    assert res.verdict == Verdict.COMPILATION_ERROR
    assert len(res.compile_output) > 0


@pytest.mark.asyncio
async def test_runtime_error_classification():
    """Runtime failure (SIGSEGV / divide by zero) must return RUNTIME_ERROR, never WRONG_ANSWER."""
    crash_py = """
def main():
    x = 1 / 0
if __name__ == '__main__':
    main()
"""
    provider = get_judge_provider()
    res = await provider.execute_batch(
        language=Language.PYTHON,
        code=crash_py,
        testcases=[TestCaseSchema(id="tc1", stdin="", expected_output="42")],
    )
    assert res.success is False
    assert res.verdict == Verdict.RUNTIME_ERROR
    assert "ZeroDivisionError" in res.stderr


@pytest.mark.asyncio
async def test_time_limit_exceeded_classification():
    """Infinite loop must be terminated and return TIME_LIMIT_EXCEEDED."""
    loop_py = """
import time
while True:
    time.sleep(0.1)
"""
    provider = get_judge_provider()
    res = await provider.execute_batch(
        language=Language.PYTHON,
        code=loop_py,
        testcases=[TestCaseSchema(id="tc1", stdin="", expected_output="42")],
        time_limit=1.0,
    )
    assert res.success is False
    assert res.verdict == Verdict.TIME_LIMIT_EXCEEDED


# ===========================================================================
# 6. SANDBOX SECRET ISOLATION & PROCESS ISOLATION (Requirements 22, 24, 25)
# ===========================================================================

@pytest.mark.asyncio
async def test_sandbox_environment_sanitization():
    """Submitted code must never have access to application secrets like DATABASE_URL or JWT_SECRET."""
    secret_leak_check = """
import os
print("DATABASE_URL:", os.environ.get("DATABASE_URL"))
print("JWT_SECRET:", os.environ.get("JWT_SECRET"))
print("REDIS_URL:", os.environ.get("REDIS_URL"))
"""
    # Inject fake secret in host environment
    os.environ["DATABASE_URL"] = "postgresql://secret:password@localhost/db"
    os.environ["JWT_SECRET"] = "super-confidential-token"

    provider = get_judge_provider()
    res = await provider.execute_batch(
        language=Language.PYTHON,
        code=secret_leak_check,
        testcases=[TestCaseSchema(id="tc1", stdin="", expected_output="")],
    )

    stdout = res.stdout or ""
    assert "DATABASE_URL: None" in stdout
    assert "JWT_SECRET: None" in stdout
    assert "REDIS_URL: None" in stdout
    assert "super-confidential-token" not in stdout
    assert "secret:password" not in stdout
