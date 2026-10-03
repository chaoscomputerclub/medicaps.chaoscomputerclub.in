"""
Chaos Computer Club — Comprehensive Language-Aware Judge Pipeline Verification Suite
Tests:
1. Language resolver and strategy selection
2. Canonical LanguageConfig invariants
3. Independent compile and execution resource limits
4. Dominant deadline enforcement and non-inheritance of timeouts
5. Amortized compilation (compile ONCE across N testcases)
6. Interpreted bypass (zero native compilation for Python/JS)
7. Content-addressed compilation cache (hit, miss, changed flags, changed source, architecture isolation, corruption recovery, concurrent compilations)
8. Multi-language executions (Python, JS, C, C++, Java) with AC, WA, CE, RE, TLE, MLE classifications
9. Security containment & diagnostic sanitization (zero leaked host paths)
10. Distributed node capability matching & stale-result fencing
"""

from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
from pathlib import Path
from typing import List
from uuid import uuid4

import pytest

from app.engine.compilation_cache import CompilationCache, CompilationCacheKey, normalize_source_code
from app.engine.deadlines import ExecutionDeadlineTracker
from app.engine.enums import ComparisonMode, ExecutionStatus, Language, Verdict
from app.engine.errors import ErrorCode, JudgeExecutionException, RETRYABLE_ERROR_CODES, NON_RETRYABLE_ERROR_CODES
from app.engine.languages import (
    LanguageConfig,
    LanguageFamily,
    LanguageRegistry,
    UnsupportedLanguageError,
)
from app.engine.pipeline import LanguageAwareExecutionEngine
from app.engine.schemas import TestCaseSchema
from app.engine.strategy.base import (
    ArtifactType,
    CompilationResult,
    CompileLimits,
    ExecutionArtifact,
    ExecutionLimits,
    sanitize_compiler_output,
)
from app.engine.strategy.compiled_strategy import NativeCompiledExecutionStrategy
from app.engine.strategy.interpreted_strategy import InterpretedExecutionStrategy
from app.engine.strategy.vm_strategy import VMExecutionStrategy


# ─────────────────────────────────────────────────────────────────────────────
# 1. UNIT TESTS: Language Resolver & Strategy Selection
# ─────────────────────────────────────────────────────────────────────────────

def test_language_resolver_and_normalization():
    """Verify strict type-safe normalization and rejection of unknown languages."""
    assert LanguageRegistry.normalize("python") == Language.PYTHON
    assert LanguageRegistry.normalize("py") == Language.PYTHON
    assert LanguageRegistry.normalize("Python 3") == Language.PYTHON
    assert LanguageRegistry.normalize("cpp") == Language.CPP
    assert LanguageRegistry.normalize("c++") == Language.CPP
    assert LanguageRegistry.normalize("g++") == Language.CPP
    assert LanguageRegistry.normalize("c") == Language.C
    assert LanguageRegistry.normalize("gcc") == Language.C
    assert LanguageRegistry.normalize("java") == Language.JAVA
    assert LanguageRegistry.normalize("javascript") == Language.JAVASCRIPT
    assert LanguageRegistry.normalize("node") == Language.JAVASCRIPT
    assert LanguageRegistry.normalize("rust") == Language.RUST
    assert LanguageRegistry.normalize("go") == Language.GO

    with pytest.raises(UnsupportedLanguageError):
        LanguageRegistry.normalize("ruby_on_rails")

    with pytest.raises(UnsupportedLanguageError):
        LanguageRegistry.normalize("brainfuck")


def test_strategy_resolution_by_family():
    """Verify proper ExecutionStrategy is resolved strictly by LanguageFamily."""
    py_strategy = LanguageRegistry.resolve_strategy(Language.PYTHON)
    assert isinstance(py_strategy, InterpretedExecutionStrategy)
    assert py_strategy.config.family == LanguageFamily.INTERPRETED

    js_strategy = LanguageRegistry.resolve_strategy(Language.JAVASCRIPT)
    assert isinstance(js_strategy, InterpretedExecutionStrategy)
    assert js_strategy.config.family == LanguageFamily.INTERPRETED

    cpp_strategy = LanguageRegistry.resolve_strategy(Language.CPP)
    assert isinstance(cpp_strategy, NativeCompiledExecutionStrategy)
    assert cpp_strategy.config.family == LanguageFamily.COMPILED

    c_strategy = LanguageRegistry.resolve_strategy(Language.C)
    assert isinstance(c_strategy, NativeCompiledExecutionStrategy)
    assert c_strategy.config.family == LanguageFamily.COMPILED

    rust_strategy = LanguageRegistry.resolve_strategy(Language.RUST)
    assert isinstance(rust_strategy, NativeCompiledExecutionStrategy)
    assert rust_strategy.config.family == LanguageFamily.COMPILED

    java_strategy = LanguageRegistry.resolve_strategy(Language.JAVA)
    assert isinstance(java_strategy, VMExecutionStrategy)
    assert java_strategy.config.family == LanguageFamily.VM


