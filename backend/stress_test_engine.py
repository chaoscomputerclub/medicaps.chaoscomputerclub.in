import asyncio
import time
from uuid import uuid4
from typing import List
from app.engine.providers.docker_provider import DockerSandboxProvider
from app.engine.enums import Language, ComparisonMode
from app.engine.schemas import TestCaseSchema

async def worker(provider: DockerSandboxProvider, task_id: int, lang: Language, code: str, testcases: List[TestCaseSchema], results: list):
    start_time = time.time()
    try:
        res = await provider.execute_batch(
            language=lang,
            code=code,
            testcases=testcases,
            time_limit=2.0,
            memory_limit_mb=128,
            comparison_mode=ComparisonMode.TRIMMED
        )
        duration = time.time() - start_time
        results.append({
            "task_id": task_id,
            "success": res.success,
            "verdict": res.verdict.value,
            "duration": duration,
            "error": None
        })
    except Exception as e:
        duration = time.time() - start_time
        results.append({
            "task_id": task_id,
            "success": False,
            "verdict": "ERROR",
            "duration": duration,
            "error": str(e)
        })

async def main():
    print("🚀 Initializing CCC Docker Engine Stress Test...")
    provider = DockerSandboxProvider()
    
    is_healthy = await provider.healthy()
    if not is_healthy:
        print("❌ Docker daemon is not healthy! Cannot proceed with deep stress test.")
        return
        
    print("✅ Docker daemon is healthy.")
    print("🧊 Pre-warming container pool (if not already warm)...")
    from app.engine.docker.pool import prewarm_containers
    await prewarm_containers()
    
    print("🔥 Starting Deep Stress Test (100 Concurrent Executions) 🔥")
    
    testcases = [
        TestCaseSchema(id="tc1", stdin="5\n", expected_output="120"),
        TestCaseSchema(id="tc2", stdin="6\n", expected_output="720")
    ]
    
    # A mix of C++ and Python submissions computing factorial
    cpp_code = """
#include <iostream>
using namespace std;
int main() {
    long long n;
    if (cin >> n) {
        long long f = 1;
        for(long long i=1; i<=n; i++) f *= i;
        cout << f << endl;
    }
    return 0;
}
"""
    python_code = """
import sys
for line in sys.stdin:
    n = int(line.strip())
    f = 1
    for i in range(1, n+1):
        f *= i
    print(f)
"""

    results = []
    tasks = []
    
    # 50 C++ and 50 Python concurrent submissions
    total_requests = 100
    
    start_time = time.time()
    for i in range(total_requests):
        if i % 2 == 0:
            tasks.append(worker(provider, i, Language.CPP, cpp_code, testcases, results))
        else:
            tasks.append(worker(provider, i, Language.PYTHON, python_code, testcases, results))
            
    print(f"Submitting {total_requests} tasks concurrently...")
    await asyncio.gather(*tasks)
    
    total_time = time.time() - start_time
    
    successful_runs = sum(1 for r in results if r["success"])
    accepted_runs = sum(1 for r in results if r["verdict"] == "accepted")
    errors = sum(1 for r in results if r["error"] is not None)
    
    print("\n" + "="*50)
    print("📊 STRESS TEST RESULTS 📊")
    print("="*50)
    print(f"Total Submissions : {total_requests}")
    print(f"Total Wall Time   : {total_time:.2f} seconds")
    print(f"Throughput        : {total_requests / total_time:.2f} submissions / second")
    print(f"Accepted Runs     : {accepted_runs} / {total_requests}")
    print(f"Internal Errors   : {errors}")
    
    if errors > 0:
        print("\nSample Errors:")
        for r in results:
            if r["error"]:
                print(f"Task {r['task_id']}: {r['error']}")
                break
                
if __name__ == "__main__":
    asyncio.run(main())
