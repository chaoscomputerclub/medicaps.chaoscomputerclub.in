"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Database Seed Service: Populates official live demo contest, assessment round,
and problems strictly into the database (zero static data).
"""

from datetime import datetime, timezone, timedelta
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import (
    OfflineContest,
    ContestProblem,
    Assessment,
    AssessmentProblem,
    now_utc,
)

logger = logging.getLogger(__name__)

CONTEST_SLUG = "medicaps-offline-open-2026"

# ─── Starter Codes ────────────────────────────────────────────────────────────

PROB_A_STARTER = {
    "python": """import sys

def count_mirror_pairs(passes: list[str]) -> int:
    # A mirror pair is (i, j) with i < j where passes[i] is the reverse of passes[j]
    counts = {}
    total_pairs = 0
    for p in passes:
        rev = p[::-1]
        if rev in counts:
            total_pairs += counts[rev]
        counts[p] = counts.get(p, 0) + 1
    return total_pairs

def main():
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    n = int(input_data[0])
    passes = input_data[1:n+1]
    print(count_mirror_pairs(passes))

if __name__ == "__main__":
    main()
""",
    "cpp": """#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <algorithm>

using namespace std;

long long countMirrorPairs(const vector<string>& passes) {
    unordered_map<string, long long> counts;
    long long total = 0;
    for (const string& p : passes) {
        string rev = p;
        reverse(rev.begin(), rev.end());
        if (counts.count(rev)) {
            total += counts[rev];
        }
        counts[p]++;
    }
    return total;
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    if (cin >> n) {
        vector<string> passes(n);
        for (int i = 0; i < n; i++) cin >> passes[i];
        cout << countMirrorPairs(passes) << "\n";
    }
    return 0;
}
""",
    "javascript": """const fs = require('fs');

function countMirrorPairs(passes) {
    const counts = new Map();
    let total = 0;
    for (const p of passes) {
        const rev = p.split('').reverse().join('');
        if (counts.has(rev)) {
            total += counts.get(rev);
        }
        counts.set(p, (counts.get(p) || 0) + 1);
    }
    return total;
}

function main() {
    const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
    if (!input || input.length === 0 || input[0] === "") return;
    const n = parseInt(input[0], 10);
    const passes = input.slice(1, n + 1);
    console.log(countMirrorPairs(passes));
}

main();
"""
}

PROB_B_STARTER = {
    "python": """import sys

def max_bandwidth_utility(k: int, m: int, processes: list[tuple[int, int, int]]) -> int:
    min_sum = sum(p[0] for p in processes)
    if min_sum > m:
        return -1
    
    # Base utility from minimum allocations
    utility = sum(p[0] * p[2] for p in processes)
    leftover = m - min_sum
    
    # Greedily allocate remaining bandwidth to processes with highest priority
    # Sort descending by priority (p[2])
    sorted_procs = sorted(processes, key=lambda x: x[2], reverse=True)
    for min_i, max_i, priority in sorted_procs:
        can_add = min(max_i - min_i, leftover)
        utility += can_add * priority
        leftover -= can_add
        if leftover == 0:
            break
            
    return utility

def main():
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    k = int(input_data[0])
    m = int(input_data[1])
    processes = []
    idx = 2
    for _ in range(k):
        min_i = int(input_data[idx])
        max_i = int(input_data[idx+1])
        prio = int(input_data[idx+2])
        processes.append((min_i, max_i, prio))
        idx += 3
    print(max_bandwidth_utility(k, m, processes))

if __name__ == "__main__":
    main()
""",
    "cpp": """#include <iostream>
#include <vector>
#include <algorithm>

using namespace std;

struct Process {
    long long min_val;
    long long max_val;
    long long priority;
};

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int k;
    long long m;
    if (!(cin >> k >> m)) return 0;

    vector<Process> procs(k);
    long long min_sum = 0;
    long long utility = 0;
    for (int i = 0; i < k; i++) {
        cin >> procs[i].min_val >> procs[i].max_val >> procs[i].priority;
        min_sum += procs[i].min_val;
        utility += procs[i].min_val * procs[i].priority;
    }

    if (min_sum > m) {
        cout << -1 << "\n";
        return 0;
    }

    long long leftover = m - min_sum;
    sort(procs.begin(), procs.end(), [](const Process& a, const Process& b) {
        return a.priority > b.priority;
    });

    for (const auto& p : procs) {
        long long can_add = min(p.max_val - p.min_val, leftover);
        utility += can_add * p.priority;
        leftover -= can_add;
        if (leftover == 0) break;
    }

    cout << utility << "\n";
    return 0;
}
""",
    "javascript": """const fs = require('fs');