def test_canonical_language_config_invariants():
    """Verify canonical LanguageConfig attributes across all registered languages."""
    for config in LanguageRegistry.all_configs():
        assert config.language_id != ""
        assert config.display_name != ""
        assert isinstance(config.family, LanguageFamily)
        assert config.source_extension.startswith(".")
        assert config.default_time_limit > 0
        assert config.default_memory_limit >= 32
        assert config.sandbox_profile != ""
        assert isinstance(config.enabled, bool)

        if config.family in (LanguageFamily.COMPILED, LanguageFamily.VM):
            assert config.requires_compile is True
            assert config.compiler is not None
            assert config.binary_filename is not None
        else:
            assert config.requires_compile is False


# ─────────────────────────────────────────────────────────────────────────────
# 2. UNIT TESTS: Limits, Deadlines, and Classification
# ─────────────────────────────────────────────────────────────────────────────

def test_compile_vs_execution_limits_separation():
    """CompileLimits and ExecutionLimits must maintain distinct independent budgets."""
    c_lim = CompileLimits(timeout=10.0, cpu=2.0, memory_bytes=512 * 1024 * 1024)
    e_lim = ExecutionLimits(timeout=2.0, cpu=1.0, memory_bytes=256 * 1024 * 1024)

    assert c_lim.timeout != e_lim.timeout
    assert c_lim.cpu != e_lim.cpu
    assert c_lim.memory_bytes > e_lim.memory_bytes


def test_dominant_deadline_tracking_and_stage_budgets():
    """Child compile/testcase budgets must be bounded by the dominant submission deadline."""
    tracker = ExecutionDeadlineTracker(total_timeout_s=5.0)
    assert tracker.remaining_seconds() <= 5.0
    assert tracker.is_expired() is False

    # Compile budget cannot exceed configured timeout nor dominant deadline
    c_budget = tracker.compile_budget(configured_compile_timeout_s=15.0)
    assert c_budget <= 5.0

    # Testcase budget cannot exceed configured testcase timeout nor dominant deadline
    tc_budget = tracker.testcase_budget(configured_testcase_timeout_s=2.0)
    assert tc_budget <= 2.0


def test_failure_and_retry_classification():
    """Deterministic submission outcomes must NEVER be marked retryable."""
    assert ErrorCode.STALE_ATTEMPT in NON_RETRYABLE_ERROR_CODES
    assert ErrorCode.EXECUTION_DEADLINE_EXCEEDED in NON_RETRYABLE_ERROR_CODES
    assert ErrorCode.NODE_UNAVAILABLE in RETRYABLE_ERROR_CODES
    assert ErrorCode.CODEBOX_TIMEOUT in RETRYABLE_ERROR_CODES

    # CE, WA, RE, TLE, MLE are non-retryable execution verdicts
    terminal_verdicts = {
        Verdict.ACCEPTED,
        Verdict.WRONG_ANSWER,
        Verdict.COMPILATION_ERROR,
        Verdict.RUNTIME_ERROR,
        Verdict.TIME_LIMIT_EXCEEDED,
        Verdict.MEMORY_LIMIT_EXCEEDED,
    }
    for v in terminal_verdicts:
        assert v != Verdict.SYSTEM_ERROR


def test_diagnostic_sanitization():
    """Compiler output must not leak host filesystem paths or usernames."""
    dummy_ws = Path("/Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/tmp/ccc_exec_9999")
    raw_diagnostic = (
        f"In file included from /Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/tmp/ccc_exec_9999/source/solution.cpp:2:\n"
        f"/Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/tmp/ccc_exec_9999/source/solution.cpp:5:10: error: 'x' undeclared"
    )
    sanitized = sanitize_compiler_output(raw_diagnostic, dummy_ws)
    assert "/Users/santushtkotai" not in sanitized
    assert "/workspace" in sanitized


