"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Database Seed Service: Populates official LeetCode-style CCC contests,
attached Phase 1 online screening assessments, and Phase 2 live arena problems.
Strictly into the database (zero static data).
"""

from datetime import datetime, timezone, timedelta
import logging
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import (
    OfflineContest,
    ContestProblem,
    Assessment,
    AssessmentProblem,
    AssessmentSession,
    ScoreboardEntry,
    ContestRegistration,
    MemberProfile,
    now_utc,
)

logger = logging.getLogger(__name__)

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
        cout << countMirrorPairs(passes) << "\\n";
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
    
    current_used = min_sum
    total_utility = sum(p[0] * p[2] for p in processes)
    surplus_capacity = m - min_sum

    expandable = []
    for min_val, max_val, priority in processes:
        diff = max_val - min_val
        if diff > 0:
            expandable.append((priority, diff))
    
    expandable.sort(key=lambda x: x[0], reverse=True)

    for priority, diff in expandable:
        if surplus_capacity <= 0:
            break
        alloc = min(diff, surplus_capacity)
        total_utility += alloc * priority
        surplus_capacity -= alloc

    return total_utility

def main():
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    k = int(input_data[0])
    m = int(input_data[1])
    processes = []
    idx = 2
    for _ in range(k):
        min_val = int(input_data[idx])
        max_val = int(input_data[idx+1])
        prio = int(input_data[idx+2])
        processes.append((min_val, max_val, prio))
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
    if (cin >> k >> m) {
        vector<Process> procs(k);
        long long min_sum = 0;
        long long utility = 0;
        for (int i = 0; i < k; i++) {
            cin >> procs[i].min_val >> procs[i].max_val >> procs[i].priority;
            min_sum += procs[i].min_val;
            utility += procs[i].min_val * procs[i].priority;
        }

        if (min_sum > m) {
            cout << -1 << "\\n";
            return 0;
        }

        long long surplus = m - min_sum;
        vector<pair<long long, long long>> exp_list;
        for (const auto& p : procs) {
            long long diff = p.max_val - p.min_val;
            if (diff > 0) exp_list.push_back({p.priority, diff});
        }

        sort(exp_list.rbegin(), exp_list.rend());

        for (const auto& item : exp_list) {
            if (surplus <= 0) break;
            long long alloc = min(item.second, surplus);
            utility += alloc * item.first;
            surplus -= alloc;
        }

        cout << utility << "\\n";
    }
    return 0;
}
""",
    "javascript": """const fs = require('fs');

function main() {
    const tokens = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
    if (!tokens || tokens.length === 0 || tokens[0] === "") return;

    const k = parseInt(tokens[0], 10);
    const m = parseInt(tokens[1], 10);

    let min_sum = 0;
    let utility = 0;
    const procs = [];

    let idx = 2;
    for (let i = 0; i < k; i++) {
        const min_val = parseInt(tokens[idx++], 10);
        const max_val = parseInt(tokens[idx++], 10);
        const prio = parseInt(tokens[idx++], 10);
        procs.push({ min_val, max_val, prio });
        min_sum += min_val;
        utility += min_val * prio;
    }

    if (min_sum > m) {
        console.log(-1);
        return;
    }

    let surplus = m - min_sum;
    const exp_list = [];
    for (const p of procs) {
        const diff = p.max_val - p.min_val;
        if (diff > 0) exp_list.push({ prio: p.prio, diff });
    }

    exp_list.sort((a, b) => b.prio - a.prio);

    for (const item of exp_list) {
        if (surplus <= 0) break;
        const alloc = Math.min(item.diff, surplus);
        utility += alloc * item.prio;
        surplus -= alloc;
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
    adj = [[] for _ in range(n + 1)]
    for u, v, w in edges:
        adj[u].append((v, w))
        adj[v].append((u, w))
    
    INF = float('inf')
    dist = [[INF] * (k + 1) for _ in range(n + 1)]
    dist[1][0] = 0
    pq = [(0, 1, 0)]  # (cost, node, boosters_used)

    while pq:
        cost, u, used = heapq.heappop(pq)

        if cost > dist[u][used]:
            continue
        if u == n:
            return cost

        for v, w in adj[u]:
            # Standard transition
            if cost + w < dist[v][used]:
                dist[v][used] = cost + w
                heapq.heappush(pq, (cost + w, v, used))
            # Booster transition
            if used < k:
                b_cost = cost + (w // 2)
                if b_cost < dist[v][used + 1]:
                    dist[v][used + 1] = b_cost
                    heapq.heappush(pq, (b_cost, v, used + 1))

    ans = min(dist[n])
    return -1 if ans == INF else ans

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
            cout << cost << "\\n";
            return 0;
        }

        for (auto [v, w] : adj[u]) {
            if (cost + w < dist[v][used]) {
                dist[v][used] = cost + w;
                pq.push({cost + w, v, used});
            }
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
    cout << (ans == INF ? -1 : ans) << "\\n";
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

    const dist = Array.from({ length: n + 1 }, () => Array(k + 1).fill(Infinity));
    dist[1][0] = 0;

    const queue = [[0, 1, 0]];

    while (queue.length > 0) {
        queue.sort((a, b) => a[0] - b[0]);
        const [cost, u, used] = queue.shift();

        if (cost > dist[u][used]) continue;
        if (u == n) {
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


async def seed_initial_data(db: AsyncSession):
    """Seed authentic LeetCode-style CCC contests, screening assessments, and arena problems."""
    now = datetime.now(timezone.utc)

    # 1. Clean up any obsolete/dummy dev contest records
    await db.execute(delete(OfflineContest).where(OfflineContest.slug.in_(["dev-assessment-round", "dev-offline-final"])))
    await db.commit()

    # 2. Seed Contest 1: CCC Medi-Caps Weekly Contest 42 (Hero Weekly Contest)
    slug_w42 = "ccc-weekly-42"
    starts_w42 = now + timedelta(days=2, hours=4)
    ends_w42 = starts_w42 + timedelta(hours=2)

    res_w42 = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug_w42))
    c_w42 = res_w42.scalars().first()

    if not c_w42:
        c_w42 = OfflineContest(
            slug=slug_w42,
            title="CCC Medi-Caps Weekly Contest 42",
            season="Fall 2026",
            status="upcoming",
            division="open",
            cadence="weekly",
            edition=42,
            starts_at=starts_w42,
            ends_at=ends_w42,
            check_in_opens_at=now - timedelta(hours=12),
            venue="Computer Science Building · Lab 04 & Online Sandbox",
            seat_capacity=150,
            registered_count=64,
            problem_count=4,
            environment="Ubuntu 24.04 LTS · GCC 14.2 / Python 3.12 / Node 20",
            chief_proctors=["Dr. Ratnesh Litoriya", "Prof. Amit Shrivastava"],
            prize_pool="₹15,000 + Top 30 Campus Finalist Passes",
            sponsor="Chaos Computer Club Medi-Caps Chapter",
            summary="Official weekly competitive programming round. 4 algorithmic challenges testing dynamic programming, graph invariants, and string processing. Phase 1 Online Screening is currently live for registered candidates; Top 30 qualify for on-premise air-gapped laboratory finals.",
            rules=[
                "Single contestant, 2 hours, 4 problems scored by difficulty.",
                "Phase 1 Online Screening: 90-minute screening assessment to earn one of 30 lab seats.",
                "Phase 2 Physical Lab Arena: Faculty proctored, air-gapped LAN workstations.",
                "Cheating or tab switching during assessment triggers immediate disqualification."
            ],
            created_at=now,
        )
        db.add(c_w42)
        await db.flush()

        # Phase 2 Arena Problems
        db.add_all([
            ContestProblem(
                contest_id=c_w42.id, problem_index="A", title="Campus Pass Hash Collision", topic="Hash Tables & String Processing",
                points=100, difficulty="EASY", description="Determine mirror pairs in campus pass strings.",
                time_limit=2.0, memory_limit=256, starter_codes=PROB_A_STARTER, solved_count=18,
                editorial_summary="Maintain frequency counts of encountered strings and pair with reversed keys."
            ),
            ContestProblem(
                contest_id=c_w42.id, problem_index="B", title="Subnet Bandwidth Allocation", topic="Greedy & Resource Scheduling",
                points=150, difficulty="MEDIUM", description="Maximize priority utility across competing bandwidth processes.",
                time_limit=2.0, memory_limit=256, starter_codes=PROB_B_STARTER, solved_count=9,
                editorial_summary="Satisfy minimum requirements first, then greedily allocate surplus by priority."
            ),
            ContestProblem(
                contest_id=c_w42.id, problem_index="C", title="Air-Gapped Relay Optimization", topic="Modified Dijkstra & State Graphs",
                points=250, difficulty="HARD", description="Find minimum transmission latency using K quantum booster repeaters.",
                time_limit=2.0, memory_limit=256, starter_codes=PROB_C_STARTER, solved_count=3,
                editorial_summary="Multi-layer shortest path algorithm tracking state (node, repeaters_used)."
            ),
            ContestProblem(
                contest_id=c_w42.id, problem_index="D", title="Cryptographic Ledger Fault Invariant", topic="Segment Trees & Monotonic Invariants",
                points=300, difficulty="HARD", description="Detect Byzantine faults across air-gapped node consensus records.",
                time_limit=2.0, memory_limit=256, starter_codes=PROB_C_STARTER, solved_count=1,
                editorial_summary="Maintain dynamic segment tree over rolling hash prefix sums."
            ),
        ])

        # Phase 1 Online Screening Assessment (attached to Weekly 42)
        assess_w42 = Assessment(
            contest_id=c_w42.id,
            slug=slug_w42,
            title="Phase 1 Screening Assessment: Weekly Contest 42",
            summary="90-minute online screening assessment. Test your code against sample and hidden testcases across Python, C++, and JavaScript. Top 30 earn physical laboratory seats for the final arena.",
            duration_minutes=90,
            starts_at=now - timedelta(hours=6),
            ends_at=starts_w42,
            is_active=True,
            max_violations=3,
            created_at=now,
        )
        db.add(assess_w42)
        await db.flush()

        db.add_all([
            AssessmentProblem(
                assessment_id=assess_w42.id, problem_index="A", title="Campus Pass Hash Collision", difficulty="EASY",
                description="At Medi-Caps University, campus pass numbers are issued as alphanumeric strings. Two passes are considered a 'mirror pair' if one string is the exact reverse of the other (e.g. 'AB' and 'BA'). Given a list of N pass strings, determine the total count of valid unordered mirror pairs.",
                input_format="First line: integer N (1 ≤ N ≤ 10^5). Next N lines: uppercase alphanumeric string.",
                output_format="Print a single integer representing the number of valid mirror pairs.",
                constraints="1 ≤ N ≤ 10^5, string length ≤ 20.", points=100, time_limit=2.0, memory_limit=256,
                starter_codes=PROB_A_STARTER,
                sample_testcases=[{"stdin": "4\nAB\nBA\nCD\nDC", "expected_output": "2", "explanation": "(AB, BA) and (CD, DC) form 2 mirror pairs."}],
                hidden_testcases=[{"stdin": "2\nRACECAR\nRACECAR", "expected_output": "1"}],
                created_at=now,
            ),
            AssessmentProblem(
                assessment_id=assess_w42.id, problem_index="B", title="Subnet Bandwidth Allocation", difficulty="MEDIUM",
                description="The Medi-Caps lab router has M megabits of total bandwidth to distribute among K competing lab processes. Process i requires at least min_i bandwidth and can consume at most max_i bandwidth, yielding utility = allocated_bandwidth * priority_i. Find the maximum total utility achievable.",
                input_format="First line: integers K and M. Next K lines: min_i, max_i, priority_i.",
                output_format="Print maximum utility as an integer, or -1 if impossible.",
                constraints="1 ≤ K ≤ 10^4, 1 ≤ M ≤ 10^6.", points=150, time_limit=2.0, memory_limit=256,
                starter_codes=PROB_B_STARTER,
                sample_testcases=[{"stdin": "2 10\n2 5 10\n3 6 20", "expected_output": "160", "explanation": "Utility = 160."}],
                hidden_testcases=[{"stdin": "1 10\n5 12 8", "expected_output": "80"}],
                created_at=now,
            ),
            AssessmentProblem(
                assessment_id=assess_w42.id, problem_index="C", title="Air-Gapped Relay Optimization", difficulty="HARD",
                description="An air-gapped lab network consists of N workstations and M bidirectional communication channels with latency L. Workstation 1 needs to transmit an encrypted cryptographic key to workstation N using at most K quantum booster repeaters. Find the minimum total transmission latency.",
                input_format="First line: N, M, K. Next M lines: u, v, L.",
                output_format="Print minimum latency, or -1 if unreachable.",
                constraints="2 ≤ N ≤ 1000, 1 ≤ M ≤ 5000, 0 ≤ K ≤ 10.", points=250, time_limit=2.0, memory_limit=256,
                starter_codes=PROB_C_STARTER,
                sample_testcases=[{"stdin": "4 4 1\n1 2 10\n2 4 20\n1 3 15\n3 4 15", "expected_output": "20", "explanation": "Path latency = 20."}],
                hidden_testcases=[{"stdin": "3 3 0\n1 2 5\n2 3 5\n1 3 12", "expected_output": "10"}],
                created_at=now,
            )
        ])

    # 3. Seed Contest 2: CCC Medi-Caps Biweekly Contest 18 (Hero Biweekly Contest)
    slug_b18 = "ccc-biweekly-18"
    starts_b18 = now + timedelta(days=5, hours=2)
    ends_b18 = starts_b18 + timedelta(hours=2)

    res_b18 = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug_b18))
    c_b18 = res_b18.scalars().first()

    if not c_b18:
        c_b18 = OfflineContest(
            slug=slug_b18,
            title="CCC Medi-Caps Biweekly Contest 18",
            season="Fall 2026",
            status="upcoming",
            division="open",
            cadence="biweekly",
            edition=18,
            starts_at=starts_b18,
            ends_at=ends_b18,
            check_in_opens_at=starts_b18 - timedelta(hours=24),
            venue="IT Block · Server Room Terminal Lab",
            seat_capacity=150,
            registered_count=42,
            problem_count=4,
            environment="Ubuntu 24.04 LTS · GCC 14.2 / Python 3.12 / Node 20",
            chief_proctors=["Prof. Amit Shrivastava", "Er. Pranay Joshi"],
            prize_pool="₹15,000 + Merit Certificates",
            sponsor="Chaos Computer Club Medi-Caps Chapter",
            summary="Bi-weekly tournament featuring 4 algorithm design challenges. Screening assessment opens exactly 24 hours prior to the contest start. Top 30 qualifiers receive hardware admission badges.",
            rules=[
                "Contest window: 2 hours strictly timed.",
                "Assessment screening unlocks 24 hours before live contest start.",
                "Final 30 seats reserved for verified assessment performers."
            ],
            created_at=now,
        )
        db.add(c_b18)
        await db.flush()

        # Attached assessment
        assess_b18 = Assessment(
            contest_id=c_b18.id,
            slug=slug_b18,
            title="Phase 1 Screening Assessment: Biweekly Contest 18",
            summary="Online screening assessment for Biweekly Contest 18. Unlocks 24 hours before the competition.",
            duration_minutes=90,
            starts_at=starts_b18 - timedelta(hours=24),
            ends_at=starts_b18,
            is_active=True,
            max_violations=3,
            created_at=now,
        )
        db.add(assess_b18)

    # 4. Seed Contest 3: Campus Clash 2026 (Flagship Special Tournament)
    slug_clash = "medicaps-campus-clash-2026"
    starts_clash = now + timedelta(days=12)
    ends_clash = starts_clash + timedelta(hours=3)

    res_clash = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug_clash))
    c_clash = res_clash.scalars().first()

    if not c_clash:
        c_clash = OfflineContest(
            slug=slug_clash,
            title="CCC Medi-Caps Campus Clash 2026 (Monsoon Championship)",
            season="Monsoon 2026",
            status="upcoming",
            division="open",
            cadence="special",
            edition=2026,
            starts_at=starts_clash,
            ends_at=ends_clash,
            check_in_opens_at=starts_clash - timedelta(hours=24),
            venue="Main University Auditorium · 200 Air-Gapped Workstations",
            seat_capacity=200,
            registered_count=128,
            problem_count=5,
            environment="Air-Gapped Linux Workstations · Offline Compilers",
            chief_proctors=["Dr. Ratnesh Litoriya", "Dean of Academic Affairs"],
            prize_pool="₹50,000 + Trophy + Institutional Letter of Commendation",
            sponsor="Medi-Caps University & Chaos Computer Club India",
            summary="The flagship annual inter-department championship. 2-phase tournament: Online screening round followed by physical air-gapped lab showdown for the Top 30 contenders across CSE, IT, AIDS, and Cyber Security.",
            rules=[
                "Phase 1: Online Screening Assessment (2 hours) to qualify for Top 30 finalist slots.",
                "Phase 2: Physical air-gapped laboratory showdown with faculty invigilators.",
                "Hardware entry pass with cryptographic QR code required for lab admission."
            ],
            created_at=now,
        )
        db.add(c_clash)

    # 5. Seed Past Finished Contests (Weekly 41, Weekly 40, Biweekly 17)
    past_contests = [
        ("ccc-weekly-41", "CCC Medi-Caps Weekly Contest 41", "weekly", 41, 5, 86),
        ("ccc-weekly-40", "CCC Medi-Caps Weekly Contest 40", "weekly", 40, 12, 92),
        ("ccc-biweekly-17", "CCC Medi-Caps Biweekly Contest 17", "biweekly", 17, 19, 74),
    ]

    for p_slug, p_title, p_cadence, p_edition, days_ago, part_count in past_contests:
        res_p = await db.execute(select(OfflineContest).where(OfflineContest.slug == p_slug))
        if not res_p.scalars().first():
            p_starts = now - timedelta(days=days_ago)
            p_ends = p_starts + timedelta(hours=2)
            c_past = OfflineContest(
                slug=p_slug,
                title=p_title,
                season="Fall 2026",
                status="finished",
                division="open",
                cadence=p_cadence,
                edition=p_edition,
                starts_at=p_starts,
                ends_at=p_ends,
                check_in_opens_at=p_starts - timedelta(hours=1),
                venue="Computer Science Lab 04",
                seat_capacity=100,
                registered_count=part_count,
                problem_count=4,
                environment="Ubuntu 24.04 LTS · GCC 14.2 / Python 3.12 / Node 20",
                chief_proctors=["Dr. Ratnesh Litoriya"],
                prize_pool="₹10,000",
                sponsor="Chaos Computer Club",
                summary=f"Official completed {p_cadence} contest #{p_edition}. All problems, solutions, verified scoreboards, and editorials are publicly released.",
                rules=["Completed room. Read-only archive and official rankings."],
                created_at=now - timedelta(days=days_ago + 7),
            )
            db.add(c_past)
            await db.flush()

            # Seed past problems
            db.add_all([
                ContestProblem(
                    contest_id=c_past.id, problem_index="A", title="Network Routing Invariant", topic="Graph Theory",
                    points=100, difficulty="EASY", solved_count=int(part_count * 0.8),
                    editorial_summary="Standard BFS traversal on undirected graph."
                ),
                ContestProblem(
                    contest_id=c_past.id, problem_index="B", title="Cache Eviction Policy", topic="Data Structures",
                    points=150, difficulty="MEDIUM", solved_count=int(part_count * 0.45),
                    editorial_summary="Implement LRU cache with doubly linked list and hash map."
                ),
                ContestProblem(
                    contest_id=c_past.id, problem_index="C", title="Matrix Diagonal Traversal", topic="Dynamic Programming",
                    points=200, difficulty="MEDIUM", solved_count=int(part_count * 0.25),
                    editorial_summary="2D DP state tracking diagonal constraints."
                ),
                ContestProblem(
                    contest_id=c_past.id, problem_index="D", title="Air-Gapped Tree Diameter", topic="Trees & Divide and Conquer",
                    points=300, difficulty="HARD", solved_count=int(part_count * 0.08),
                    editorial_summary="Two-pass DFS or tree DP to compute max path between leaves."
                ),
            ])

            # Seed sample scoreboard top 5
            top_contestants = [
                ("priya_sharma", "Priya Sharma", "CSE", "2023-27", 750, 4, 1840, 48),
                ("rohit_verma", "Rohit Verma", "IT", "2022-26", 650, 3, 2100, 36),
                ("ananya_jain", "Ananya Jain", "AIDS", "2023-27", 650, 3, 2350, 29),
                ("dev_kapoor", "Dev Kapoor", "Cyber Security", "2024-28", 450, 2, 1420, 15),
                ("siddharth_m", "Siddharth Mehta", "CSE", "2022-26", 450, 2, 1680, 12),
            ]
            for r_idx, (h, fn, dept, btch, sc, slv, pen, dlt) in enumerate(top_contestants, 1):
                db.add(ScoreboardEntry(
                    contest_id=c_past.id, rank=r_idx, handle=h, full_name=fn, department=dept,
                    batch=btch, division="open", score=sc, solved=slv, penalty_seconds=pen,
                    rating_delta=dlt, telemetry=[]
                ))

    await db.commit()
    logger.info("Successfully seeded authentic LeetCode-style CCC contests with attached screening assessments.")


# Backwards-compatible alias
seed_database = seed_initial_data
