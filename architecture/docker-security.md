# Docker Sandboxing & Host Isolation Security Specification
## Chaos Computer Club Medi-Caps Chapter — Dynamic Application & Compute Fabric

---

### 1. Threat Model & Security Posture

Student code submitted to the contest arena is treated as **hostile, untrusted code execution**. The execution environment must withstand:
1. Fork bombs and process exhaustion.
2. Kernel exploits and privilege escalation.
3. Network scanning and egress attempts (SSRF, LAN pivoting).
4. Filesystem tampering and host data exfiltration.
5. Disk write exhaustion (wear on portable USB drives).
6. Timing attacks and hidden testcase extraction.

---

### 2. Docker Sandbox Security Matrix

Every codebox container is launched with an impenetrable configuration envelope:

```bash
docker run --rm -i \
  --network none \
  --cpus 1.0 \
  --memory 512m \
  --memory-swap 512m \
  --pids-limit 64 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --user 1000:1000 \
  -v /tmp/ccc_workspaces/sub_<job_id>:/workspace:ro \
  -w /workspace \
  --tmpfs /tmp:size=128m,noexec,nosuid \
  <language_image> \
  <run_command>
```

| Security Control | Flag / Parameter | Threat Mitigated |
|---|---|---|
| **Network Isolation** | `--network none` | Disables all egress; prevents SSRF, LAN scans, external API calls |
| **CPU Quota** | `--cpus 1.0` | Prevents CPU starvation of host and sibling workers |
| **RAM & Swap Bound** | `--memory 512m --memory-swap 512m` | Prevents OOM kills of host OS; blocks swap thrashing |
| **PID Limit** | `--pids-limit 64` | Immune to fork bombs (`:(){ :|:& };:`) |
| **Capability Stripping**| `--cap-drop ALL` | Drops all Linux capabilities (`CAP_NET_RAW`, `CAP_SYS_ADMIN`, etc.) |
| **Privilege Escalation**| `--security-opt no-new-privileges` | Blocks setuid/setgid binaries from acquiring elevated credentials |
| **Non-Root Execution** | `--user 1000:1000` | Code executes as unprivileged user inside container |
| **RAM tmpfs Workspace**| `-v /tmp/ccc_workspaces/...` | Execution occurs in host RAM tmpfs; zero writes to USB drive |
| **Ephemeral Container**| `--rm` | Container destroyed immediately upon process exit |

---

### 3. RAM-First Workspace Lifecycle

1. **Mount**: The Go agent creates `/tmp/ccc_workspaces` backed by Linux `tmpfs` (RAM).
2. **Isolation**: Each job receives a subfolder `sub_<job_id>` with permissions `0777`.
3. **Execution**: Source code is written, compiled, and executed entirely in RAM.
4. **Cleanup**: Upon job completion, `os.RemoveAll(subPath)` runs immediately in a deferred block.
5. **Flash Wear Protection**: Prevents repeated 4KB writes from degrading USB 3.0 flash drives.

---

### 4. Compile-Once & Early Termination

1. **Compile Once**:
   For compiled runtimes (C, C++, Java, Go), compilation occurs once in a compilation container (`gcc:13`, `openjdk:17-slim`, `golang:1.22`). The compiled binary is verified and stored in the RAM workspace.
2. **Sequential Testcase Run**:
   Individual testcases execute against the precompiled binary.
3. **Early Termination**:
   If a testcase fails (`WRONG_ANSWER`, `TIME_LIMIT`, `MEMORY_LIMIT`, `RUNTIME_ERROR`) and contest rules specify stop-on-first-fail, subsequent testcase runs are aborted immediately, freeing the execution slot in milliseconds.

---

### 5. Strict Error Classification Matrix

Infrastructure anomalies must **never** be attributed as student mistakes:

| Internal Event | Student Verdict | Internal Log Code | Retryable? |
|---|---|---|---|
| Binary output matches expected stdout | `ACCEPTED` | `VERDICT_AC` | No |
| Output mismatch | `WRONG_ANSWER` | `VERDICT_WA` | No |
| Execution wall time exceeds limit | `TIME_LIMIT_EXCEEDED` | `VERDICT_TLE` | No |
| Process killed by OOM killer | `MEMORY_LIMIT_EXCEEDED` | `VERDICT_MLE` | No |
| Non-zero exit code / segfault | `RUNTIME_ERROR` | `VERDICT_RTE` | No |
| Compiler exited non-zero | `COMPILATION_ERROR` | `VERDICT_CE` | No |
| Stdout exceeded max buffer (1 MB) | `OUTPUT_LIMIT_EXCEEDED` | `VERDICT_OLE` | No |
| Docker daemon unresponsive | `SYSTEM_ERROR` | `INFRA_DOCKER_CRASH`| Yes (Re-queued to another node) |
| Node disconnects during execution | `NODE_FAILURE` | `INFRA_NODE_LOST` | Yes (Lease reclaimed by reaper) |
| Queue wait timeout exceeded | `QUEUE_TIMEOUT` | `INFRA_QUEUE_FULL` | Yes |
