# Backend Codebase Structure & Developer Guide

## 1. Directory Structure Blueprint

```
backend/
├── app/
│   ├── modules/                     # Domain modules (High cohesion, low coupling)
│   │   ├── auth/                    # Authentication, OAuth, OTP, Token lifecycle
│   │   ├── members/                 # Profiles, social graph, external rankings
│   │   ├── contests/                # Contest arena, submissions, problem sets
│   │   ├── assessments/             # Screening tests, anti-cheat, session timer
│   │   ├── leaderboard/             # Global standings, scoreboards, Elo history
│   │   ├── passes/                  # QR turnstile passes, proctor check-in
│   │   ├── proofs/                  # Trust-of-Proof SHA-256 verification
│   │   ├── feed/                    # Campus bulletins and announcements
│   │   ├── storage/                 # MinIO object storage uploads
│   │   ├── realtime/                # SSE streams & Redis pub/sub relay
│   │   └── admin/                   # Administrative operations & QA runner
│   │
│   ├── shared/                      # Generic, domain-agnostic capabilities
│   │   ├── database/                # SQLAlchemy session provider & Base
│   │   ├── cache/                   # Redis cache-aside & invalidation engine
│   │   ├── security/                # RS256 token issuance & password hashing
│   │   ├── errors/                  # Centralized domain error hierarchy
│   │   ├── pagination/              # Query parameter and header normalizers
│   │   └── logging/                 # Structured loggers
│   │
│   ├── engine/                      # Code execution & sandboxing engine
│   │   ├── docker/                  # Docker container pooling
│   │   ├── executors/               # Python, C++, Java, JS runners
│   │   └── providers/               # CodeBox, Local, Docker, Judge0, Interleet
│   │
│   ├── middleware/                  # HTTP interceptors (Cloudflare, Auth, Rate Limit)
│   ├── models/                      # SQLAlchemy declarative table models
│   ├── schemas/                     # Pydantic v2 validation contracts
│   ├── api/v1/                      # Versioned API route aggregators
│   └── main.py                      # FastAPI root app & lifespan
│
├── tests/                           # Unit, integration, and security tests
├── scripts/                         # Production QA, seeding, and migration utilities
└── docs/                            # Architecture and developer documentation
```

---

## 2. Where Code Belongs

| Code Artifact | Proper Location | Responsibility |
| :--- | :--- | :--- |
| **HTTP Route Definition** | `app/modules/<domain>/<domain>_router.py` or `app/routers/<domain>.py` | Declares URL paths, HTTP methods, status codes, OpenAPI tags, and FastAPI dependency injections. |
| **HTTP Controller** | `app/modules/<domain>/<domain>_controller.py` | Extracts parameters/body/user context, delegates to Application Service, and returns formatted response. **Must remain under 50 lines per method.** |
| **Application Service / Use Case** | `app/modules/<domain>/<domain>_service.py` | Implements business logic, validation rules, state transitions, cache coordination, and orchestration. |
| **Repository** | `app/modules/<domain>/<domain>_repository.py` | Encapsulates all database queries, joins, mutations, and transactional persistence. |
| **Request/Response Schema** | `app/schemas/<domain>.py` | Pydantic v2 schemas defining input validation and serialization contracts. |
| **Domain Policy / Guard** | `app/modules/<domain>/policies/` or `app/middleware/` | Access control checks, eligibility restrictions, and authorization policies. |
| **External Integration** | `app/infrastructure/` or `app/modules/<domain>/clients/` | Third-party SDK wrappers (Google OAuth, Hostinger SMTP, Cloudflare Turnstile). |
| **Background Task / Worker** | `app/services/background_tasks_service.py` | Periodic schedulers, cleanup workers, and asynchronous event consumers. |
| **Cross-Cutting Utility** | `app/shared/` or `app/lib/` | Pure functions with zero domain logic (crypto, QR codes, date utilities). |

---

## 3. Strict Rules of Engagement

1. **Controllers must never execute database queries.** Use repositories.
2. **Controllers must never call external third-party HTTP endpoints.** Use service clients.
3. **Never import private internals from another domain module.** Modules must only communicate via public services or event broadcasts.
4. **Never bypass repository transactions.** Atomic operations must be managed cleanly within the service or repository boundary.
5. **Preserve existing API contracts.** All status codes, headers, and payload structures must maintain backwards compatibility with the frontend.
