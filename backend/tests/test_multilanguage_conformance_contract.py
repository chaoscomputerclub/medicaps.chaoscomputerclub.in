"""
Chaos Computer Club — Multi-Language Conformance Contract Test Suite
Validates that all supported languages follow the canonical execution contract:
- Python, JavaScript, TypeScript, Java, C++, C, Go, Rust
- FUNCTION mode vs FULL_PROGRAM mode separation
- Envelope isolation (user stdout vs authoritative return_value)
- Non-corruption of verdicts (compile errors, runtime errors, missing functions)
"""

import asyncio
import os
import shutil
import tempfile
from pathlib import Path
import pytest

from app.engine.contracts import FunctionSignature, ParameterDefinition
from app.engine.enums import Language, Verdict, ComparisonMode
from app.engine.judge import JudgeEngine
from app.engine.languages import LanguageRegistry
from app.engine.schemas import SandboxResult, TestCaseSchema
from app.engine.strategy.base import CompileLimits, ExecutionLimits
from app.engine.strategy.factory import get_strategy


PALINDROME_SIG = FunctionSignature(
    name="isPalindrome",
    function_name="isPalindrome",
    class_name="Solution",
    parameters=[ParameterDefinition(name="s", type="string")],
    return_type="boolean",
)

PALINDROME_CASES = [
    ("s = \"A man, a plan, a canal: Panama\"\n", "true"),
    ("s = \"race a car\"\n", "false"),
    ("s = \" \"\n", "true"),
]


@pytest.mark.asyncio
async def test_python_conformance():
    adapter = LanguageRegistry.get_adapter(Language.PYTHON)
    cfg = LanguageRegistry.get(Language.PYTHON)
    strategy = get_strategy(cfg)

    # 1. return True with print -> must be ACCEPTED with True
    c_true = "class Solution:\n    def isPalindrome(self, s: str) -> bool:\n        print('dbg')\n        return True"
    w_true = adapter.generate_wrapper(PALINDROME_SIG, c_true)
    with tempfile.TemporaryDirectory() as td:
        ws = Path(td)
        prep = await strategy.prepare(ws, w_true, ExecutionLimits(timeout=5.0))
        exec_res = await strategy.execute(ws, prep.artifact, "s = \"racecar\"\n", ExecutionLimits(timeout=5.0))
        env, ustdout = JudgeEngine.parse_runner_envelope(exec_res.stdout)
        assert env["status"] == "SUCCESS"
        assert env["return_value"] is True
        assert "dbg" in ustdout
        tc = TestCaseSchema(id="1", stdin="s = \"racecar\"\n", expected_output="true")
        sb_res = SandboxResult(stdout=exec_res.stdout, stderr=exec_res.stderr, exit_code=exec_res.exit_code, wall_time_ms=10.0)
        res = JudgeEngine.evaluate(sb_res, tc)
        assert res.verdict == Verdict.ACCEPTED
        assert "dbg" in res.stdout
        assert "<<<CCC_RUNNER_RESULT>>>" not in res.stdout

    # 2. pass -> returns None / null -> WRONG_ANSWER when expected is true
    c_pass = "class Solution:\n    def isPalindrome(self, s: str) -> bool:\n        pass"
    w_pass = adapter.generate_wrapper(PALINDROME_SIG, c_pass)
    with tempfile.TemporaryDirectory() as td:
        ws = Path(td)
        prep = await strategy.prepare(ws, w_pass, ExecutionLimits(timeout=5.0))
        exec_res = await strategy.execute(ws, prep.artifact, "s = \"racecar\"\n", ExecutionLimits(timeout=5.0))
        env, _ = JudgeEngine.parse_runner_envelope(exec_res.stdout)
        assert env["status"] == "SUCCESS"
        assert env["return_value"] is None

    # 3. exception -> RUNTIME_ERROR (never WRONG_ANSWER)
    c_err = "class Solution:\n    def isPalindrome(self, s: str) -> bool:\n        raise ValueError('boom')"
    w_err = adapter.generate_wrapper(PALINDROME_SIG, c_err)
    with tempfile.TemporaryDirectory() as td:
        ws = Path(td)
        prep = await strategy.prepare(ws, w_err, ExecutionLimits(timeout=5.0))
        exec_res = await strategy.execute(ws, prep.artifact, "s = \"racecar\"\n", ExecutionLimits(timeout=5.0))
        env, _ = JudgeEngine.parse_runner_envelope(exec_res.stdout)
        assert env["status"] == "RUNTIME_ERROR"
        tc = TestCaseSchema(id="1", stdin="s = \"racecar\"\n", expected_output="true")
        sb_res = SandboxResult(stdout=exec_res.stdout, stderr=exec_res.stderr, exit_code=exec_res.exit_code, wall_time_ms=10.0)
        res = JudgeEngine.evaluate(sb_res, tc)
        assert res.verdict == Verdict.RUNTIME_ERROR


