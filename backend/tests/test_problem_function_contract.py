"""
Chaos Computer Club — Problem Authoring & Function Execution Contract Tests
Verifies typed function contracts, language adapters, deterministic output evaluators,
automated validation suites, and contestant privacy isolation.
"""

import pytest
import asyncio
from app.engine.contracts import (
    DataType,
    ParameterDefinition,
    FunctionSignature,
    EvaluationConfig,
    MatchType,
    validate_value_type,
)
from app.engine.adapters import get_adapter, OutputEvaluator
from app.services.problem_validator import ProblemValidator
from app.schemas.problem import ProblemCreateRequest, TestCaseInputSchema, TestCaseUpdateSchema
from app.services.problem_service import ProblemService
from app.core.db import AsyncSessionLocal


def test_function_signature_validation_and_security():
    """Verify function name validation, identifier safety, and injection prevention."""
    # 1. Valid signature
    sig = FunctionSignature(
        name="networkRoute",
        parameters=[
            ParameterDefinition(name="n", type=DataType.INTEGER),
            ParameterDefinition(name="edges", type=DataType.INTEGER_2D_ARRAY),
            ParameterDefinition(name="source", type=DataType.INTEGER),
            ParameterDefinition(name="destination", type=DataType.INTEGER),
        ],
        return_type=DataType.INTEGER,
    )
    assert sig.name == "networkRoute"
    assert len(sig.parameters) == 4

    # 2. Injection attempts blocked
    for bad_name in ["calc; rm -rf /", "func(x)", "test' OR '1'='1", "def __init__", "calc\nprint(1)"]:
        with pytest.raises(ValueError):
            FunctionSignature(
                name=bad_name,
                parameters=[ParameterDefinition(name="x", type=DataType.INTEGER)],
                return_type=DataType.INTEGER,
            )

    # 3. Duplicate parameters blocked
    with pytest.raises(ValueError, match="Duplicate parameter"):
        FunctionSignature(
            name="solve",
            parameters=[
                ParameterDefinition(name="x", type=DataType.INTEGER),
                ParameterDefinition(name="x", type=DataType.INTEGER),
            ],
            return_type=DataType.INTEGER,
        )

    # 4. Reserved keywords blocked as parameter names
    with pytest.raises(ValueError, match="reserved programming keyword"):
        ParameterDefinition(name="class", type=DataType.STRING)

    with pytest.raises(ValueError, match="reserved programming keyword"):
        ParameterDefinition(name="return", type=DataType.INTEGER)


def test_starter_code_generation_across_all_languages():
    """Verify language-specific starter codes generated from the function contract."""
    sig = FunctionSignature(
        name="shortestPath",
        parameters=[
            ParameterDefinition(name="n", type=DataType.INTEGER),
            ParameterDefinition(name="edges", type=DataType.INTEGER_2D_ARRAY),
            ParameterDefinition(name="source", type=DataType.INTEGER),
            ParameterDefinition(name="destination", type=DataType.INTEGER),
        ],
        return_type=DataType.INTEGER,
    )

    # Python
    py_starter = get_adapter("python").generate_starter_code(sig)
    assert "class Solution:" in py_starter
    assert "def shortestPath(" in py_starter
    assert "edges: list[list[int]]" in py_starter
    assert "-> int:" in py_starter

    # C++
    cpp_starter = get_adapter("cpp").generate_starter_code(sig)
    assert "class Solution {" in cpp_starter
    assert "int shortestPath(" in cpp_starter
    assert "vector<vector<int>>& edges" in cpp_starter

    # Java
    java_starter = get_adapter("java").generate_starter_code(sig)
    assert "class Solution {" in java_starter
    assert "public int shortestPath(" in java_starter
    assert "int[][] edges" in java_starter

    # JavaScript
    js_starter = get_adapter("javascript").generate_starter_code(sig)
    assert "var shortestPath = function(n, edges, source, destination)" in js_starter or "shortestPath(n, edges, source, destination)" in js_starter
    assert "@param {number[][]} edges" in js_starter

    # TypeScript
    ts_starter = get_adapter("typescript").generate_starter_code(sig)
    assert "class Solution {" in ts_starter
    assert "shortestPath(" in ts_starter
    assert "edges: number[][]" in ts_starter

    # C
    c_starter = get_adapter("c").generate_starter_code(sig)
    assert "shortestPath(" in c_starter
    assert "int** edges" in c_starter
    assert "int edgesSize" in c_starter


