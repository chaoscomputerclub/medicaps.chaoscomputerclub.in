# CCC Medi-Caps — Cloud Network Topology & Inter-Service Communications

> **Document Type**: Architecture & Network Specification  
> **Security Standard**: Mutual TLS / TLS 1.3, Zero Trust, Outbound-Only Workers, Strict Authority Fencing.

---

## 1. Network Topology Diagram

```
[ Student Browser ]
       │
       │ (1) HTTPS / WSS / TLS 1.3 (Port 443)
       ▼
[ Cloudflare Global Edge (WAF / DNS / Turnstile / CDN) ]
   ├─── (2a) HTTPS -> [ Vercel Edge CDN ] (Static React/Vite SPA Assets)
   ├─── (2b) HTTPS -> [ Cloudflare Workers ] (Edge Request Normalizer / Rate Limiter)
   └─── (2c) HTTPS / TLS 1.3 -> [ Google Cloud Run Ingress ]
                                      │
              ┌───────────────────────┼───────────────────────┐
              │ (3a)                  │ (3b)                  │ (3c)
              ▼                       ▼                       ▼
      [ ccc-api (REST) ]     [ ccc-worker (Async) ]  [ ccc-realtime (SSE) ]
              │                       │                       │
              ├───────────────┬───────┴───────────────┬───────┤
              │ (4)           │ (5)                   │ (5)   │ (5)
              ▼               ▼                       ▼       ▼
    [ Supabase PostgreSQL ]   [ Redis (TCP / TLS) ] ──┘       │
    (Port 6543 / 5432)        (Port 6379 / TLS)               │
              ▲                       ▲                       │
              │ (7)                   │ (6)                   │
              │ CAS Results           │ Poll & Heartbeat      │
              └───────────────────────┴───────────────────────┘
                                      │
                                      ▼
                        [ Distributed Go Node-Agents ]
                        (Laptops / Desktops / Workstations)
                        (Outbound-Only HTTPS Polling)
```

---

## 2. Connection Specification Table

| Connection ID | From (Source) | To (Destination) | Protocol | Direction | Authentication Mechanism | Encryption | Timeout | Retry Policy | Authority Level |
|---|---|---|---|---|---|---|---|---|---|
| **CONN-01** | Student Browser | Cloudflare Edge | HTTPS (HTTP/2, HTTP/3) | Inbound to Cloudflare | Cloudflare Turnstile token + TLS session ticket | TLS 1.3 | 15s | Browser default | Edge Ingress Only |
| **CONN-02A** | Cloudflare Edge | Vercel Edge | HTTPS | Egress to Vercel origin | Vercel custom domain CNAME verification | TLS 1.3 | 10s | 3 attempts | Static File Cache |
| **CONN-02B** | Cloudflare Edge | Cloud Run Ingress | HTTPS | Egress to Cloud Run | Host header verification (`medicaps-api.chaoscomputerclub.in`) | TLS 1.3 | 30s | 2 attempts (idempotent GETs only) | Stateless API Proxy |
| **CONN-03A** | Browser | `ccc-api` (via Cloudflare) | HTTPS | Inbound API calls | Bearer JWT (RS256 asymmetric signature) | TLS 1.3 | 30s | Client exponential backoff | Business Logic Gateway |
| **CONN-03B** | Browser | `ccc-realtime` (via Cloudflare) | HTTPS (EventSource) | Persistent Inbound SSE | Optional JWT / Cookie; `Last-Event-ID` header | TLS 1.3 | Persistent (15s ping) | Reconnect with jitter (1s–30s) | Push Event Fanout |
| **CONN-04** | Cloud Run (`ccc-api`, `ccc-worker`) | Supabase PostgreSQL | TCP (asyncpg) | Outbound from Cloud Run to Supabase | PostgreSQL DB user (`postgres`) + password + TLS | TLS 1.3 (port 6543/5432) | Connect: 10s, Query: 5s | 3 attempts with circuit breaker | **AUTHORITATIVE SOURCE OF TRUTH** |
| **CONN-05** | Cloud Run (`api`, `worker`, `realtime`) | Redis (Upstash / Cloud / VPS) | TCP / redis-py | Outbound from Cloud Run to Redis | Redis `AUTH` password | TLS / Port 6379 | Connect: 3s, Command: 2s | SingleFlight backpressure | Ephemeral Coordination |
| **CONN-06** | Distributed Go Node-Agent | `ccc-api` (Cloud Run) | HTTPS (REST) | **Outbound Only** from Node to Cloud Run | `Authorization: Bearer <JUDGE_AGENT_SECRET>` | TLS 1.3 | Claim: 5s, Report: 10s | Infinite retry with exponential backoff (1s–10s) | Disposable Compute Worker |
| **CONN-07** | Student Browser | Cloudinary CDN | HTTPS | Outbound to Cloudinary | HMAC-SHA1 signed upload credentials | TLS 1.3 | 30s | 2 retries | Media Storage CDN |

---

## 3. Network Isolation & Security Invariants

1. **Zero Open Ports on Judge Compute**:
   - Distributed Go nodes never open listening TCP ports to the public internet or local area network.
   - All network traffic is initiated as outbound HTTP requests (`POST /api/nodes/{id}/claim`, `POST /api/nodes/{id}/heartbeat`, `POST /api/nodes/{id}/result`).
2. **Untrusted Code Network Airgap**:
   - Inside the Go node agent, Docker sandboxes execute with `--network none` (or isolated bridge with iptables drop rules for non-local traffic).
   - Untrusted contestant code cannot communicate with local LAN, cloud APIs, Supabase, or Redis.
3. **Database Origin Shielding**:
   - Supabase project connection string is restricted and only known to Cloud Run environment variables and CI/CD secret manager.
4. **Cloudflare WAF Ingress Shield**:
   - Direct requests to backend origins that bypass Cloudflare are blocked via Cloudflare IP range filtering and Cloudflare Authenticated Origin Pulls (AOP).
