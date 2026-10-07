# CCC Medi-Caps — Judge Execution Model & Content-Addressed Compilation Architecture

> **Architecture Standard**: One-Compile-Per-Submission, Content-Addressed Compilation Caching, Strict Sandboxed Isolation, Attempt-Based Leases, and Compare-And-Swap (CAS) Result Fencing.

---

## 1. Execution Router & Sandbox Safety Decision Tree

```
                        Contestant Code
                               │
                               ▼
                        ExecutionRouter
                               │
                ┌──────────────┴──────────────┐
                │ Is this execution host      │
                │ sandbox-safe for untrusted  │
                │ code?                       │
                └──────────────┬──────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
          YES (Local Dev /              NO (Cloud Run /
          Validated MicroVM)            Untrusted Host)
                │                             │
                ▼                             ▼
        Local Docker Pool /             Go Node-Agent
        Validated Sandbox               (Docker Sandbox)
                │                             │
                └──────────────┬──────────────┘
                               │
                               ▼
                          Judge Result
                               │
                               ▼
                         PostgreSQL CAS
                               │
                               ▼
                          Scoreboard
```

### Safety Policy Enforcement:
- If the backend is running in Cloud Run, `ALLOW_UNSANDBOXED_EXECUTION` is strictly `False`.
- The `ExecutionRouter` detects that the local environment cannot safely isolate untrusted code and directs all jobs to registered, healthy Go node-agents running Docker sandboxes.
- If no node-agents are online, the job is queued in Redis (`ccc:queue:fabric:pending`) with backpressure rather than compromising host security.

---

## 2. Compilation Architecture & Language Registry

### 2.1 The One-Compile-Per-Submission Guarantee
For compiled languages (C, C++, Rust, Go, Java):
- The code is compiled **EXACTLY ONCE** into a binary execution artifact.
- The compiled artifact is then sequentially or concurrently mounted into clean, read-only containers to evaluate Testcases 1 through $N$.
- **NEVER compile once per testcase**.

### 2.2 Compilation Classification
- **Interpreted** (`Python`, `JavaScript` / Node.js):
  - No separate compilation phase.
  - Direct execution against testcase inputs with timeout fencing.
- **Compiled Native** (`C`, `C++`, `Rust`, `Go`):
  - Compile step produces standalone binary executable.
  - Execution runs native binary with non-root UID.
- **JVM Bytecode** (`Java`):
  - Compiled using `javac` into isolated sandbox workspace directory.
  - Executed using `java -Xmx256m -Xss16m -XX:+UseSerialGC` with strict classpath fencing.

---

## 3. Content-Addressed Compilation Cache

To prevent redundant compilation across submissions with identical logic or repeated benchmark runs:

$$\text{Cache Key} = \text{SHA256}(\text{source} \parallel \text{language} \parallel \text{toolchain\_version} \parallel \text{compiler\_flags} \parallel \text{arch} \parallel \text{os} \parallel \text{sandbox\_profile})$$

- **Atomic Publication**: Artifacts are compiled to temporary paths and atomically moved into `artifacts/<cache_key>.bin`.
- **Concurrency Deduplication**: If multiple concurrent requests arrive with the same source hash, a SingleFlight lock ensures only one compile process executes; waiting threads reuse the generated artifact.
- **Traversal Protection**: Cache keys are strict 64-character hexadecimal digests, eliminating path traversal risks.

---

## 4. Lease System & PostgreSQL CAS Result Fencing

```
[ JudgeJob Created ] (State: QUEUED, attempt_number: 0)
         │
         ▼
[ Attempt 1 Created ] (State: STARTED, attempt_id: A1, lease_id: L1, TTL: 60s)
         │
         ├── Node crashes or network disconnects
         ▼
[ Lease L1 Expires in Redis ]
         │
         ▼
[ Reconciliation Worker Detects Stale Attempt ]
         │
         ▼
[ Attempt 2 Created ] (State: STARTED, attempt_id: A2, lease_id: L2)
         │
         ▼
[ Attempt 2 Completes First ] -> Finalizes in PostgreSQL CAS (active_attempt_id == A2)
         │
         ▼
[ Stale Attempt 1 Result Arrives Late ] -> CAS Fails: REJECTED (lease_id L1 != active_lease)
```

### Telemetry Separation Invariant:
The telemetry payload maintains strict measurement boundaries with zero synthetic derivations:
- `compile_time_ms`: Actual wall time of compiler invocation.
- `execution_cpu_ms`: Sum of CPU user + system runtime measured by cgroups across testcases.
- `execution_wall_ms`: Elapsed wall time of sandbox execution.
- `provider_turnaround_ms`: Total latency from provider dispatch to result receipt.
- `result_normalization_ms`: Time taken to validate testcase diffs and calculate verdicts.
- `cas_finalize_ms`: Duration of the PostgreSQL write transaction.
- `total_submission_latency_ms`: Total end-to-end time from HTTP request receipt to response emission.