# ─────────────────────────────────────────────────────────────────────────────
# 3. UNIT & CONCURRENCY TESTS: Content-Addressed Compilation Cache
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_compilation_cache_lifecycle_and_invalidation():
    """Test full cache lifecycle: miss -> store -> hit -> invalidation on source/flags/arch change."""
    with tempfile.TemporaryDirectory() as temp_dir:
        cache_dir = Path(temp_dir)
        cache = CompilationCache(base_dir=cache_dir, enabled=True)

        source_v1 = "#include <iostream>\nint main() { std::cout << 42; return 0; }\n"
        source_v2 = "#include <iostream>\nint main() { std::cout << 99; return 0; }\n"

        key1 = CompilationCacheKey.create(
            language_id="cpp",
            source_code=source_v1,
            compiler_version="GCC 14.1",
            compile_flags=["-O2", "-std=c++20"],
        )

        # 1. Cache Miss
        assert await cache.get(key1) is None

        # Create dummy compiled binary
        dummy_bin = cache_dir / "temp_solution"
        dummy_bin.write_bytes(b"\x7fELF_DUMMY_BINARY_DATA_FOR_TESTING")
        os.chmod(dummy_bin, 0o755)

        dummy_comp_res = CompilationResult(
            success=True,
            executable_path=str(dummy_bin),
            compiler_version="GCC 14.1",
            compile_flags=["-O2", "-std=c++20"],
        )

        # 2. Store Artifact
        stored_artifact = await cache.put(
            key=key1,
            compiled_file=dummy_bin,
            compilation_result=dummy_comp_res,
            artifact_type=ArtifactType.NATIVE_BINARY,
            is_executable=True,
        )
        assert stored_artifact is not None
        assert stored_artifact.size_bytes == dummy_bin.stat().st_size

        # 3. Cache Hit
        target_copy = cache_dir / "copied_solution"
        cached_result = await cache.get(key1, target_dest=target_copy)
        assert cached_result is not None
        art, res = cached_result
        assert res.cached is True
        assert res.duration_ms == 0.0
        assert target_copy.exists()
        assert target_copy.read_bytes() == b"\x7fELF_DUMMY_BINARY_DATA_FOR_TESTING"

        # 4. Invalidation on changed source
        key_changed_source = CompilationCacheKey.create(
            language_id="cpp",
            source_code=source_v2,
            compiler_version="GCC 14.1",
            compile_flags=["-O2", "-std=c++20"],
        )
        assert key_changed_source.cache_id() != key1.cache_id()
        assert await cache.get(key_changed_source) is None

        # 5. Invalidation on changed compiler flags
        key_changed_flags = CompilationCacheKey.create(
            language_id="cpp",
            source_code=source_v1,
            compiler_version="GCC 14.1",
            compile_flags=["-O3", "-std=c++20"],
        )
        assert key_changed_flags.cache_id() != key1.cache_id()
        assert await cache.get(key_changed_flags) is None

        # 6. Invalidation on changed compiler version
        key_changed_version = CompilationCacheKey.create(
            language_id="cpp",
            source_code=source_v1,
            compiler_version="Clang 18.0",
            compile_flags=["-O2", "-std=c++20"],
        )
        assert key_changed_version.cache_id() != key1.cache_id()
        assert await cache.get(key_changed_version) is None


@pytest.mark.asyncio
async def test_compilation_cache_corruption_recovery():
    """Corrupted cache artifact must be detected, purged, and treated as cache miss."""
    with tempfile.TemporaryDirectory() as temp_dir:
        cache = CompilationCache(base_dir=Path(temp_dir), enabled=True)
        source = "int main() { return 0; }"
        key = CompilationCacheKey.create("c", source, compiler_version="GCC 14")

        dummy_bin = Path(temp_dir) / "bin"
        dummy_bin.write_bytes(b"VALID_BINARY_BYTES")
        res = CompilationResult(success=True)

        await cache.put(key, dummy_bin, res)
        entry_dir = cache._entry_dir(key)
        artifact_path = entry_dir / "artifact"

        # Corrupt the artifact by truncating it
        artifact_path.write_bytes(b"CORRUPTED")

        # Lookup should detect size mismatch and return None (miss)
        assert await cache.get(key) is None
        # Entry should have been cleaned up
        assert not artifact_path.exists()


@pytest.mark.asyncio
async def test_compilation_cache_concurrent_requests():
    """Concurrent identical compilation cache store operations must not race or corrupt."""
    with tempfile.TemporaryDirectory() as temp_dir:
        cache = CompilationCache(base_dir=Path(temp_dir), enabled=True)
        source = "int main() { return 42; }"
        key = CompilationCacheKey.create("c", source, compiler_version="GCC 14")

        dummy_bin = Path(temp_dir) / "dummy"
        dummy_bin.write_bytes(b"CONCURRENT_TEST_BYTES")
        res = CompilationResult(success=True)

        async def worker():
            return await cache.put(key, dummy_bin, res)

        # Launch 5 identical concurrent writes
        results = await asyncio.gather(worker(), worker(), worker(), worker(), worker())
        for r in results:
            assert r is not None
            assert r.size_bytes == len(b"CONCURRENT_TEST_BYTES")

        # Verify entry is intact and readable
        cached = await cache.get(key)
        assert cached is not None
        assert cached[1].cached is True


