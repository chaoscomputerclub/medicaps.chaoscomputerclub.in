# Production Deployment & Portable USB Node Bootstrap Specification
## Chaos Computer Club Medi-Caps Chapter — Dynamic Application & Compute Fabric

---

### 1. Cloud Control Plane Deployment

The central control plane resides on the Cloud VPS (`143.198.38.205`) fronted by Cloudflare:

```
Cloud VPS (Ubuntu 22.04 LTS)
├── Nginx (Port 80/443, SSL/TLS, SSE buffering off)
├── Systemd: ccc-medicaps.service (FastAPI Uvicorn workers)
├── PostgreSQL 16 (Authoritative Database, asyncpg pool)
├── Redis 7 (Coordination, Pub/Sub, Queues, SingleFlight)
└── Production Web Root: /var/www/ccc-medicaps/dist
```

Continuous Deployment operates via `.github/workflows/deploy.yml` on push to `main`:
1. Compiles frontend production bundle (`npm run build`).
2. Connects to server via SSH, pulls commits, runs DB migrations, restarts systemd services, reloads Nginx.

---

### 2. Portable USB Node Structure (`ccc-node/`)

The USB flash drive is formatted with an exFAT or ext4 partition containing the portable node bundle:

```
ccc-node/
├── bootstrap.sh           # Main launch script: probes host, prepares tmpfs, starts agent
├── stop.sh                # Graceful shutdown: triggers drain, terminates containers, exits
├── bin/
│   ├── node-agent-linux-amd64    # Static Go executable for x86_64 Linux
│   └── node-agent-darwin-arm64   # Static Go executable for Apple Silicon macOS
├── config/
│   └── node.env           # Configuration (Control Plane URL, Enrollment Token)
├── systemd/
│   └── ccc-node.service   # Optional systemd unit file for persistent lab machines
└── scripts/
    ├── prepare-tmpfs.sh   # Sets up /tmp/ccc_workspaces on RAM
    └── pre-pull-images.sh # Caches Docker sandbox images to local daemon
```

---

### 3. Step-by-Step USB Bootstrap Workflow

When an authorized user inserts the USB into any host computer:

```bash
# 1. Navigate to USB directory
cd /media/$USER/CCC-NODE/

# 2. Execute bootstrap script
./bootstrap.sh
```

**What `bootstrap.sh` executes automatically:**
1. Verifies Docker daemon is running; prompts user if Docker needs to start.
2. Allocates in-memory RAM `tmpfs` at `/tmp/ccc_workspaces` (zero disk wear on USB).
3. Selects the appropriate static binary for the host OS and architecture.
4. Auto-discovers physical cores, RAM, network latency, and container runtimes.
5. Emits `POST /api/v1/nodes/register` to the Cloud Control Plane.
6. Establishes outbound reverse multiplexing tunnel and heartbeat loop.
7. Enters `READY` state — the computer is now actively serving global traffic!

---

### 4. Step-by-Step Node Teardown Workflow

To disconnect the computer from the fabric:

```bash
# Graceful shutdown
./stop.sh
```

**What `stop.sh` executes automatically:**
1. Signals agent with `SIGTERM`.
2. Emits `POST /api/v1/nodes/{id}/drain` to the Control Plane.
3. Allows in-flight judge executions to finish (max 20s timeout).
4. Cleans all ephemeral files from `/tmp/ccc_workspaces`.
5. Emits `POST /api/v1/nodes/{id}/unregister`.
6. Unmounts tmpfs and exits cleanly with zero residual host modifications.