function main() {
    const tokens = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
    if (!tokens || tokens.length === 0 || tokens[0] === "") return;

    const k = parseInt(tokens[0], 10);
    const m = parseInt(tokens[1], 10);
    const procs = [];
    let minSum = 0;
    let utility = 0;
    let idx = 2;

    for (let i = 0; i < k; i++) {
        const minVal = parseInt(tokens[idx], 10);
        const maxVal = parseInt(tokens[idx + 1], 10);
        const priority = parseInt(tokens[idx + 2], 10);
        idx += 3;
        procs.push({ minVal, maxVal, priority });
        minSum += minVal;
        utility += minVal * priority;
    }

    if (minSum > m) {
        console.log(-1);
        return;
    }

    let leftover = m - minSum;
    procs.sort((a, b) => b.priority - a.priority);

    for (const p of procs) {
        const canAdd = Math.min(p.maxVal - p.minVal, leftover);
        utility += canAdd * p.priority;
        leftover -= canAdd;
        if (leftover === 0) break;
    }

    console.log(utility);
}

main();
"""
}

PROB_C_STARTER = {
    "python": """import sys
import heapq

def min_relay_latency(n: int, m: int, k: int, edges: list[tuple[int, int, int]]) -> int:
    adj = {i: [] for i in range(1, n + 1)}
    for u, v, w in edges:
        adj[u].append((v, w))
        adj[v].append((u, w))
    
    # Priority queue stores: (current_cost, current_node, boosters_used)
    dist = {}
    pq = [(0, 1, 0)]
    dist[(1, 0)] = 0
    
    while pq:
        cost, u, used = heapq.heappop(pq)
        
        if cost > dist.get((u, used), float('inf')):
            continue
            
        if u == n:
            return cost
            
        for v, w in adj[u]:
            # Option 1: traverse without booster
            if cost + w < dist.get((v, used), float('inf')):
                dist[(v, used)] = cost + w
                heapq.heappush(pq, (cost + w, v, used))
                
            # Option 2: traverse using a quantum booster (halve latency w // 2)
            if used < k:
                boosted_cost = cost + (w // 2)
                if boosted_cost < dist.get((v, used + 1), float('inf')):
                    dist[(v, used + 1)] = boosted_cost
                    heapq.heappush(pq, (boosted_cost, v, used + 1))
                    
    best = float('inf')
    for b in range(k + 1):
        if (n, b) in dist:
            best = min(best, dist[(n, b)])
            
    return best if best != float('inf') else -1

def main():
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    n = int(input_data[0])
    m = int(input_data[1])
    k = int(input_data[2])
    edges = []
    idx = 3
    for _ in range(m):
        u = int(input_data[idx])
        v = int(input_data[idx+1])
        w = int(input_data[idx+2])
        edges.append((u, v, w))
        idx += 3
    print(min_relay_latency(n, m, k, edges))

if __name__ == "__main__":
    main()
""",
    "cpp": """#include <iostream>
#include <vector>
#include <queue>
#include <tuple>

using namespace std;

const long long INF = 1e18;

struct State {
    long long cost;
    int u;
    int used;
    bool operator>(const State& other) const {
        return cost > other.cost;
    }
};

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n, m, k;
    if (!(cin >> n >> m >> k)) return 0;

    vector<vector<pair<int, int>>> adj(n + 1);
    for (int i = 0; i < m; i++) {
        int u, v, w;
        cin >> u >> v >> w;
        adj[u].push_back({v, w});
        adj[v].push_back({u, w});
    }

    vector<vector<long long>> dist(n + 1, vector<long long>(k + 1, INF));
    priority_queue<State, vector<State>, greater<State>> pq;

    dist[1][0] = 0;
    pq.push({0, 1, 0});

    while (!pq.empty()) {
        auto [cost, u, used] = pq.top();
        pq.pop();

        if (cost > dist[u][used]) continue;
        if (u == n) {
            cout << cost << "\n";
            return 0;
        }

        for (auto [v, w] : adj[u]) {
            // Option 1: standard
            if (cost + w < dist[v][used]) {
                dist[v][used] = cost + w;
                pq.push({cost + w, v, used});
            }
            // Option 2: booster
            if (used < k) {
                long long b_cost = cost + (w / 2);
                if (b_cost < dist[v][used + 1]) {
                    dist[v][used + 1] = b_cost;
                    pq.push({b_cost, v, used + 1});
                }
            }
        }
    }

    long long ans = INF;
    for (int b = 0; b <= k; b++) ans = min(ans, dist[n][b]);
    cout << (ans == INF ? -1 : ans) << "\n";
    return 0;
}
""",
    "javascript": """const fs = require('fs');

