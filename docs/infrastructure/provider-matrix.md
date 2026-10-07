# Cloud Provider Matrix & Capability Registry
## Federated Hosting Providers & Characteristics

---

| Provider | Supported Peer Roles | Isolation Mechanism | Free Tier Profile | Cold Start | Suitable For |
|---|---|---|---|---|---|
| **Google Cloud Run** | `API_PEER`, `WORKER_PEER`, `JUDGE_PEER` | gVisor microVM sandbox | 2M req/month (Billing account required) | $<1.5\text{s}$ | High-throughput API & Cloud Sandboxes |
| **Koyeb** | `API_PEER`, `JUDGE_PEER`, `ROUTER_PEER` | Firecracker microVM | Free Nano instance (Zero credit card) | $<2.0\text{s}$ | Resilient API & Standalone Judge microservice |
| **Render** | `API_PEER`, `REALTIME_PEER` | Container runtime | 750 free hrs/month (Sleeps when idle) | $\approx 30\text{s}$ | Background worker & auxiliary API capacity |
| **Railway** | `API_PEER`, `WORKER_PEER` | Docker container | $5 trial credit / usage tiers | Instant | Eventual consistency outbox workers |
| **Fly.io** | `ROUTER_PEER`, `API_PEER` | Firecracker microVM | Free allowance per region | $<500\text{ms}$ | Global distributed Nginx edge routers |
| **Dedicated VPS** | `ROUTER_PEER`, `API_PEER`, `WORKER_PEER` | KVM / Native Linux | Fixed monthly | Instant | Always-on baseline router & API |
| **Local / Lab PCs** | `JUDGE_PEER` | Native Docker / tmpfs / cgroups | Free university / student hardware | Instant | Burst compute during live offline tournaments |
