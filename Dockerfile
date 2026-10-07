# ==============================================================================
# Universal Multi-Provider Container: CCC Medi-Caps P2P Compute Peer
# Compatible with: Render, Koyeb, Railway, Fly.io, Northflank, Cloud Run, VPS
# ==============================================================================

FROM python:3.12-slim-bookworm AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /build/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# Final runtime image
FROM python:3.12-slim-bookworm AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    ca-certificates \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Create unprivileged application user
RUN groupadd -g 1001 cccapp && \
    useradd -u 1001 -g cccapp -s /bin/bash -m cccapp

# Copy backend source code into container
COPY backend /app

# Ensure proper permissions
RUN chown -R cccapp:cccapp /app

USER cccapp

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PORT=8000 \
    SERVICE_MODE=all \
    ENVIRONMENT=production

EXPOSE 8000

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Launch uvicorn dynamically binding to $PORT across any cloud provider
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WORKERS:-2} --proxy-headers"]
