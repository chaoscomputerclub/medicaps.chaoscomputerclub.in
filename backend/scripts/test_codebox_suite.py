"""
Chaos Computer Club — Comprehensive CodeBox Execution Engine Test Suite
Tests multiple languages, testcase evaluation, verdicts, TLE, and batch executions.
"""

import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.engine.enums import ComparisonMode, Language, Verdict
from app.engine.providers.codebox_provider import CodeboxProvider
from app.engine.schemas import TestCaseSchema


async def main():
    print("=" * 60)
    print("⚡ [CCC] Running Comprehensive CodeBox Engine Test Suite")
    print("=" * 60)

    provider = CodeboxProvider()
    is_healthy = await provider.healthy()
    print(f"📡 CodeBox Health Status: {'HEALTHY ✅' if is_healthy else 'OFFLINE ❌'}")
    if not is_healthy:
        print(f"Provider URL: {provider.base_url}")
        return

    # ── TEST 1: Python 3 Accepted Execution ────────────────────────────
    print("\n🔹 TEST 1: Python 3 - Standard Input / Output")
    py_code = """
import sys
data = sys.stdin.read().split()
if data:
    a, b = int(data[0]), int(data[1])
    print(a + b)
else:
    print("Hello Chaos Computer Club!")
"""
    tcs = [
        TestCaseSchema(id="tc_1", name="Sample 1", stdin="15 27\n", expected_output="42\n"),
        TestCaseSchema(id="tc_2", name="Sample 2", stdin="100 -50\n", expected_output="50\n"),
    ]
    res = await provider.execute_batch(
        language=Language.PYTHON,
        code=py_code,
        testcases=tcs,
        time_limit=2.0,
        memory_limit_mb=256,
        comparison_mode=ComparisonMode.TRIMMED,
    )
    print(f"  Verdict: {res.verdict.value} | Passed: {res.passed_testcases}/{res.total_testcases} | Time: {res.time*1000:.1f}ms")
    assert res.verdict == Verdict.ACCEPTED, f"Expected ACCEPTED but got {res.verdict}"
    print("  ✓ Test 1 Passed!")

    # ── TEST 2: C++ (GCC) Execution ──────────────────────────────────
    print("\n🔹 TEST 2: C++ - Vector Sorting & Output")
    cpp_code = """
#include <iostream>
#include <vector>
#include <algorithm>

using namespace std;

int main() {
    int n;
    if (!(cin >> n)) return 0;
    vector<int> a(n);
    for (int i = 0; i < n; ++i) cin >> a[i];
    sort(a.begin(), a.end());
    for (int i = 0; i < n; ++i) {
        cout << a[i] << (i + 1 == n ? "" : " ");
    }
    cout << endl;
    return 0;
}
"""
    tcs_cpp = [
        TestCaseSchema(id="cpp_1", name="Sort 5 items", stdin="5\n4 2 5 1 3\n", expected_output="1 2 3 4 5\n"),
    ]
    res_cpp = await provider.execute_batch(
        language=Language.CPP,
        code=cpp_code,
        testcases=tcs_cpp,
        time_limit=2.0,
        memory_limit_mb=256,
    )
    print(f"  Verdict: {res_cpp.verdict.value} | Passed: {res_cpp.passed_testcases}/{res_cpp.total_testcases} | Time: {res_cpp.time*1000:.1f}ms")
    assert res_cpp.verdict == Verdict.ACCEPTED, f"Expected ACCEPTED but got {res_cpp.verdict}"
    print("  ✓ Test 2 Passed!")

    # ── TEST 3: JavaScript / Node.js ───────────────────────────────────
    print("\n🔹 TEST 3: JavaScript / Node.js - String Reversal")
    js_code = """
const fs = require('fs');
const input = fs.readFileSync('/dev/stdin', 'utf-8').trim();
console.log(input.split('').reverse().join(''));
"""
    tcs_js = [
        TestCaseSchema(id="js_1", name="Reverse String", stdin="medicaps\n", expected_output="spacidem\n"),
    ]
    res_js = await provider.execute_batch(
        language=Language.JAVASCRIPT,
        code=js_code,
        testcases=tcs_js,
        time_limit=2.0,
        memory_limit_mb=256,
    )
    print(f"  Verdict: {res_js.verdict.value} | Passed: {res_js.passed_testcases}/{res_js.total_testcases} | Time: {res_js.time*1000:.1f}ms")
    assert res_js.verdict == Verdict.ACCEPTED, f"Expected ACCEPTED but got {res_js.verdict}"
    print("  ✓ Test 3 Passed!")

    # ── TEST 4: Wrong Answer (WA) Detection ───────────────────────────
    print("\n🔹 TEST 4: Wrong Answer Detection")
    wa_code = "print(100)"
    tcs_wa = [
        TestCaseSchema(id="wa_1", name="Expect 42", stdin="", expected_output="42"),
    ]
    res_wa = await provider.execute_batch(
        language=Language.PYTHON,
        code=wa_code,
        testcases=tcs_wa,
        time_limit=2.0,
        memory_limit_mb=256,
    )
    print(f"  Verdict: {res_wa.verdict.value} | Passed: {res_wa.passed_testcases}/{res_wa.total_testcases}")
    assert res_wa.verdict == Verdict.WRONG_ANSWER, f"Expected WRONG_ANSWER but got {res_wa.verdict}"
    print("  ✓ Test 4 Passed!")

    # ── TEST 5: Time Limit Exceeded (TLE) Detection ───────────────────
    print("\n🔹 TEST 5: Time Limit Exceeded (TLE) Protection")
    tle_code = """
import time
while True:
    time.sleep(0.1)
"""
    tcs_tle = [
        TestCaseSchema(id="tle_1", name="Infinite Loop", stdin="", expected_output="none"),
    ]
    res_tle = await provider.execute_batch(
        language=Language.PYTHON,
        code=tle_code,
        testcases=tcs_tle,
        time_limit=1.0,
        memory_limit_mb=128,
    )
    print(f"  Verdict: {res_tle.verdict.value} | Passed: {res_tle.passed_testcases}/{res_tle.total_testcases}")
    assert res_tle.verdict == Verdict.TIME_LIMIT_EXCEEDED, f"Expected TIME_LIMIT_EXCEEDED but got {res_tle.verdict}"
    print("  ✓ Test 5 Passed!")

    # ── TEST 6: Runtime Error (RE) Detection ──────────────────────────
    print("\n🔹 TEST 6: Runtime Error (ZeroDivisionError)")
    re_code = """
x = 10 / 0
print(x)
"""
    tcs_re = [
        TestCaseSchema(id="re_1", name="Div By Zero", stdin="", expected_output="none"),
    ]
    res_re = await provider.execute_batch(
        language=Language.PYTHON,
        code=re_code,
        testcases=tcs_re,
        time_limit=2.0,
        memory_limit_mb=256,
    )
    print(f"  Verdict: {res_re.verdict.value} | Stderr: {res_re.testcase_results[0].stderr[:60]}...")
    assert res_re.verdict == Verdict.RUNTIME_ERROR, f"Expected RUNTIME_ERROR but got {res_re.verdict}"
    print("  ✓ Test 6 Passed!")

    # ── TEST 7: Java OpenJDK Execution ─────────────────────────────────
    print("\n🔹 TEST 7: Java OpenJDK - Factorial Calculation")
    java_code = """
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int n = sc.nextInt();
            long fact = 1;
            for (int i = 2; i <= n; i++) fact *= i;
            System.out.println(fact);
        }
    }
}
"""
    tcs_java = [
        TestCaseSchema(id="java_1", name="Factorial 5", stdin="5\n", expected_output="120\n"),
    ]
    res_java = await provider.execute_batch(
        language=Language.JAVA,
        code=java_code,
        testcases=tcs_java,
        time_limit=3.0,
        memory_limit_mb=256,
    )
    print(f"  Verdict: {res_java.verdict.value} | Passed: {res_java.passed_testcases}/{res_java.total_testcases} | Time: {res_java.time*1000:.1f}ms")
    assert res_java.verdict == Verdict.ACCEPTED, f"Expected ACCEPTED but got {res_java.verdict}"
    print("  ✓ Test 7 Passed!")

    # ── TEST 8: TypeScript Execution ──────────────────────────────────
    print("\n🔹 TEST 8: TypeScript - Interface & Type Checking")
    ts_code = """
declare var require: any;

interface Cadet {
    name: string;
    points: number;
}

const fs = require('fs');
const input: string = fs.readFileSync(0, 'utf-8').trim();
const cadet: Cadet = { name: input, points: 100 };
console.log(`Cadet ${cadet.name} score: ${cadet.points}`);
"""
    tcs_ts = [
        TestCaseSchema(id="ts_1", name="Cadet points", stdin="Santusht\n", expected_output="Cadet Santusht score: 100\n"),
    ]
    res_ts = await provider.execute_batch(
        language=Language.TYPESCRIPT,
        code=ts_code,
        testcases=tcs_ts,
        time_limit=3.0,
        memory_limit_mb=256,
    )
    if res_ts.compile_output:
        print(f"  TS Compile Output: {res_ts.compile_output}")
    print(f"  Verdict: {res_ts.verdict.value} | Passed: {res_ts.passed_testcases}/{res_ts.total_testcases} | Time: {res_ts.time*1000:.1f}ms")
    assert res_ts.verdict == Verdict.ACCEPTED, f"Expected ACCEPTED but got {res_ts.verdict}"
    print("  ✓ Test 8 Passed!")

    print("\n" + "=" * 60)
    print("🎉 ALL 8 CODEBOX EVALUATION ENGINE TESTS PASSED WITH 100% ACCURACY!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
