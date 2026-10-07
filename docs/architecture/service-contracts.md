# Peer-to-Peer Service Contracts
## Internal Service APIs, Mutual Authentication & Versioning

---

### 1. Internal API Boundary

Peers communicate over private or public networks using authenticated internal service contracts under `/internal/v1/*`. Internal traffic is **never trusted by default**.

Every internal request requires:
- `X-Peer-Id`: Unique identifier of the initiating peer.
- `X-Peer-Signature`: HMAC-SHA256 signature generated using `PEER_SHARED_SECRET` across the payload and timestamp.
- `X-Peer-Timestamp`: ISO 8601 UTC timestamp (requests with drift $>30\text{s}$ are rejected to prevent replay attacks).

---

### 2. Service Endpoints

#### 2.1 Peer Registration
- **Endpoint**: `POST /internal/v1/peers/register`
- **Payload**: Full `PeerAdvertisement` schema (roles, provider, region, endpoints, capacity, protocol version).
- **Response**: `{ "status": "enrolled", "lease_ttl_sec": 15, "server_time": "..." }`

#### 2.2 Peer Heartbeat
- **Endpoint**: `POST /internal/v1/peers/heartbeat`
- **Payload**: `{ "peer_id": "...", "cpu_percent": 24.5, "ram_mb": 180, "active_jobs": 2, "quota_state": "NORMAL" }`
- **Response**: `{ "status": "acknowledged", "reap_threshold_sec": 30 }`

#### 2.3 Peer Draining
- **Endpoint**: `POST /internal/v1/peers/drain`
- **Payload**: `{ "peer_id": "...", "reason": "planned_maintenance" }`
- **Response**: `{ "status": "draining", "active_work_remaining": 1 }`

#### 2.4 Infrastructure Dashboard Telemetry
- **Endpoint**: `GET /internal/v1/peers/dashboard`
- **Response**: Live cluster matrix detailing all connected peers, capacities, and health states across all cloud and local providers.