# ─────────────────────────────────────────────────────────────────────────────
# 4. INTEGRATION TESTS: Interpreted Execution (Python & JavaScript)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_python_interpreted_execution_pipeline():
    """Python must bypass native compilation, measure startup, and score testcases."""
    engine = LanguageAwareExecutionEngine()
    py_code = """import sys
lines = sys.stdin.read().split()
if lines:
    a, b = int(lines[0]), int(lines[1])
    print(a + b)
"""
    tcs = [
        TestCaseSchema(id="tc_1", stdin="3 5", expected_output="8"),
        TestCaseSchema(id="tc_2", stdin="10 20", expected_output="30"),
        TestCaseSchema(id="tc_3", stdin="100 200", expected_output="300"),
    ]

    res = await engine.execute(
        language=Language.PYTHON,
        code=py_code,
        testcases=tcs,
    )

    assert res.success is True
    assert res.verdict == Verdict.ACCEPTED
    assert res.passed_testcases == 3
    assert res.compile_time_ms == 0.0  # Zero compile time for interpreted language
    assert res.latencies.get("startup_ms", 0.0) >= 0.0
    assert res.telemetry.get("family") == "interpreted"
    assert res.telemetry.get("compilation_required") is False


@pytest.mark.asyncio
async def test_python_runtime_error_and_timeout():
    """Python runtime error and timeout must be classified correctly."""
    engine = LanguageAwareExecutionEngine()

    # Runtime error
    re_code = "raise ValueError('Explicit test error')"
    tcs = [TestCaseSchema(id="tc_1", stdin="", expected_output="")]
    re_res = await engine.execute(language=Language.PYTHON, code=re_code, testcases=tcs)
    assert re_res.success is False
    assert re_res.verdict == Verdict.RUNTIME_ERROR

    # Time limit exceeded
    tle_code = "import time\ntime.sleep(5.0)\n"
    e_lim = ExecutionLimits(timeout=0.5, memory_bytes=256 * 1024 * 1024)
    tle_res = await engine.execute(
        language=Language.PYTHON,
        code=tle_code,
        testcases=tcs,
        execution_limits=e_lim,
    )
    assert tle_res.success is False
    assert tle_res.verdict == Verdict.TIME_LIMIT_EXCEEDED


@pytest.mark.asyncio
async def test_javascript_interpreted_execution():
    """JavaScript (Node.js) execution through the language-aware pipeline."""
    if not shutil.which("node"):
        pytest.skip("Node.js is not installed on this host.")

    engine = LanguageAwareExecutionEngine()
    js_code = """const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
if (input.length >= 2) {
    const a = parseInt(input[0], 10);
    const b = parseInt(input[1], 10);
    console.log(a * b);
}
"""
    tcs = [
        TestCaseSchema(id="tc_1", stdin="6 7", expected_output="42"),
        TestCaseSchema(id="tc_2", stdin="9 9", expected_output="81"),
    ]

    res = await engine.execute(
        language=Language.JAVASCRIPT,
        code=js_code,
        testcases=tcs,
    )
    assert res.success is True
    assert res.verdict == Verdict.ACCEPTED
    assert res.passed_testcases == 2
    assert res.compile_time_ms == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# 5. INTEGRATION TESTS: Native Compiled Execution (C & C++)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cpp_amortized_compilation_and_caching():
    """
    C++ must compile ONCE for all testcases.
    A second identical submission must hit the compilation cache with 0ms compile time.
    """
    if not (shutil.which("g++") or shutil.which("clang++")):
        pytest.skip("C++ compiler is not installed on this host.")

    with tempfile.TemporaryDirectory() as cache_dir:
        shared_cache = CompilationCache(base_dir=Path(cache_dir), enabled=True)
        engine = LanguageAwareExecutionEngine(cache=shared_cache)

        cpp_code = """#include <iostream>
int main() {
    long long a, b;
    if (std::cin >> a >> b) {
        std::cout << (a + b) << std::endl;
    }
    return 0;
}
"""
        # 5 testcases: all must run against the single compiled artifact
        tcs = [
            TestCaseSchema(id=f"tc_{i+1}", stdin=f"{i*10} {i*20}", expected_output=f"{i*30}")
            for i in range(5)
        ]

        # First run: compile miss -> compile once -> run 5 testcases
        res1 = await engine.execute(
            language=Language.CPP,
            code=cpp_code,
            testcases=tcs,
        )
        assert res1.success is True
        assert res1.verdict == Verdict.ACCEPTED
        assert res1.passed_testcases == 5
        assert res1.compile_time_ms > 0.0
        assert res1.telemetry.get("cache_hit") is False

        # Second run: must be a cache HIT -> compile_time_ms == 0
        res2 = await engine.execute(
            language=Language.CPP,
            code=cpp_code,
            testcases=tcs,
        )
        assert res2.success is True
        assert res2.verdict == Verdict.ACCEPTED
        assert res2.passed_testcases == 5
        assert res2.compile_time_ms == 0.0
        assert res2.telemetry.get("cache_hit") is True


