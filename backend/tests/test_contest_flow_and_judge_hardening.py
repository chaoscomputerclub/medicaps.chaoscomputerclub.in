"""
Chaos Computer Club — Production LeetCode-Style Contest System Regression & Hardening Tests
Validates:
1. Contest Flow: "Submit Problem" != "Submit Contest". Problem submits never finalize the contest.
2. Deterministic Output Evaluation: [0, 1] vs [0,1], floats, trimmed strings.
3. Language Isolation & Adapter integrity across Python, C++, C, Java, JS, TS.
4. Starter code normalization and unescaping.
5. Privileged test user access bypass.
"""

import pytest
import json
from app.engine.enums import ComparisonMode, Verdict
from app.engine.languages import LanguageRegistry, Language, LanguageContaminationError
from app.engine.judge import JudgeEngine
from app.engine.adapters.evaluator import OutputEvaluator
from app.engine.contracts import DataType, EvaluationConfig, MatchType, FunctionSignature, ParameterDefinition
from app.engine.harness import prepare_solution_code
from app.services.dynamic_contest_service import DynamicContestService
from app.schemas.dynamic_contest import ProblemCreateSchema
from app.services.contest_eligibility_service import is_contest_attempt_submitted
from app.core.security import is_privileged_test_member


class MockMember:
    def __init__(self, id="test-member-1", handle="cadet_alpha", email="alpha@medicaps.ac.in", is_core_member=False):
        self.id = id
        self.handle = handle
        self.email = email
        self.is_core_member = is_core_member


class MockContest:
    def __init__(self, id="test-contest-1", slug="weekly-1", status="live"):
        self.id = id
        self.slug = slug
        self.status = status


class TestContestFlowAndStateSeparation:
    @pytest.mark.asyncio
    async def test_privileged_member_bypasses_submission_lockout(self):
        """Core chapter team & testers should never be locked out of arena or submission evaluation."""
        core_member = MockMember(is_core_member=True)
        contest = MockContest()

        # Should immediately return (False, "")
        is_sub, reason = await is_contest_attempt_submitted(core_member, contest, None)
        assert is_sub is False
        assert reason == ""

    def test_privileged_test_member_detection(self):
        regular_student = MockMember(is_core_member=False)
        admin_student = MockMember(is_core_member=True)

        assert is_privileged_test_member(regular_student) is False
        assert is_privileged_test_member(admin_student) is True
        assert is_privileged_test_member(None) is False


class TestDeterministicOutputEvaluation:
    def test_json_whitespace_invariance(self):
        """Equivalent structured outputs like [0, 1] vs [0,1] must evaluate to True."""
        assert JudgeEngine.compare("[0, 1]", "[0,1]", ComparisonMode.TRIMMED) is True
        assert JudgeEngine.compare("[0,1]", "[0, 1]", ComparisonMode.TRIMMED) is True
        assert JudgeEngine.compare('{"a": 1, "b": [1, 2]}', '{"a":1,"b":[1,2]}', ComparisonMode.TRIMMED) is True

    def test_different_structured_values_rejected(self):
        """Different values must strictly evaluate to False."""
        assert JudgeEngine.compare("[0, 2]", "[0, 1]", ComparisonMode.TRIMMED) is False
        assert JudgeEngine.compare("[1, 0]", "[0, 1]", ComparisonMode.TRIMMED) is False

    def test_trimmed_crlf_normalization(self):
        actual = "10 20 30\r\n40 50\r\n\r\n"
        expected = "10 20 30\n40 50\n"
        assert JudgeEngine.compare(actual, expected, ComparisonMode.TRIMMED) is True

    def test_token_comparison_whitespace_agnostic(self):
        actual = "  42   99\n   100  "
        expected = "42 99 100"
        assert JudgeEngine.compare(actual, expected, ComparisonMode.TOKEN) is True

    def test_numeric_float_tolerance(self):
        actual = "3.14159265"
        expected = "3.14159266"
        assert JudgeEngine.compare(actual, expected, ComparisonMode.FLOAT) is True

    def test_output_evaluator_typed_array(self):
        eval_cfg = EvaluationConfig(match_type=MatchType.EXACT_MATCH)
        passed, msg, _ = OutputEvaluator.compare("[0, 1]", [0, 1], DataType.INTEGER_ARRAY, eval_cfg)
        assert passed is True