def test_trusted_wrapper_generation():
    """Verify trusted execution wrapper is securely constructed without arbitrary concatenation."""
    sig = FunctionSignature(
        name="networkRoute",
        parameters=[
            ParameterDefinition(name="n", type=DataType.INTEGER),
            ParameterDefinition(name="edges", type=DataType.INTEGER_2D_ARRAY),
        ],
        return_type=DataType.INTEGER,
    )

    user_code = "class Solution:\n    def networkRoute(self, n, edges):\n        return len(edges)"
    wrapper = get_adapter("python").generate_wrapper(sig, user_code)

    assert user_code in wrapper
    assert "json.loads" in wrapper
    assert "getattr(sol, \"networkRoute\")" in wrapper
    assert "print(result)" in wrapper

    # C++ wrapper
    cpp_user = "class Solution { public: int networkRoute(int n, vector<vector<int>>& edges) { return edges.size(); } };"
    cpp_wrapper = get_adapter("cpp").generate_wrapper(sig, cpp_user)
    assert cpp_user in cpp_wrapper
    assert "networkRoute" in cpp_wrapper
    assert "_ccc_print" in cpp_wrapper

    # C wrapper
    c_user = "int networkRoute(int n, int** edges, int edgesSize, int* edgesColSize) { return edgesSize; }"
    c_wrapper = get_adapter("c").generate_wrapper(sig, c_user)
    assert c_user in c_wrapper
    assert "networkRoute" in c_wrapper
    assert "main(void)" in c_wrapper

    # Java wrapper
    java_user = "class Solution { public int networkRoute(int n, int[][] edges) { return edges.length; } }"
    java_wrapper = get_adapter("java").generate_wrapper(sig, java_user)
    assert java_user in java_wrapper
    assert "networkRoute" in java_wrapper
    assert "class Main" in java_wrapper

    # JavaScript wrapper
    js_user = "class Solution { networkRoute(n, edges) { return edges.length; } }"
    js_wrapper = get_adapter("javascript").generate_wrapper(sig, js_user)
    assert js_user in js_wrapper
    assert "networkRoute" in js_wrapper
    assert "JSON.parse" in js_wrapper

    # TypeScript wrapper
    ts_user = "class Solution { networkRoute(n: number, edges: number[][]): number { return edges.length; } }"
    ts_wrapper = get_adapter("typescript").generate_wrapper(sig, ts_user)
    assert ts_user in ts_wrapper
    assert "networkRoute" in ts_wrapper
    assert "JSON.parse" in ts_wrapper




def test_deterministic_output_evaluator():
    """Verify output normalization, exact match, and float tolerance without dynamic eval."""
    # Integer exact match
    ok, msg, val = OutputEvaluator.compare("42\n", 42, DataType.INTEGER)
    assert ok is True
    assert val == 42

    ok, msg, val = OutputEvaluator.compare("43\n", 42, DataType.INTEGER)
    assert ok is False

    # Boolean match
    ok, msg, val = OutputEvaluator.compare("true\n", True, DataType.BOOLEAN)
    assert ok is True
    ok, msg, val = OutputEvaluator.compare("false\n", False, DataType.BOOLEAN)
    assert ok is True
    ok, msg, val = OutputEvaluator.compare("false\n", True, DataType.BOOLEAN)
    assert ok is False

    # 1D Array match
    ok, msg, val = OutputEvaluator.compare("[1, 2, 3]\n", [1, 2, 3], DataType.INTEGER_ARRAY)
    assert ok is True
    ok, msg, val = OutputEvaluator.compare("[1, 2, 4]\n", [1, 2, 3], DataType.INTEGER_ARRAY)
    assert ok is False

    # String match: unquoted stdout vs JSON-quoted expected output (e.g. Reverse String)
    ok, msg, val = OutputEvaluator.compare("olleh\n", "\"olleh\"", DataType.STRING)
    assert ok is True
    assert val == "olleh"

    ok, msg, val = OutputEvaluator.compare("\"olleh\"\n", "olleh", DataType.STRING)
    assert ok is True

    ok, msg, val = OutputEvaluator.compare("olleh\n", "olleh", DataType.STRING)
    assert ok is True

    ok, msg, val = OutputEvaluator.compare("wrong\n", "\"olleh\"", DataType.STRING)
    assert ok is False

    # Float tolerance
    cfg = EvaluationConfig(match_type=MatchType.FLOAT_TOLERANCE, float_tolerance=1e-4)
    ok, msg, val = OutputEvaluator.compare("3.14159\n", 3.14158, DataType.DOUBLE, cfg)
    assert ok is True

    ok, msg, val = OutputEvaluator.compare("3.14159\n", 3.15, DataType.DOUBLE, cfg)
    assert ok is False


def test_type_validator_helpers():
    """Verify value type checking against DataType contracts."""
    assert validate_value_type(5, DataType.INTEGER)[0] is True
    assert validate_value_type("hello", DataType.INTEGER)[0] is False
    assert validate_value_type(True, DataType.INTEGER)[0] is False

    assert validate_value_type([[1, 2], [3, 4]], DataType.INTEGER_2D_ARRAY)[0] is True
    assert validate_value_type([[1, "bad"]], DataType.INTEGER_2D_ARRAY)[0] is False
    assert validate_value_type(["a", "b"], DataType.STRING_ARRAY)[0] is True