function main() {
    const tokens = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
    if (!tokens || tokens.length === 0 || tokens[0] === "") return;

    const n = parseInt(tokens[0], 10);
    const m = parseInt(tokens[1], 10);
    const k = parseInt(tokens[2], 10);

    const adj = Array.from({ length: n + 1 }, () => []);
    let idx = 3;
    for (let i = 0; i < m; i++) {
        const u = parseInt(tokens[idx++], 10);
        const v = parseInt(tokens[idx++], 10);
        const w = parseInt(tokens[idx++], 10);
        adj[u].push([v, w]);
        adj[v].push([u, w]);
    }

    // dist[u][used]
    const dist = Array.from({ length: n + 1 }, () => Array(k + 1).fill(Infinity));
    dist[1][0] = 0;

    // Simple priority queue or array search
    const queue = [[0, 1, 0]];

    while (queue.length > 0) {
        queue.sort((a, b) => a[0] - b[0]);
        const [cost, u, used] = queue.shift();

        if (cost > dist[u][used]) continue;
        if (u === n) {
            console.log(cost);
            return;
        }

        for (const [v, w] of adj[u]) {
            if (cost + w < dist[v][used]) {
                dist[v][used] = cost + w;
                queue.push([cost + w, v, used]);
            }
            if (used < k) {
                const bCost = cost + Math.floor(w / 2);
                if (bCost < dist[v][used + 1]) {
                    dist[v][used + 1] = bCost;
                    queue.push([bCost, v, used + 1]);
                }
            }
        }
    }

    let ans = Infinity;
    for (let b = 0; b <= k; b++) ans = Math.min(ans, dist[n][b]);
    console.log(ans === Infinity ? -1 : ans);
}

