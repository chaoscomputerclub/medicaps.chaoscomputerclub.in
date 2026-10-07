# CCC Medi-Caps — Free-Tier Capacity & Quota Matrix

> **Design Principle**: FREE DOES NOT MEAN UNLIMITED.  
> All services must enforce strict cost guardrails, bounded concurrency, and defensive caps to eliminate silent billing escalation.

---

## 1. Provider Capacity & Free Allowance Table

| Provider | Service / Plan | Free Quota / Allowance | Resource Limits | Concurrency / Connections | Cold Start & Sleep Behavior | Region Strategy | Billing Risk & Guardrail |
|---|---|---|---|---|---|---|---|
| **Cloudflare** | Free Plan | Unlimited DNS, Unlimited DDoS mitigation, 100k Worker requests/day | 10ms CPU time per Worker request | Unlimited concurrent edge requests | Zero cold start; global Anycast | Global Edge Network | **ZERO BILLING RISK**. Hard stops on paid add-ons. |
| **Vercel** | Hobby Tier | 100 GB Bandwidth / month, 100 build hours / month | 100 MB max deployment size, static assets only | Bounded only by Vercel edge CDN limits | Zero cold start for static Vite assets | Global Edge (AWS/Cloudflare CDN) | **ZERO BILLING RISK**. Account suspends or throttles on quota exceeded. |
| **Google Cloud** | Cloud Run (Always Free) | 2,000,000 requests / month, 180,000 vCPU-seconds / month, 360,000 GiB-seconds / month, 1 GB North America egress | Configured: 1 vCPU, 512 MB to 1024 MB RAM per container instance | Max instances capped strictly at `3` (`--max-instances=3`). Concurrency capped at `80` per instance. | Instances scale to 0 when idle. Cold start: ~1.5s–2.5s for lightweight Python FastAPI container. | `us-central1` or `asia-south1` (India) | **GUARDRAIL**: Billing budget alert set at $0.01; `--max-instances=3` prevents autoscaling runaway. |
| **Supabase** | Free Plan (PostgreSQL 16) | 500 MB Database Storage, 5 GB Bandwidth / month, 50,000 monthly active users | 2 Core shared CPU, 1 GB shared RAM | Direct (5432): **15 max connections**. Pooler (6543): **200 transaction connections**. | Free projects pause after 7 days of inactivity (prevented by periodic `MaintenanceWorker` health probe). | `ap-south-1` (Mumbai, India) | **ZERO BILLING RISK**. No card required for free tier. Read-only transition if storage exceeds 500 MB. |
| **Cloudinary** | Free Tier | 25 Monthly Credits (~25,000 transformations or 25 GB storage / 25 GB bandwidth) | Max image size 10 MB | Unlimited asynchronous uploads via CDN | Zero cold start | Global Fastly / Akamai CDN | **GUARDRAIL**: Maximum file upload size capped at 5 MB in backend policy. Auto-compression enabled. |
| **Upstash Redis** | Serverless Free | 10,000 commands / day, 256 MB storage | Max 100 concurrent connections | Max 100 concurrent connections | Serverless REST & TCP Redis | `ap-south-1` (Mumbai) | **GUARDRAIL**: Daily command threshold triggers fallback to self-hosted VPS Redis daemon before drop. |
| **Old VPS (Fallback)** | 4 GB Droplet | Existing infrastructure (unmetered compute up to hardware capacity) | 4 GB RAM, 2 vCPUs, 80 GB SSD | 500 DB connections, unmetered local Redis | No cold start | `blr1` (Bangalore, India) | Fixed predictable cost; used only as fallback and judge worker node. |
| **Distributed Go Nodes** | Personal Compute / Laptops | 100% Free (Utilizes existing student / organizer workstations) | 4–16 Cores, 8–32 GB RAM per machine | Bounded by local Docker governor: max 4 native, max 2 JVM jobs | Always warm when agent is running | Local campus network or internet | **ZERO BILLING RISK**. Compute provided by club hardware. |

---

## 2. Cost Guardrails & Defensive Configuration

To ensure zero financial escalation across cloud providers, the following settings are enforced in code and deployment descriptors:

### 2.1 Google Cloud Run Guardrails
```bash
gcloud run deploy ccc-api \
  --image gcr.io/$PROJECT_ID/ccc-api:v1.0.10 \
  --platform managed \
  --region asia-south1 \
  --min-instances 0 \
  --max-instances 3 \
  --concurrency 80 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 30s \
  --no-cpu-throttling=false
```
- **Max Instances**: `3`. Under peak load, 3 instances $\times$ 80 concurrency = 240 concurrent requests, easily serving a 100-student live contest.
- **Monthly Free Allowance Math**:
  - $3 \text{ instances} \times 0.5 \text{ GiB} = 1.5 \text{ GiB}$ active RAM.
  - At 2 hours per weekly contest: $1.5 \text{ GiB} \times 7,200 \text{ s} = 10,800 \text{ GiB-seconds}$ (well under the 360,000 GiB-second free limit).

### 2.2 Supabase Database Connection Safety
- **Direct port 5432**: Exclusively for migrations (`DB_POOL_SIZE=1`).
- **Supavisor Transaction Pooler port 6543**:
  - `DB_POOL_SIZE=3`
  - `DB_MAX_OVERFLOW=2`
  - Total connections across 3 Cloud Run instances: $3 \times (3 + 2) = 15$ pooler connections.
  - Far below Supabase's 200 pooler connection limit! Zero connection storm risk.

### 2.3 Redis Quota Optimization
- SingleFlight cache wrapping prevents repeated Redis key reads.
- Replay buffer trimmed to max 100 entries (`ZREMRANGEBYRANK`) with 24-hour TTL (`EXPIRE`).
- Redis pub/sub messages avoid payload bloat by transmitting only event descriptors and resource IDs; heavy payloads are fetched on-demand from cache.
