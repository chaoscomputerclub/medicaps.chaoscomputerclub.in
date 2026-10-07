# 🚀 CCC Medi-Caps Distributed Backend Infrastructure Guide

This guide details how the **Chaos Computer Club Medi-Caps Chapter** backend infrastructure is architected, how edge traffic routing works, and how to connect compute peers across any container hosting provider (Render, Koyeb, Railway, Fly.io, Cloud Run, VPS).

---

## 🏛️ Architecture Overview

```
                          INTERNET / USERS
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │   CLOUDFLARE EDGE     │
                     │  (medicaps-edge-router)│
                     └───────────┬───────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           │ (Static SPA routes) │ (/api/* requests)   │
           ▼                     ▼                     │
 ┌───────────────────┐ ┌───────────────────┐           │
 │      VERCEL       │ │  COMPUTE PEER 1   │           │
 │   React 19 SPA    │ │     (Render)      │           │
 └───────────────────┘ └─────────┬─────────┘           │
                                 │ (Failover / Pool)   ▼
                                 │            ┌───────────────────┐
                                 │            │  COMPUTE PEER 2   │
                                 │            │  (Koyeb / Railway)│
                                 │            └─────────┬─────────┘
                                 │                      │
                                 ▼                      ▼
                       ┌──────────────────────────────────┐
                       │       SHARED STATE LAYER         │
                       │   PostgreSQL 16 + Redis Cache    │
                       └──────────────────────────────────┘
```

---

## 🛠️ Compute Peer Deployment Options

### Option 1: Deploy on Render (Recommended for Free Tier)

1. **Log in to Render Dashboard**: [dashboard.render.com](https://dashboard.render.com/)
2. **Create New Web Service**:
   - Select **Build and deploy from a Git repository**.
   - Connect repository: `chaoscomputerclub/medicaps.chaoscomputerclub.in` (or your GitHub fork).
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Instance Type**: `Free`
   - **Region**: `Singapore` (or nearest region)
   - **Health Check Path**: `/api/health`
3. **Set Environment Variables in Render**:
   - `SERVICE_MODE`: `all`
   - `ENVIRONMENT`: `production`
   - `DATABASE_URL`: Your PostgreSQL connection string (`postgresql+asyncpg://...`)
   - `REDIS_URL`: Your Redis connection string (`rediss://...` or `redis://...`)
   - `SECRET_KEY`: `ccc_prod_secret_key_912_2026_medicaps_super_secure`
   - `ALLOW_UNSANDBOXED_EXECUTION`: `true`
   - `FRONTEND_URL`: `https://medicaps.chaoscomputerclub.in`
   - `BACKEND_URL`: `https://api-medicaps.chaoscomputerclub.in/api`
4. **Link to Cloudflare Edge Router**:
   Once Render assigns your service URL (e.g., `https://ccc-medicaps-peer.onrender.com`):
   ```bash
   ./scripts/deploy_render_peer.sh https://<your-service-name>.onrender.com
   ```

---

### Option 2: Deploy on Koyeb

1. **Log in to Koyeb**: [app.koyeb.com](https://app.koyeb.com/)
2. **Create App**:
   - GitHub Repository: `chaoscomputerclub/medicaps.chaoscomputerclub.in`
   - **Builder**: `Dockerfile` (`/Dockerfile`)
   - **Port**: `8000`
   - **Privileged**: Standard / Free tier
3. **Set Environment Variables**:
   Same as above (`SERVICE_MODE=all`, `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, etc.).
4. **Register with Ingress Router**:
   ```bash
   ./scripts/connect_compute_peer.sh https://<your-app>.koyeb.app
   ```

---

### Option 3: Multi-Peer Load Balancing & High Availability

To route across multiple active compute instances with automated zero-downtime failover:
```bash
./scripts/connect_compute_peer.sh https://ccc-medicaps-peer.onrender.com,https://ccc-api.koyeb.app
```

---

## 🔍 Health & Diagnostic Verification

Verify edge routing and backend compute status:

```bash
# Edge & Peer Health Probe
curl -i https://medicaps.chaoscomputerclub.in/api/health

# Edge Ingress Diagnostics Probe
curl -i https://medicaps.chaoscomputerclub.in/api/health/edge

# Unauthenticated Session Handshake Probe (should return clean 401 JSON)
curl -i https://medicaps.chaoscomputerclub.in/api/auth/refresh
```

---

## 📦 Container Specifications

- **Base Image**: Python 3.12 slim (`python:3.12-slim-bookworm`)
- **Port**: Dynamically binds to `${PORT:-8000}`
- **Security**: Non-root container user (`cccapp:cccapp`, UID 1001)
- **Engines Supported**: CodeBox, Local Sandboxed Subprocess, Core Docker, Distributed P2P Fabric