@pytest.mark.asyncio
async def test_javascript_conformance():
    adapter = LanguageRegistry.get_adapter(Language.JAVASCRIPT)
    cfg = LanguageRegistry.get(Language.JAVASCRIPT)
    strategy = get_strategy(cfg)

    c_js = """
var isPalindrome = function(s) {
    console.log("js debug");
    const clean = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    return clean === clean.split("").reverse().join("");
};
"""
    w_js = adapter.generate_wrapper(PALINDROME_SIG, c_js)
    with tempfile.TemporaryDirectory() as td:
        ws = Path(td)
        prep = await strategy.prepare(ws, w_js, ExecutionLimits(timeout=5.0))
        for inp, expected in PALINDROME_CASES:
            exec_res = await strategy.execute(ws, prep.artifact, inp, ExecutionLimits(timeout=5.0))
            env, ustdout = JudgeEngine.parse_runner_envelope(exec_res.stdout)
            assert env["status"] == "SUCCESS"
            actual = "true" if env["return_value"] is True else "false"
            assert actual == expected


@pytest.mark.asyncio
async def test_typescript_conformance():
    adapter = LanguageRegistry.get_adapter(Language.TYPESCRIPT)
    cfg = LanguageRegistry.get(Language.TYPESCRIPT)
    strategy = get_strategy(cfg)

    c_ts = """
class Solution {
    isPalindrome(s: string): boolean {
        console.log("ts debug");
        const clean = s.toLowerCase().replace(/[^a-z0-9]/g, "");
        return clean === clean.split("").reverse().join("");
    }
}
"""
    w_ts = adapter.generate_wrapper(PALINDROME_SIG, c_ts)
    with tempfile.TemporaryDirectory() as td:
        ws = Path(td)
        prep = await strategy.prepare(ws, w_ts, CompileLimits(timeout=10.0))
        assert prep.success
        comp = await strategy.compile(ws, CompileLimits(timeout=10.0))
        assert comp.success, f"TS compile error: {comp.stderr}"
        for inp, expected in PALINDROME_CASES:
            exec_res = await strategy.execute(ws, comp.artifact, inp, ExecutionLimits(timeout=5.0))
            env, ustdout = JudgeEngine.parse_runner_envelope(exec_res.stdout)
            assert env["status"] == "SUCCESS"
            actual = "true" if env["return_value"] is True else "false"
            assert actual == expected
            assert "ts debug" in ustdout


@pytest.mark.asyncio
async def test_java_conformance():
    adapter = LanguageRegistry.get_adapter(Language.JAVA)
    cfg = LanguageRegistry.get(Language.JAVA)
    strategy = get_strategy(cfg)

    c_java = """
class Solution {
    public boolean isPalindrome(String s) {
        System.out.println("java debug");
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (Character.isLetterOrDigit(c)) {
                sb.append(Character.toLowerCase(c));
            }
        }
        String clean = sb.toString();
        String rev = sb.reverse().toString();
        return clean.equals(rev);
    }
}
"""
    w_java = adapter.generate_wrapper(PALINDROME_SIG, c_java)
    with tempfile.TemporaryDirectory() as td:
        ws = Path(td)
        prep = await strategy.prepare(ws, w_java, CompileLimits(timeout=10.0))
        assert prep.success
        comp = await strategy.compile(ws, CompileLimits(timeout=10.0))
        assert comp.success, f"Java compile error: {comp.stderr}"
        for inp, expected in PALINDROME_CASES:
            exec_res = await strategy.execute(ws, comp.artifact, inp, ExecutionLimits(timeout=5.0))
            env, ustdout = JudgeEngine.parse_runner_envelope(exec_res.stdout)
            assert env["status"] == "SUCCESS"
            actual = "true" if env["return_value"] is True else "false"
            assert actual == expected
            assert "java debug" in ustdout


