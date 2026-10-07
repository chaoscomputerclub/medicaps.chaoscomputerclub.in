# Judge Peer Model & Execution Pipeline
## Compile-Once, Multi-Testcase Isolation & CAS Authority

---

### 1. Compile-Once Architectural Invariant

A critical anti-pattern in competitive programming engines is compiling the submission once per testcase. In our judge peer architecture:

```
[ Incoming Submission ]
          │
          ▼
┌─────────────────────────────────┐
│       1. COMPILE STAGE          │  ──► Compiled Artifact (ELF Binary / Bytecode)
└────────────────┬────────────────┘      Cached locally in /tmp/build_cache/{hash}
                 │
                 ▼
┌─────────────────────────────────┐
│     2. ISOLATED TESTCASES       │
└────────────────┬────────────────┘
                 ├──► Testcase 01 (Sandbox / rlimit 2MB / 1.0s)
                 ├──► Testcase 02 (Sandbox / rlimit 2MB / 1.0s)
                 └──► Testcase N  (Sandbox / rlimit 2MB / 1.0s)
```

1. **Compilation Step**: Executed exactly once. If compilation fails, the job immediately terminates with `COMPILATION_ERROR`. No testcases are run.
2. **Execution Step**: The pre-compiled binary is executed against testcase inputs inside isolated, unprivileged Linux sandbox processes with strict `setrlimit` bounds:
   - `RLIMIT_CPU`: Exact problem time limit + 1 second hard kill.
   - `RLIMIT_FSIZE`: 2 MB (prevents disk saturation).
   - `RLIMIT_NPROC`: 100 processes (prevents fork-bombs).
   - Non-root `sandbox` user execution.

---

### 2. Multi-Tier Compute Federation

Judge peers operate heterogeneously across cloud containers and physical machines:
- **Cloud Runner Peers** (Cloud Run / Koyeb / Render / Railway): Handle baseline continuous execution.
- **Dedicated Metal Peers** (Lab workstations, gaming PCs, laptops): Connect via outbound HTTPS/TLS claim channel to provide massive compute capacity during burst periods.