main();
"""
}


async def seed_database(db: AsyncSession):
    """Seed official live demo contest and assessment problems in PostgreSQL/SQLite."""
    # Check if contest exists
    existing_contest = await db.execute(
        select(OfflineContest).where(OfflineContest.slug == CONTEST_SLUG)
    )
    contest_obj = existing_contest.scalars().first()
    if contest_obj:
        logger.info("Demo contest '%s' exists, refreshing problem schemas and testcases...", CONTEST_SLUG)
        p_res = await db.execute(
            select(AssessmentProblem).join(Assessment).where(Assessment.slug == CONTEST_SLUG)
        )
        existing_probs = {p.problem_index: p for p in p_res.scalars().all()}
        if "A" in existing_probs:
            existing_probs["A"].sample_testcases = [
                {"stdin": "4\nAB\nBA\nCD\nDC", "input": "4\nAB\nBA\nCD\nDC", "expected_output": "2", "output": "2", "explanation": "(AB, BA) and (CD, DC) form 2 mirror pairs."},
                {"stdin": "3\nXYZ\nZYX\nABC", "input": "3\nXYZ\nZYX\nABC", "expected_output": "1", "output": "1", "explanation": "(XYZ, ZYX) forms 1 mirror pair."}
            ]
            existing_probs["A"].hidden_testcases = [
                {"stdin": "2\nRACECAR\nRACECAR", "input": "2\nRACECAR\nRACECAR", "expected_output": "1", "output": "1"},
                {"stdin": "5\nAAA\nAAA\nAAA\nBBB\nCCC", "input": "5\nAAA\nAAA\nAAA\nBBB\nCCC", "expected_output": "3", "output": "3"},
                {"stdin": "6\nHELLO\nOLLEH\nWORLD\nDLROW\nTEST\nTSET", "input": "6\nHELLO\nOLLEH\nWORLD\nDLROW\nTEST\nTSET", "expected_output": "3", "output": "3"},
                {"stdin": "1\nSOLO", "input": "1\nSOLO", "expected_output": "0", "output": "0"}
            ]
            existing_probs["A"].starter_codes = PROB_A_STARTER
        if "B" in existing_probs:
            existing_probs["B"].sample_testcases = [
                {"stdin": "2 10\n2 5 10\n3 6 20", "input": "2 10\n2 5 10\n3 6 20", "expected_output": "160", "output": "160", "explanation": "Allocate 2 to p1 and 6 to p2 = 8, leftover 2 to p1 = 4 total, utility 4*10 + 6*20 = 160."},
                {"stdin": "2 4\n3 5 10\n2 4 20", "input": "2 4\n3 5 10\n2 4 20", "expected_output": "-1", "output": "-1", "explanation": "Minimum requirements sum to 3 + 2 = 5, which exceeds total bandwidth 4."}
            ]
            existing_probs["B"].hidden_testcases = [
                {"stdin": "3 15\n1 4 5\n2 6 15\n3 7 10", "input": "3 15\n1 4 5\n2 6 15\n3 7 10", "expected_output": "170", "output": "170"},
                {"stdin": "1 10\n5 12 8", "input": "1 10\n5 12 8", "expected_output": "80", "output": "80"},
                {"stdin": "2 10\n6 8 5\n5 9 10", "input": "2 10\n6 8 5\n5 9 10", "expected_output": "-1", "output": "-1"}
            ]
            existing_probs["B"].starter_codes = PROB_B_STARTER
        if "C" in existing_probs:
            existing_probs["C"].sample_testcases = [
                {"stdin": "4 4 1\n1 2 10\n2 4 20\n1 3 15\n3 4 15", "input": "4 4 1\n1 2 10\n2 4 20\n1 3 15\n3 4 15", "expected_output": "20", "output": "20", "explanation": "Path 1 -> 2 -> 4 has latency 10 + 20 = 30. Applying 1 repeater to edge (2,4) reduces 20 to 10. Total latency = 10 + 10 = 20."},
                {"stdin": "3 1 1\n1 2 10", "input": "3 1 1\n1 2 10", "expected_output": "-1", "output": "-1", "explanation": "Workstation 3 is unreachable."}
            ]
            existing_probs["C"].hidden_testcases = [
                {"stdin": "3 3 0\n1 2 5\n2 3 5\n1 3 12", "input": "3 3 0\n1 2 5\n2 3 5\n1 3 12", "expected_output": "10", "output": "10"},
                {"stdin": "5 6 2\n1 2 100\n2 3 100\n3 5 100\n1 4 40\n4 5 100\n2 5 200", "input": "5 6 2\n1 2 100\n2 3 100\n3 5 100\n1 4 40\n4 5 100\n2 5 200", "expected_output": "70", "output": "70"}
            ]
            existing_probs["C"].starter_codes = PROB_C_STARTER
        await db.commit()
        return

    now = datetime.now(timezone.utc)
    starts = now - timedelta(hours=1)
    ends = now + timedelta(days=7)

    # 1. Create Demo OfflineContest
    contest = OfflineContest(
        slug=CONTEST_SLUG,
        title="CCC Medi-Caps Campus Clash 2026",
        season="Season 1 — 2026",
        status="live",
        division="open",
        starts_at=starts,
        ends_at=ends,
        check_in_opens_at=starts - timedelta(minutes=30),
        venue="Computing Complex · Lab Block 04",
        seat_capacity=60,
        registered_count=0,
        problem_count=3,
        environment="Ubuntu 24.04 LTS · GCC 14.2 / Python 3.12 / Node 20",
        chief_proctors=["Dr. Ratnesh Litoriya", "Prof. Amit Shrivastava", "Lead Proctor @ CCC MCU"],
        prize_pool="₹25,000 + Physical Badges",
        sponsor="Chaos Computer Club India",
        summary="The premier offline campus competitive programming challenge. Phase 1 Online Screening Assessment qualifies the Top 30 cadets to advance to the physical on-premise air-gapped lab final.",
        rules=[
            "Single workstation, physical air-gapped network.",
            "Proctored live screening with automated anti-cheat telemetry.",
            "Points awarded dynamically per testcase suite passed.",
            "Ties broken by aggregate submission penalty time."
        ],
        created_at=now,
    )
    db.add(contest)
    await db.flush()

    # 2. Add Contest Problems (Overview list)
    p1 = ContestProblem(
        contest_id=contest.id,
        problem_index="A",
        title="Campus Pass Hash Collision",
        topic="Hash Tables & String Processing",
        points=100,
        solved_count=0,
        editorial_summary="Maintain frequency counts of encountered strings and pair with reversed keys."
    )
    p2 = ContestProblem(
        contest_id=contest.id,
        problem_index="B",
        title="Subnet Bandwidth Allocation",
        topic="Greedy & Resource Scheduling",
        points=150,
        solved_count=0,
        editorial_summary="Satisfy minimum bounds first, then greedily distribute surplus bandwidth by priority."
    )
    p3 = ContestProblem(
        contest_id=contest.id,
        problem_index="C",
        title="Air-Gapped Relay Optimization",
        topic="Modified Dijkstra & State Graphs",
        points=250,
        solved_count=0,
        editorial_summary="Run multi-layer shortest path algorithm tracking state (node, repeaters_used)."
    )
    db.add_all([p1, p2, p3])

    # 3. Create Assessment Round
    assessment = Assessment(
        contest_id=contest.id,
        slug=CONTEST_SLUG,
        title="Phase 1 Screening Assessment: Medi-Caps Campus Clash 2026",
        summary="90-minute competitive screening round. Pass all sample and hidden testcases across Python, C++, and JavaScript.",
        duration_minutes=90,
        starts_at=starts,
        ends_at=ends,
        is_active=True,
        max_violations=3,
        created_at=now,
    )
    db.add(assessment)
    await db.flush()

    # 4. Create Assessment Problems with full descriptions, starter codes, and testcases
    prob_a = AssessmentProblem(
        assessment_id=assessment.id,
        problem_index="A",
        title="Campus Pass Hash Collision",
        difficulty="EASY",
        description="At Medi-Caps University, campus pass numbers are issued as alphanumeric strings. Two passes are considered a 'mirror pair' if one string is the exact reverse of the other (e.g. 'AB' and 'BA'). Given a list of N pass strings, determine the total count of valid unordered mirror pairs (i < j where passes[i] is the reverse of passes[j]).",
        input_format="The first line contains an integer N (1 ≤ N ≤ 10^5), representing the number of passes.\nThe next N lines each contain a single uppercase alphanumeric string.",
        output_format="Print a single integer representing the number of valid mirror pairs.",
        constraints="1 ≤ N ≤ 10^5\n1 ≤ length(string) ≤ 20\nAll characters are uppercase ASCII letters and digits.",
        points=100,
        time_limit=2.0,
        memory_limit=256,
        starter_codes=PROB_A_STARTER,
        sample_testcases=[
            {
                "stdin": "4\nAB\nBA\nCD\nDC", "input": "4\nAB\nBA\nCD\nDC",
                "expected_output": "2", "output": "2",
                "explanation": "(AB, BA) and (CD, DC) form 2 mirror pairs."
            },
            {
                "stdin": "3\nXYZ\nZYX\nABC", "input": "3\nXYZ\nZYX\nABC",
                "expected_output": "1", "output": "1",
                "explanation": "(XYZ, ZYX) forms 1 mirror pair."
            }
        ],
        hidden_testcases=[
            {"stdin": "2\nRACECAR\nRACECAR", "input": "2\nRACECAR\nRACECAR", "expected_output": "1", "output": "1"},
            {"stdin": "5\nAAA\nAAA\nAAA\nBBB\nCCC", "input": "5\nAAA\nAAA\nAAA\nBBB\nCCC", "expected_output": "3", "output": "3"},
            {"stdin": "6\nHELLO\nOLLEH\nWORLD\nDLROW\nTEST\nTSET", "input": "6\nHELLO\nOLLEH\nWORLD\nDLROW\nTEST\nTSET", "expected_output": "3", "output": "3"},
            {"stdin": "1\nSOLO", "input": "1\nSOLO", "expected_output": "0", "output": "0"}
        ],
        created_at=now,
    )

    prob_b = AssessmentProblem(
        assessment_id=assessment.id,
        problem_index="B",
        title="Subnet Bandwidth Allocation",
        difficulty="MEDIUM",
        description="The Medi-Caps lab router has M megabits of total bandwidth to distribute among K competing lab processes. Process i requires at least min_i bandwidth and can consume at most max_i bandwidth, yielding utility = allocated_bandwidth * priority_i. Find the maximum total utility achievable such that the sum of allocated bandwidth does not exceed M and every process receives at least its minimum requirement. If the total minimum requirements exceed M, output -1.",
        input_format="The first line contains two integers K and M (1 ≤ K ≤ 10^4, 1 ≤ M ≤ 10^6).\nThe next K lines each contain three integers: min_i, max_i, and priority_i (1 ≤ min_i ≤ max_i ≤ 10^4, 1 ≤ priority_i ≤ 1000).",
        output_format="Print the maximum total utility as an integer, or -1 if the minimum requirements cannot be satisfied.",
        constraints="1 ≤ K ≤ 10^4\n1 ≤ M ≤ 10^6\n1 ≤ min_i ≤ max_i ≤ 10^4\n1 ≤ priority_i ≤ 1000",
        points=150,
        time_limit=2.0,
        memory_limit=256,
        starter_codes=PROB_B_STARTER,
        sample_testcases=[
            {
                "stdin": "2 10\n2 5 10\n3 6 20", "input": "2 10\n2 5 10\n3 6 20",
                "expected_output": "160", "output": "160",
                "explanation": "Allocate 2 to p1 and 6 to p2 = 8, leftover 2 to p1 = 4 total, utility 4*10 + 6*20 = 160."
            },
            {
                "stdin": "2 4\n3 5 10\n2 4 20", "input": "2 4\n3 5 10\n2 4 20",
                "expected_output": "-1", "output": "-1",
                "explanation": "Minimum requirements sum to 3 + 2 = 5, which exceeds total bandwidth 4."
            }
        ],
        hidden_testcases=[
            {"stdin": "3 15\n1 4 5\n2 6 15\n3 7 10", "input": "3 15\n1 4 5\n2 6 15\n3 7 10", "expected_output": "170", "output": "170"},
            {"stdin": "1 10\n5 12 8", "input": "1 10\n5 12 8", "expected_output": "80", "output": "80"},
            {"stdin": "2 10\n6 8 5\n5 9 10", "input": "2 10\n6 8 5\n5 9 10", "expected_output": "-1", "output": "-1"}
        ],
        created_at=now,
    )

    prob_c = AssessmentProblem(
        assessment_id=assessment.id,
        problem_index="C",
        title="Air-Gapped Relay Optimization",
        difficulty="HARD",
        description="An air-gapped lab network consists of N workstations numbered 1 to N and M bidirectional communication channels. Each channel connects workstation u and v with latency L (in milliseconds). Workstation 1 needs to transmit an encrypted cryptographic key to workstation N. To avoid packet interception, you may deploy at most K quantum booster repeaters at chosen intermediate workstations along the path. A repeater reduces the latency of its adjacent outgoing channel by half (floor division). Find the minimum total transmission latency from workstation 1 to workstation N.",
        input_format="The first line contains three integers N, M, K (2 ≤ N ≤ 1000, 1 ≤ M ≤ 5000, 0 ≤ K ≤ 10).\nThe next M lines each contain three integers u, v, L (1 ≤ u, v ≤ N, u ≠ v, 1 ≤ L ≤ 10^5).",
        output_format="Print a single integer representing the minimum latency from 1 to N, or -1 if workstation N is unreachable.",
        constraints="2 ≤ N ≤ 1000\n1 ≤ M ≤ 5000\n0 ≤ K ≤ 10\n1 ≤ L ≤ 10^5",
        points=250,
        time_limit=2.0,
        memory_limit=256,
        starter_codes=PROB_C_STARTER,
        sample_testcases=[
            {
                "stdin": "4 4 1\n1 2 10\n2 4 20\n1 3 15\n3 4 15", "input": "4 4 1\n1 2 10\n2 4 20\n1 3 15\n3 4 15",
                "expected_output": "20", "output": "20",
                "explanation": "Path 1 -> 2 -> 4 has latency 10 + 20 = 30. Applying 1 repeater to edge (2,4) reduces 20 to 10. Total latency = 10 + 10 = 20."
            },
            {
                "stdin": "3 1 1\n1 2 10", "input": "3 1 1\n1 2 10",
                "expected_output": "-1", "output": "-1",
                "explanation": "Workstation 3 is unreachable."
            }
        ],
        hidden_testcases=[
            {"stdin": "3 3 0\n1 2 5\n2 3 5\n1 3 12", "input": "3 3 0\n1 2 5\n2 3 5\n1 3 12", "expected_output": "10", "output": "10"},
            {"stdin": "5 6 2\n1 2 100\n2 3 100\n3 5 100\n1 4 40\n4 5 100\n2 5 200", "input": "5 6 2\n1 2 100\n2 3 100\n3 5 100\n1 4 40\n4 5 100\n2 5 200", "expected_output": "70", "output": "70"}
        ],
        created_at=now,
    )

    db.add_all([prob_a, prob_b, prob_c])
    await db.commit()

    logger.info("Successfully seeded demo contest '%s' with 3 problems in database.", CONTEST_SLUG)