class TestLanguageIsolationAndAdapters:
    def test_all_supported_languages_normalized(self):
        langs = ["python", "cpp", "c", "java", "javascript", "typescript"]
        for l in langs:
            norm = LanguageRegistry.normalize(l)
            assert norm.value == l
            adapter = LanguageRegistry.get_adapter(norm)
            assert adapter is not None

    def test_cross_language_contamination_blocked(self):
        """Submitting Python driver markers into C++ or C must raise LanguageContaminationError."""
        bad_cpp_code = '#include <iostream>\n\nif __name__ == "__main__":\n    print("hacked")'
        with pytest.raises(LanguageContaminationError):
            LanguageRegistry.validate_source(Language.CPP, bad_cpp_code)

        bad_c_code = '#include <stdio.h>\n\n# CCC Trusted Judge Execution Driver (Python)'
        with pytest.raises(LanguageContaminationError):
            LanguageRegistry.validate_source(Language.C, bad_c_code)

    def test_adapter_wrapper_generation(self):
        sig = FunctionSignature(
            name="twoSum",
            return_type=DataType.INTEGER_ARRAY,
            parameters=[
                ParameterDefinition(name="nums", type=DataType.INTEGER_ARRAY),
                ParameterDefinition(name="target", type=DataType.INTEGER),
            ],
        )

        # Python adapter
        py_adapter = LanguageRegistry.get_adapter(Language.PYTHON)
        py_wrapped = py_adapter.generate_wrapper(sig, "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 1]")
        assert "class Solution:" in py_wrapped
        assert "sys.stdin" in py_wrapped
        LanguageRegistry.validate_source(Language.PYTHON, py_wrapped)

        # C++ adapter
        cpp_adapter = LanguageRegistry.get_adapter(Language.CPP)
        cpp_wrapped = cpp_adapter.generate_wrapper(sig, "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) { return {0, 1}; }\n};")
        assert "class Solution" in cpp_wrapped
        assert "int main(" in cpp_wrapped
        LanguageRegistry.validate_source(Language.CPP, cpp_wrapped)

        # JS adapter
        js_adapter = LanguageRegistry.get_adapter(Language.JAVASCRIPT)
        js_wrapped = js_adapter.generate_wrapper(sig, "class Solution {\n    twoSum(nums, target) { return [0, 1]; }\n}")
        assert "class Solution" in js_wrapped
        assert "JSON.parse" in js_wrapped
        LanguageRegistry.validate_source(Language.JAVASCRIPT, js_wrapped)


class TestStarterCodeNormalization:
    def test_dynamic_contest_service_clean_starter_codes(self):
        raw = {
            "python": "class Solution:\\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\\n        pass\\n",
            "javascript": "class Solution {\\n    twoSum(nums, target) {\\n        // code\\n    }\\n}",
        }
        cleaned = DynamicContestService._clean_starter_codes(raw)
        assert "\\n" not in cleaned["python"]
        assert "\n" in cleaned["python"]
        assert "class Solution:\n    def twoSum" in cleaned["python"]
        assert "\\n" not in cleaned["javascript"]
        assert "class Solution {\n    twoSum" in cleaned["javascript"]

    def test_schema_field_validator_unescapes(self):
        raw_schema = ProblemCreateSchema(
            problem_index="A",
            title="Two Sum",
            description="Find indices that sum to target.",
            points=100,
            starter_codes={
                "python": "class Solution:\\n    def twoSum(self):\\n        pass\\n"
            }
        )
        assert "\\n" not in raw_schema.starter_codes["python"]
        assert "\n" in raw_schema.starter_codes["python"]


class MockScalarResult:
    def __init__(self, item):
        self._item = item

    def scalars(self):
        return self

    def first(self):
        return self._item

    def all(self):
        return [self._item] if self._item else []


class MockAsyncSession:
    def __init__(self, reg=None, session=None, assessment=None):
        self.reg = reg
        self.session = session
        self.assessment = assessment

    async def execute(self, stmt):
        stmt_str = str(stmt)
        if "contest_registrations" in stmt_str:
            return MockScalarResult(self.reg)
        if "assessment_sessions" in stmt_str:
            return MockScalarResult(self.session)
        if "assessments" in stmt_str:
            return MockScalarResult(self.assessment)
        return MockScalarResult(None)


class MockRegistration:
    def __init__(self, status="confirmed", assessment_taken=False):
        self.status = status
        self.assessment_taken = assessment_taken


