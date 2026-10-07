# CCC Medi-Caps — Security Model & Cloud Isolation Feasibility Audit

> **Security Mandate**: Never sacrifice correctness, security, or isolation boundaries to distribute a workload.  
> **Key Principle**: Arbitrary untrusted code submitted by contestants MUST NEVER run unsandboxed on shared cloud infrastructure.

---

## 1. Google Cloud Run Container & Judge Isolation Feasibility Audit

A critical question in serverless cloud architectures:  
*"Can Google Cloud Run act as the direct execution host for untrusted contestant submissions?"*

### 1.1 Technical Evaluation of Cloud Run Capabilities
1. **Container Runtime**: Cloud Run executes containers using Google's **gVisor** user-space kernel sandbox (`runsc`).
2. **Nested Docker**: Cloud Run does **NOT** support nested Docker daemons. It is technically impossible to launch a secondary `docker run` inside standard Cloud Run containers without privileged access.
3. **Docker Socket Access**: There is **NO** `/var/run/docker.sock` available on Cloud Run.
4. **Privileged Mode**: Cloud Run does **NOT** grant `--privileged` containers or raw host capabilities (`CAP_SYS_ADMIN`, `CAP_NET_ADMIN`).
5. **Direct Unsandboxed Execution Risks**: If the platform enabled `ALLOW_UNSANDBOXED_EXECUTION=true` on Cloud Run to run submitted Python, C++, or Node.js code directly:
   - **Environment Variable Theft**: The untrusted code could inspect `/proc/self/environ` and extract `DATABASE_URL` (Supabase credentials), `SECRET_KEY`, `JWT_PRIVATE_KEY`, and `REDIS_PASSWORD`!
   - **Network Probing**: The untrusted code could make outbound network requests, port-scan internal cloud VPCs, or launch DDoS attacks using Google Cloud egress IP addresses.
   - **Resource Exhaustion**: Memory bombs (e.g. `malloc(10GB)`) and fork bombs would crash the Cloud Run instance, terminating active user API sessions and SSE streams.

### 1.2 Architectural Invariant & Verdict
> **VERDICT**: **Google Cloud Run is strictly for TRUSTED workloads (`ccc-api`, `ccc-worker`, `ccc-realtime`). It MUST NOT be used for arbitrary untrusted code execution without a validated microVM hypervisor.**  
> **Untrusted code execution is strictly assigned to Distributed Go Node-Agents running dedicated Docker sandboxes on isolated compute.**

---

## 2. Distributed Go Node Sandbox Architecture

Untrusted code runs on dedicated distributed compute workers running the CCC Go `node-agent`:

```
[ Contestant Code Submission ]
             │
             ▼
[ ExecutionRouter (Cloud Run) ]
             │ (Capability Check: sandbox-safe?)
             ▼
[ Go Node-Agent (Workstation / Lab PC / VPS) ]
             │
             ▼
┌────────────────────────────────────────────────────────┐
│ Docker Sandboxed Container                             │
│                                                        │
│ • User: unprivileged 'sandbox' (UID 1000, GID 1000)    │
│ • Network: --network none (strictly air-gapped)        │
│ • Memory: Hard cap 256MB / 512MB (--memory-swap=0)     │
│ • CPU: Bounded cgroups (--cpus=1.0)                    │
│ • PID Limit: --pids-limit=64 (fork-bomb immune)        │
│ • Filesystem: read-only rootfs; tmpfs for /tmp (32MB)  │
│ • Capabilities: --cap-drop=ALL (zero Linux caps)       │
│ • Security Opt: no-new-privileges:true                 │
│ • Docker Socket: NEVER MOUNTED into sandbox container  │
└────────────────────────────────────────────────────────┘
```

---

## 3. Web & API Security Controls

### 3.1 Authentication & Tokens
- **Asymmetric RS256 JWT**: Access tokens are signed using a 2048-bit RSA private key and verified with a public key.
- **Short-Lived Access Tokens**: Lifetime strictly 15 minutes in production.
- **Refresh Token Rotation**: 30-day refresh token stored in secure, HttpOnly, SameSite cookies.
- **Instant Logout**: Invalidates Redis session keys and closes active SSE streams.

### 3.2 Cloudflare Edge & Origin Shielding
- **Real IP Validation**: `CloudflareSecurityMiddleware` extracts trusted client IPs from `CF-Connecting-IP`.
- **Bot Defense**: Cloudflare Turnstile token verification on login, registration, and arena submission.
- **Security Headers**: HSTS (`max-age=31536000; includeSubDomains; preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
