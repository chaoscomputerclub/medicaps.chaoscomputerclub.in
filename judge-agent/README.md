# CCC Judge Agent

Standalone judge compute agent for the gaming laptop (or any remote machine).

## Setup

```bash
# 1. Clone or copy judge-agent/ to the laptop
scp -r judge-agent/ ccc@laptop:/opt/ccc-judge-agent

# 2. Create venv and install deps
cd /opt/ccc-judge-agent
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

# 3. Add JUDGE_AGENT_SECRET to the cloud server .env
echo "JUDGE_AGENT_SECRET=mysupersecretkey" >> /opt/ccc-api/.env
# Then restart the cloud API

# 4. Configure the agent
sudo mkdir -p /etc/ccc-judge-agent
sudo cp env.example /etc/ccc-judge-agent/env
sudo nano /etc/ccc-judge-agent/env   # Fill in real values

# 5. Install and start the systemd service
sudo cp ccc-judge-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ccc-judge-agent
sudo systemctl start ccc-judge-agent

# 6. Check status
sudo systemctl status ccc-judge-agent
sudo journalctl -u ccc-judge-agent -f
```

## How it works

1. Agent starts → registers with `POST /api/workers/register`
2. Receives `worker_id` and queue config
3. Polls `ccc:queue:judge:pending` in cloud Redis via BRPOPLPUSH
4. Executes submission in local Docker sandbox (fully isolated)
5. Reports result to `POST /api/workers/{id}/jobs/{job_id}/complete`
6. On SIGTERM: drains active jobs → unregisters cleanly

## Failure behavior

- If laptop powers off mid-job: cloud visibility-timeout reaper
  requeues the orphaned job after 300s automatically.
- If cloud API is unreachable: heartbeats fail; after 6 consecutive
  failures the agent re-registers on next API availability.
- If Redis connection drops: BRPOPLPUSH returns error; poll loop
  retries with 1s backoff.

## Security

- Agent never connects to PostgreSQL directly
- Agent never writes to DB — all writes go through the cloud API
- Docker containers run with: --network=none --cap-drop=ALL --user=1000:1000
- JUDGE_AGENT_SECRET is a shared secret, never in code, only in env files

## Environment variables

| Variable              | Required | Default    | Description                        |
|-----------------------|----------|------------|------------------------------------|
| CLOUD_API_URL         | ✅       | —          | Cloud API base URL                 |
| JUDGE_AGENT_SECRET    | ✅       | —          | Shared secret (set on server too)  |
| REDIS_URL             | ✅       | —          | Cloud Redis URL                    |
| AGENT_MAX_CONCURRENCY | ✅       | 4          | Max parallel judge jobs            |
| AGENT_HOSTNAME        | ❌       | hostname() | Friendly name for registry         |
| AGENT_VERSION         | ❌       | 1.0.0      | Agent version string               |
| HEARTBEAT_INTERVAL_S  | ❌       | 5          | Heartbeat frequency                |
| POLL_TIMEOUT_S        | ❌       | 2          | Redis BRPOPLPUSH timeout           |