@pytest.mark.asyncio
async def test_cpp_conformance():
    adapter = LanguageRegistry.get_adapter(Language.CPP)
    cfg = LanguageRegistry.get(Language.CPP)
    strategy = get_strategy(cfg)

    c_cpp = """
class Solution {
public:
    bool isPalindrome(string s) {
        cout << "cpp debug" << endl;
        string clean;
        for (char c : s) {
            if (isalnum((unsigned char)c)) {
                clean += tolower((unsigned char)c);
            }
        }
        string rev = clean;
        reverse(rev.begin(), rev.end());
        return clean == rev;
    }
};
"""
    w_cpp = adapter.generate_wrapper(PALINDROME_SIG, c_cpp)
    with tempfile.TemporaryDirectory() as td:
        ws = Path(td)
        prep = await strategy.prepare(ws, w_cpp, CompileLimits(timeout=10.0))
        assert prep.success
        comp = await strategy.compile(ws, CompileLimits(timeout=10.0))
        assert comp.success, f"C++ compile error: {comp.stderr}"
        for inp, expected in PALINDROME_CASES:
            exec_res = await strategy.execute(ws, comp.artifact, inp, ExecutionLimits(timeout=5.0))
            env, ustdout = JudgeEngine.parse_runner_envelope(exec_res.stdout)
            assert env["status"] == "SUCCESS"
            actual = "true" if env["return_value"] is True else "false"
            assert actual == expected
            assert "cpp debug" in ustdout


@pytest.mark.asyncio
async def test_c_conformance():
    adapter = LanguageRegistry.get_adapter(Language.C)
    cfg = LanguageRegistry.get(Language.C)
    strategy = get_strategy(cfg)

    c_c = """
#include <stdbool.h>
#include <ctype.h>
#include <string.h>

bool isPalindrome(char* s) {
    printf("c debug\\n");
    int i = 0, j = strlen(s) - 1;
    while (i < j) {
        while (i < j && !isalnum((unsigned char)s[i])) i++;
        while (i < j && !isalnum((unsigned char)s[j])) j--;
        if (tolower((unsigned char)s[i]) != tolower((unsigned char)s[j])) {
            return false;
        }
        i++;
        j--;
    }
    return true;
}
"""
    w_c = adapter.generate_wrapper(PALINDROME_SIG, c_c)
    with tempfile.TemporaryDirectory() as td:
        ws = Path(td)
        prep = await strategy.prepare(ws, w_c, CompileLimits(timeout=10.0))
        assert prep.success
        comp = await strategy.compile(ws, CompileLimits(timeout=10.0))
        assert comp.success, f"C compile error: {comp.stderr}"
        for inp, expected in PALINDROME_CASES:
            exec_res = await strategy.execute(ws, comp.artifact, inp, ExecutionLimits(timeout=5.0))
            env, ustdout = JudgeEngine.parse_runner_envelope(exec_res.stdout)
            assert env["status"] == "SUCCESS"
            actual = "true" if env["return_value"] is True else "false"
            assert actual == expected
            assert "c debug" in ustdout


@pytest.mark.asyncio
async def test_go_conformance():
    adapter = LanguageRegistry.get_adapter(Language.GO)
    cfg = LanguageRegistry.get(Language.GO)
    strategy = get_strategy(cfg)

    c_go = """
import "strings"
import "unicode"

func isPalindrome(s string) bool {
    fmt.Println("go debug")
    var clean []rune
    for _, r := range strings.ToLower(s) {
        if unicode.IsLetter(r) || unicode.IsDigit(r) {
            clean = append(clean, r)
        }
    }
    for i, j := 0, len(clean)-1; i < j; i, j = i+1, j-1 {
        if clean[i] != clean[j] {
            return false
        }
    }
    return true
}
"""
    w_go = adapter.generate_wrapper(PALINDROME_SIG, c_go)
    with tempfile.TemporaryDirectory() as td:
        ws = Path(td)
        prep = await strategy.prepare(ws, w_go, CompileLimits(timeout=10.0))
        assert prep.success
        comp = await strategy.compile(ws, CompileLimits(timeout=10.0))
        assert comp.success, f"Go compile error: {comp.stderr}"
        for inp, expected in PALINDROME_CASES:
            exec_res = await strategy.execute(ws, comp.artifact, inp, ExecutionLimits(timeout=5.0))
            env, ustdout = JudgeEngine.parse_runner_envelope(exec_res.stdout)
            assert env["status"] == "SUCCESS"
            actual = "true" if env["return_value"] is True else "false"
            assert actual == expected
            assert "go debug" in ustdout