class TestContestStateMachineAndFlowIsolation:
    @pytest.mark.asyncio
    async def test_live_contest_allows_qualifiers_with_screening_taken(self):
        """In a live contest, having taken Round 1 screening must NOT lock the candidate out of Round 2."""
        cadet = MockMember(is_core_member=False)
        contest = MockContest(status="live")
        reg = MockRegistration(status="confirmed", assessment_taken=True)
        db = MockAsyncSession(reg=reg)

        is_sub, reason = await is_contest_attempt_submitted(cadet, contest, db)
        assert is_sub is False
        assert reason == ""

    @pytest.mark.asyncio
    async def test_live_contest_locks_only_when_explicitly_submitted(self):
        """In a live contest, only status='submitted' locks out the candidate."""
        cadet = MockMember(is_core_member=False)
        contest = MockContest(status="live")
        reg = MockRegistration(status="submitted", assessment_taken=True)
        db = MockAsyncSession(reg=reg)

        is_sub, reason = await is_contest_attempt_submitted(cadet, contest, db)
        assert is_sub is True
        assert "Contest attempt has already been submitted" in reason

    @pytest.mark.asyncio
    async def test_upcoming_contest_locks_when_screening_assessment_taken(self):
        """In an upcoming contest (screening phase), assessment_taken=True prevents retaking screening."""
        cadet = MockMember(is_core_member=False)
        contest = MockContest(status="upcoming")
        reg = MockRegistration(status="confirmed", assessment_taken=True)
        db = MockAsyncSession(reg=reg)

        is_sub, reason = await is_contest_attempt_submitted(cadet, contest, db)
        assert is_sub is True
        assert "Contest attempt has already been submitted" in reason


class TestDynamicParameterResolution:
    def test_valid_anagram_all_dynamic_formats(self):
        """LeetCode-style multi-format parameter resolution: maps 8 distinct input shapes into {s: '...', t: '...'}."""
        from app.engine.adapters.base import resolve_dynamic_input
        from app.engine.adapters import get_adapter

        sig = FunctionSignature(
            name="isAnagram",
            return_type=DataType.BOOLEAN,
            parameters=[
                ParameterDefinition(name="s", type=DataType.STRING),
                ParameterDefinition(name="t", type=DataType.STRING),
            ],
        )
        adapter = get_adapter("javascript")

        formats = [
            {"raw": '["anagram","nagaram"]'},
            ["anagram", "nagaram"],
            '["anagram","nagaram"]',
            's = "anagram", t = "nagaram"',
            '"anagram"\n"nagaram"',
            {"s": "anagram", "t": "nagaram"},
            {"args": ["anagram", "nagaram"]},
            {"0": "anagram", "1": "nagaram"},
        ]

        for tc in formats:
            resolved = resolve_dynamic_input(sig, tc)
            assert resolved == {"s": "anagram", "t": "nagaram"}, f"Failed for {tc}: got {resolved}"
            ser = adapter.serialize_input(sig, tc)
            assert json.loads(ser) == {"s": "anagram", "t": "nagaram"}

    def test_two_sum_dynamic_formats(self):
        """Array + scalar parameters: maps [[2,7,11,15], 9] into {nums: [2,7,11,15], target: 9}."""
        from app.engine.adapters.base import resolve_dynamic_input

        sig = FunctionSignature(
            name="twoSum",
            return_type=DataType.INTEGER_ARRAY,
            parameters=[
                ParameterDefinition(name="nums", type=DataType.INTEGER_ARRAY),
                ParameterDefinition(name="target", type=DataType.INTEGER),
            ],
        )

        assert resolve_dynamic_input(sig, [[2, 7, 11, 15], 9]) == {"nums": [2, 7, 11, 15], "target": 9}
        assert resolve_dynamic_input(sig, {"raw": "[[2, 7, 11, 15], 9]"}) == {"nums": [2, 7, 11, 15], "target": 9}
        assert resolve_dynamic_input(sig, "nums = [2,7,11,15], target = 9") == {"nums": [2, 7, 11, 15], "target": 9}
        assert resolve_dynamic_input(sig, "[2, 7, 11, 15]\n9") == {"nums": [2, 7, 11, 15], "target": 9}

    def test_single_array_parameter(self):
        """Single array parameter: maps [1,2,3] to {head: [1,2,3]} without splitting across elements."""
        from app.engine.adapters.base import resolve_dynamic_input

        sig = FunctionSignature(
            name="reverseList",
            return_type=DataType.INTEGER_ARRAY,
            parameters=[
                ParameterDefinition(name="head", type=DataType.INTEGER_ARRAY),
            ],
        )

        assert resolve_dynamic_input(sig, [1, 2, 3, 4, 5]) == {"head": [1, 2, 3, 4, 5]}
        assert resolve_dynamic_input(sig, "[1, 2, 3, 4, 5]") == {"head": [1, 2, 3, 4, 5]}
        assert resolve_dynamic_input(sig, {"raw": "[1, 2, 3, 4, 5]"}) == {"head": [1, 2, 3, 4, 5]}


