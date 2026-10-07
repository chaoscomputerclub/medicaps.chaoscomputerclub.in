# Free-Tier Capacity Pooling & Quota Management
## Aggregating Heterogeneous Compute Without Mandatory Providers

---

### 1. Capacity Aggregation Philosophy

Instead of asking:  
*"Which cloud provider is our primary server?"*  
The CCC Peer-to-Peer Fabric asks:  
*"What aggregate capacity is currently available across all healthy peers?"*

Example active cluster snapshot:
```
Provider                Instance Type    Role           Capacity (Concurrency)
───────────────────────────────────────────────────────────────────────────────
Koyeb                   nano             API_PEER       2 req/sec
Render                  free-web         API_PEER       1 req/sec
Railway                 starter          API_PEER       2 req/sec
Campus VPS              linux-standard   API_PEER       10 req/sec
Student Workstation A   local-metal      JUDGE_PEER     4 testcases
Student Workstation B   local-metal      JUDGE_PEER     4 testcases
Gaming Rig              local-metal      JUDGE_PEER     8 testcases
───────────────────────────────────────────────────────────────────────────────
TOTAL LOGICAL CLUSTER CAPACITY:          API: 15 req/s  JUDGE: 16 testcases
```

---

### 2. Quota-Aware Graceful Degradation

When a free-tier provider reaches its monthly quota limit:
1. The peer advertises `quota_state: "EXHAUSTED"`.
2. Router peers immediately stop forwarding traffic to it.
3. Traffic is distributed across the remaining peers without any platform downtime or administrative intervention.