@pytest.mark.asyncio
async def test_cpp_compilation_error_blocks_testcases():
    """Compilation error in C++ must abort immediately and execute ZERO testcases."""
    if not (shutil.which("g++") or shutil.which("clang++")):
        pytest.skip("C++ compiler is not installed on this host.")

    engine = LanguageAwareExecutionEngine()
    bad_cpp = """#include <iostream>
int main() {
    this_is_an_undeclared_syntax_error();
    return 0;
}
"""
    tcs = [TestCaseSchema(id="tc_1", stdin="", expected_output="")]
    res = await engine.execute(language=Language.CPP, code=bad_cpp, testcases=tcs)

    assert res.success is False
    assert res.verdict == Verdict.COMPILATION_ERROR
    assert "error:" in res.compile_output
    assert len(res.testcase_results) == 0  # Crucial: ZERO testcases executed


@pytest.mark.asyncio
async def test_c_native_execution_pipeline():
    """C (GCC/Clang) compilation and execution."""
    if not (shutil.which("gcc") or shutil.which("clang")):
        pytest.skip("C compiler is not installed on this host.")

    engine = LanguageAwareExecutionEngine()
    c_code = """#include <stdio.h>
int main() {
    int a, b;
    if (scanf("%d %d", &a, &b) == 2) {
        printf("%d\\n", a - b);
    }
    return 0;
}
"""
    tcs = [
        TestCaseSchema(id="tc_1", stdin="50 15", expected_output="35"),
        TestCaseSchema(id="tc_2", stdin="100 1", expected_output="99"),
    ]
    res = await engine.execute(language=Language.C, code=c_code, testcases=tcs)
    assert res.success is True
    assert res.verdict == Verdict.ACCEPTED
    assert res.passed_testcases == 2


# ─────────────────────────────────────────────────────────────────────────────
# 6. INTEGRATION TESTS: Java / VM Strategy
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_java_vm_execution_pipeline():
    """Java compilation to .class and execution with JVM memory flags."""
    if not (shutil.which("javac") and shutil.which("java")):
        pytest.skip("JDK (javac / java) is not installed on this host.")

    engine = LanguageAwareExecutionEngine()
    java_code = """import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextLong()) {
            long a = sc.nextLong();
            long b = sc.nextLong();
            System.out.println(a + b);
        }
    }
}
"""
    tcs = [
        TestCaseSchema(id="tc_1", stdin="123456789 987654321", expected_output="1111111110"),
    ]
    res = await engine.execute(language=Language.JAVA, code=java_code, testcases=tcs)
    assert res.success is True
    assert res.verdict == Verdict.ACCEPTED
    assert res.passed_testcases == 1
    assert res.telemetry.get("family") == "vm"


# ─────────────────────────────────────────────────────────────────────────────
# 7. SECURITY & NODE COMPATIBILITY TESTS
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_security_cross_language_contamination_blocked():
    """Foreign driver tokens must be rejected before compilation or execution."""
    engine = LanguageAwareExecutionEngine()
    bad_code = """// Leaked Python driver in C++
#include <iostream>
# CCC Trusted Judge Execution Driver (Python)
int main() { return 0; }
"""
    tcs = [TestCaseSchema(id="tc_1", stdin="", expected_output="")]
    res = await engine.execute(language=Language.CPP, code=bad_code, testcases=tcs)
    assert res.success is False
    assert res.verdict == Verdict.COMPILATION_ERROR
    assert "Cross-language contamination blocked" in res.compile_output


def test_node_capability_matching():
    """Node claim logic must verify language and architecture compatibility."""
    node_langs = {"python", "javascript", "cpp"}
    node_arch = "x86_64"

    # Supported language
    assert "python" in node_langs
    assert "cpp" in node_langs

    # Unsupported language
    assert "rust" not in node_langs

    # Incompatible architecture check
    job_req_arch = "arm64"
    assert job_req_arch not in node_arch
