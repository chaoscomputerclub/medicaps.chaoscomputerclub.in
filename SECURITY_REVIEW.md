# SECURITY REVIEW & GLOBAL ATTACK SURFACE SPECIFICATION

**Review Date:** November 4, 2026  
**Scope:** Transformation from Campus-Gated Portal to Globally Accessible Platform

---

## 1. Threat Modeling: Campus vs. Global Public Exposure

| Threat Vector | Campus-Gated Threat | Global Public Platform Threat | Defense Architecture |
|---|---|---|---|
| **Registration Flooding / Sybil Attacks** | Constrained by `@medicaps.ac.in` domain ownership | Unrestricted email providers (Gmail, Outlook, disposable emails) | Cloudflare Turnstile token validation + Redis Sliding-Window IP rate limits + Disposable Email Filter + Mandatory OTP email verification |
| **Sandbox Jailbreak & Abuse** | Student curiosities, small scale | Hostile automated scanning, cryptominers, reverse shells | Kernel cgroups v2 (`pids.max=64`, `memory.max=256MB`), `seccomp` profile dropping `ptrace`, `bpf`, `sys_admin`, read-only root filesystems, zero external network egress |
| **IDOR / Tenant Data Leakage** | Departmental peer snooping | Cross-organization access to private contests, proprietary company blueprints, or candidate interview reports | Strict server-side resource visibility middleware and query filters (`WHERE (visibility = 'public') OR (organization_id IN (user_memberships))`). Zero client-controlled authorization flags. |
| **Host Header Injection / SSRF** | Single known origin hostname | Multi-domain and subdomain spoofing | FastAPI strict Host Header allowlist checking in `origins.py` + SSRF protection in webhook dispatchers |
| **Contest Anti-Cheat & Multi-Accounting** | In-person proctors in college lab | Remote anonymous participants | Strict IP concurrency limits, cryptographic Trust-of-Proof HMAC signing, browser focus telemetry, copy-paste entropy detection |

---

## 2. Authorization Hierarchy & Least Privilege

```mermaid
flowchart TD
    Req[Incoming API Request] --> AuthCheck{Bearer Token / Session Cookie?}
    AuthCheck -- No --> PublicAnon[Public Anonymous Access: /marketing, /interview/tracks, /practice/public, /legal/*]
    AuthCheck -- Yes --> LoadUser[Load MemberProfile + Active Memberships]
    
    LoadUser --> ScopeEval{Evaluate Resource Scope}
    ScopeEval -- "public" --> Allow[Allow Access]
    ScopeEval -- "unlisted" --> TokenMatch{Direct Token / Slug Valid?}
    TokenMatch -- Yes --> Allow
    TokenMatch -- No --> Deny[HTTP 404 / 403 Forbidden]
    
    ScopeEval -- "organization_private" --> OrgMatch{User in Org Memberships?}
    OrgMatch -- Yes --> Allow
    OrgMatch -- No --> Deny
    
    ScopeEval -- "platform_admin_only" --> AdminMatch{platform_role in ('CORE_MEMBER', 'PLATFORM_ADMIN')?}
    AdminMatch -- Yes --> Allow
    AdminMatch -- No --> Deny
```

---

## 3. Sandboxing & Resource Isolation Invariants

1. **Ephemeral Execution Containers:** Docker sandboxes run under isolated user namespaces (`runas: 1000:1000`), ephemeral volumes mounted with `noexec, nosuid, nodev` on scratch disks.
2. **Deterministic Timeouts:** Soft execution timeouts enforce `2.0s` CPU deadline; hard SIGKILL triggers at `3.0s`.
3. **No Network Access:** Sandboxes are assigned `--network none`.
4. **Secret Storage:** All database credentials, JWT secrets, and API keys are read strictly from environment variables. Ordinary platform settings tables (`platform_settings`) are physically barred from storing plaintext secrets.
