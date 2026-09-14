import pytest
import pytest_asyncio
import asyncio
from app.engine.providers.docker_provider import DockerSandboxProvider
from app.engine.enums import Language, ComparisonMode, Verdict
from app.engine.schemas import TestCaseSchema as CaseSchema

pytestmark = pytest.mark.asyncio

@pytest_asyncio.fixture
async def provider():
    prov = DockerSandboxProvider()
    healthy = await prov.healthy()
    if not healthy:
        pytest.skip("Docker daemon or interleet-python container is offline.")
    return prov

async def run_code(provider, language, code, testcases, mode=ComparisonMode.TRIMMED, time_limit=2.0, memory_limit=128):
    res = await provider.execute_batch(
        language=language,
        code=code,
        testcases=testcases,
        time_limit=time_limit,
        memory_limit_mb=memory_limit,
        comparison_mode=mode
    )
    return res

async def test_python_accepted(provider):
    code = """import sys\nfor line in sys.stdin:\n    print(int(line.strip()) * 2)\n"""
    tcs = [CaseSchema(id="tc1", stdin="5\n", expected_output="10\n")]
    res = await run_code(provider, Language.PYTHON, code, tcs)
    assert res.verdict == Verdict.ACCEPTED
    assert res.success is True
    assert res.passed_testcases == 1
    assert res.testcase_results[0].exit_code == 0

async def test_cpp_compilation_error(provider):
    code = """#include <iostream>\nint main() {\n    cout << "Missing std::" << endl;\n    return 0;\n}\n"""
    tcs = [CaseSchema(id="tc1", stdin="", expected_output="")]
    res = await run_code(provider, Language.CPP, code, tcs)
    assert res.verdict == Verdict.COMPILATION_ERROR
    assert res.success is False
    assert "error: " in res.compile_output or "was not declared" in res.compile_output

async def test_python_runtime_error(provider):
    code = "print(1 / 0)"
    tcs = [CaseSchema(id="tc1", stdin="", expected_output="")]
    res = await run_code(provider, Language.PYTHON, code, tcs)
    assert res.verdict == Verdict.RUNTIME_ERROR
    assert res.success is False
    assert "ZeroDivisionError" in res.stderr
    assert res.testcase_results[0].exit_code != 0

async def test_python_time_limit_exceeded(provider):
    code = "while True: pass"
    tcs = [CaseSchema(id="tc1", stdin="", expected_output="")]
    res = await run_code(provider, Language.PYTHON, code, tcs, time_limit=1.0)
    assert res.verdict == Verdict.TIME_LIMIT_EXCEEDED
    assert res.success is False

async def test_python_memory_limit_exceeded(provider):
    code = "a = [0] * (10**8)"
    tcs = [CaseSchema(id="tc1", stdin="", expected_output="")]
    res = await run_code(provider, Language.PYTHON, code, tcs, memory_limit=128)
    assert res.verdict == Verdict.MEMORY_LIMIT_EXCEEDED
    assert res.success is False

async def test_cpp_memory_limit_exceeded(provider):
    code = """#include <vector>\nusing namespace std;\nint main() {\n    vector<int> v(100000000);\n    for(int i=0; i<100000000; i++) v[i] = i;\n    return 0;\n}\n"""
    tcs = [CaseSchema(id="tc1", stdin="", expected_output="")]
    res = await run_code(provider, Language.CPP, code, tcs, memory_limit=128)
    assert res.verdict == Verdict.MEMORY_LIMIT_EXCEEDED
    assert res.success is False

async def test_wrong_answer(provider):
    code = "print(10)"
    tcs = [CaseSchema(id="tc1", stdin="", expected_output="5")]
    res = await run_code(provider, Language.PYTHON, code, tcs)
    assert res.verdict == Verdict.WRONG_ANSWER
    assert res.success is False

async def test_comparison_trimmed(provider):
    code = "print('hello ')"
    tcs = [CaseSchema(id="tc1", stdin="", expected_output="hello")]
    res = await run_code(provider, Language.PYTHON, code, tcs, mode=ComparisonMode.TRIMMED)
    assert res.verdict == Verdict.ACCEPTED

async def test_comparison_exact(provider):
    code = "print('hello ')"
    tcs = [CaseSchema(id="tc1", stdin="", expected_output="hello")]
    res = await run_code(provider, Language.PYTHON, code, tcs, mode=ComparisonMode.EXACT)
    assert res.verdict == Verdict.WRONG_ANSWER

async def test_comparison_semantic_json(provider):
    code = "import json; print(json.dumps({'b': 2, 'a': 1}))"
    tcs = [CaseSchema(id="tc1", stdin="", expected_output='{"a": 1, "b": 2}')]
    res = await run_code(provider, Language.PYTHON, code, tcs, mode=ComparisonMode.SEMANTIC)
    assert res.verdict == Verdict.ACCEPTED

async def test_comparison_float(provider):
    code = "print(3.1415926535)"
    tcs = [CaseSchema(id="tc1", stdin="", expected_output="3.141592")]
    res = await run_code(provider, Language.PYTHON, code, tcs, mode=ComparisonMode.FLOAT)
    assert res.verdict == Verdict.ACCEPTED

async def test_output_truncation(provider):
    code = "print('A' * 6000000)"
    tcs = [CaseSchema(id="tc1", stdin="", expected_output="A")]
    res = await run_code(provider, Language.PYTHON, code, tcs)
    assert len(res.stdout) <= 5 * 1024 * 1024 + 1000
    assert "[Output truncated" in res.stdout