@pytest.mark.asyncio
async def test_problem_prepublish_validation_service():
    """Verify pre-publish validation rules and blocking errors."""
    valid_prob = {
        "title": "Valid Network Route",
        "slug": "valid-network-route",
        "description": "Given a network of computers, find the shortest path.",
        "constraints": "1 <= n <= 10^5",
        "execution_mode": "FUNCTION",
        "function_signature": {
            "name": "networkRoute",
            "parameters": [
                {"name": "n", "type": "integer"},
                {"name": "edges", "type": "integer[][]"}
            ],
            "return_type": "integer"
        }
    }
    visible_tc = [{"testcase_id": "S1", "input_data": {"n": 3, "edges": [[0, 1]]}, "expected_output": 1}]
    hidden_tc = [{"testcase_id": "H1", "input_data": {"n": 5, "edges": [[0, 1], [1, 2]]}, "expected_output": 2}]

    report = await ProblemValidator.validate_problem(valid_prob, visible_tc, hidden_tc)
    assert report.is_valid is True
    assert len(report.errors) == 0

    # Test invalid: Missing required parameter in testcase
    bad_tc = [{"testcase_id": "S1", "input_data": {"n": 3}, "expected_output": 1}]
    bad_report = await ProblemValidator.validate_problem(valid_prob, bad_tc, hidden_tc)
    assert bad_report.is_valid is False
    assert any("missing required parameter 'edges'" in e for e in bad_report.errors)


from app.core.db import AsyncSessionLocal, engine


@pytest.mark.asyncio
async def test_end_to_end_problem_lifecycle_and_privacy():
    """Verify Problem creation, publish, versioning, and contestant privacy isolation."""
    await engine.dispose()
    try:
        async with AsyncSessionLocal() as session:
            sig = FunctionSignature(
                name="sumArray",
                parameters=[ParameterDefinition(name="nums", type=DataType.INTEGER_ARRAY)],
                return_type=DataType.INTEGER,
            )

            visible = [
                TestCaseInputSchema(
                    testcase_id="SAMPLE-01",
                    input={"nums": [1, 2, 3]},
                    expected_output=6,
                    is_hidden=False,
                )
            ]
            hidden = [
                TestCaseInputSchema(
                    testcase_id="HIDDEN-01",
                    input={"nums": [10, 20, 30]},
                    expected_output=60,
                    is_hidden=True,
                )
            ]

            req = ProblemCreateRequest(
                title="Sum Array Challenge",
                slug="sum-array-challenge-lifecycle",
                difficulty="EASY",
                topic="Arrays",
                points=100,
                description="Compute the sum of all elements in the given integer array.",
                constraints="1 <= nums.length <= 10^5",
                execution_mode="FUNCTION",
                function_signature=sig,
                sample_testcases=visible,
                hidden_testcases=hidden,
            )

            # 1. Create Problem
            prob = await ProblemService.create_problem(req, admin_id="test_admin", db=session)
            prob_id = prob["id"]
            assert prob["status"] == "DRAFT"
            assert len(prob["starter_code"]) >= 6
            assert set(prob["starter_code"].keys()) >= {"python", "cpp", "c", "java", "javascript", "typescript"}

            # 2. Publish
            pub = await ProblemService.publish_problem(prob_id, admin_id="test_admin", db=session)
            assert pub["status"] == "PUBLISHED"
            assert pub["version"] == 1

            # 3. Contestant Privacy Guard
            student_view = await ProblemService.get_problem_detail(prob_id, include_hidden=False, db=session)
            assert student_view["hidden_testcases"] is None
            assert student_view["reference_solution"] is None
            assert len(student_view["visible_testcases"]) == 1

            # 4. Versioning
            new_v = await ProblemService.create_new_version(prob_id, admin_id="test_admin", db=session)
            assert new_v["version"] == 2
            assert new_v["status"] == "DRAFT"

            # 5. Vault testcase update & delete on new version
            updated_tc = await ProblemService.update_testcase(
                problem_id=prob_id,
                testcase_id="HIDDEN-01",
                tc_payload=TestCaseUpdateSchema(
                    input={"nums": [100, 200, 300]},
                    expected_output=600,
                    is_hidden=True,
                ),
                db=session,
            )
            assert updated_tc["testcase_id"] == "HIDDEN-01"

            del_tc_res = await ProblemService.delete_testcase(
                problem_id=prob_id,
                testcase_id="HIDDEN-01",
                db=session,
            )
            assert del_tc_res["success"] is True

            # 6. Delete draft problem
            del_prob_res = await ProblemService.delete_problem(
                problem_id=prob_id,
                admin_id="test_admin",
                db=session,
            )
            assert del_prob_res["success"] is True
    finally:
        await engine.dispose()



