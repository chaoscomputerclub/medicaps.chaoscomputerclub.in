# Backend Architecture: Modular Monolith

## 1. Overview & Architectural Principles

The Chaos Computer Club (CCC) Medi-Caps Chapter backend is architected as a **Modular Monolith**. It provides high-performance competitive programming contest orchestration, real-time Server-Sent Events (SSE) telemetry, asymmetric cryptographic Trust-of-Proof verification, and student rating ladder systems.

### Core Architectural Decisions:
- **No Microservices:** Avoids unnecessary network hops, distributed transaction complexity, RPC serializations, and operational overhead.
- **Deep Domain Separation:** Every business capability is encapsulated within a cohesive domain module (`backend/app/modules/<domain>`).
- **Thin Controllers:** Controllers only accept HTTP requests, validate input parameters, invoke domain application services, and format HTTP responses.
- **Explicit Repositories:** All SQL and database operations are encapsulated in domain repositories. Zero raw SQL or ORM queries live inside controllers.
- **Strict Dependency Direction:**
  $$\text{Router} \longrightarrow \text{Controller} \longrightarrow \text{Application Service} \longrightarrow \text{Domain / Policy} \longrightarrow \text{Repository} \longrightarrow \text{Database / Cache}$$

---

## 2. Domain Module Boundaries

```
backend/app/
│
├── modules/
│   ├── auth/            # Identity, Google OAuth, Email OTP, JWT cookies
│   ├── members/         # Student profiles, social follow graph, external stats (LeetCode/CodeChef)
│   ├── contests/        # Contests, problem sets, submissions, judge orchestration, dynamic cloning
│   ├── assessments/     # Phase 1 screening exam, anti-cheat, session timer, Top-30 cutoffs
│   ├── leaderboard/     # University overall standings, rating distribution, scoreboards
│   ├── passes/          # QR turnstile passes, proctor check-in, attendee roster
│   ├── proofs/          # Cryptographic SHA-256 Trust Proofs, public certificate ledger
│   ├── feed/            # Campus announcements, bulletin categories
│   ├── storage/         # MinIO S3 media assets, avatars, resumes
│   ├── realtime/        # Server-Sent Events (SSE), Redis Pub/Sub event relay
│   └── admin/           # Administrative operations & QA automation harness
│
├── shared/              # Cross-cutting concerns
│   ├── database/        # Async SQLAlchemy engine & session factory
│   ├── cache/           # Redis cache-aside & pattern invalidation engine
│   ├── security/        # RS256 token issuance & verification, auth cookie helpers
│   ├── errors/          # Typed domain exceptions & global exception handler
│   ├── pagination/      # Standardized cursor & offset pagination helpers
│   └── logging/         # Structured logger configuration
│
├── engine/              # Isolated code execution sandbox cluster
│   ├── docker/          # Container pooling and language runtime environments
│   ├── executors/       # Python, C++, Java, JS runners
│   └── providers/       # CodeBox, Local, Docker, Judge0, Interleet providers
│
└── main.py              # Application bootstrap & lifespan configuration
```

---

## 3. Request Lifecycle

1. **Edge Security & Middleware:**
   - `CloudflareSecurityMiddleware`: Extracts verified client IP, injects HSTS, COOP, and CF-Ray headers.
   - `ContestEligibilityMiddleware`: Enforces physical contest eligibility rules.
   - `CORSMiddleware`: Whitelists trusted institutional origins.
2. **Route Dispatch:**
   - FastAPI APIRouter matches path, executes Pydantic schema validation on request payload.
3. **Controller Execution (Thin):**
   - Controller extracts parameters/claims (`current_member`, request body, query params).
   - Delegates directly to domain Application Service.
4. **Application Service & Policies:**
   - Enforces business rules, state transitions, idempotency checks.
   - Calls Repository for persistence and Cache interface for SWR/memoization.
5. **Response Formatting:**
   - Serializes domain entity to Pydantic response schema with appropriate `Cache-Control` and `ETag` headers.

---

## 4. Caching & Persistence Strategy

- **PostgreSQL 16:** Source of truth with composite B-Tree indexes covering all high-traffic filters (Department + Batch + Rating, Contest + Score + Penalty).
- **Redis 7:** Sub-millisecond cache-aside with TTL and targeted tag/glob invalidation via non-blocking `scan_iter`.
- **In-Memory SWR:** Client-side cache hydration with background revalidation and in-flight promise deduplication.

---

## 5. Adding a New Domain Module

When introducing a new domain (e.g. `interviews` or `certificates`):
1. Create directory `backend/app/modules/<new_domain>/`.
2. Implement:
   - `<domain>_repository.py`: All database queries.
   - `<domain>_service.py`: Business logic, validations, and workflows.
   - `<domain>_controller.py`: Thin request delegator.
   - `<domain>_router.py`: FastAPI endpoints and parameter bindings.
   - `<domain>_schemas.py`: Pydantic request/response models.
3. Mount the new router in `backend/app/api/v1/router.py` and `backend/main.py`.
4. Add automated API tests to `backend/app/services/qa_test_service.py`.
