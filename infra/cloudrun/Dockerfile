# ==============================================================================
# Google Cloud Run Multi-Mode Production Dockerfile
# Chaos Computer Club — Medi-Caps Chapter Backend
# Serves: ccc-api, ccc-worker, ccc-realtime based on SERVICE_MODE env var
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

# Final minimal runtime image
FROM python:3.12-slim-bookworm AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Create unprivileged application user
RUN groupadd -g 1001 cccapp && \
    useradd -u 1001 -g cccapp -s /bin/bash -m cccapp

# Copy application source code
COPY backend /app

# Ensure proper permissions
RUN chown -R cccapp:cccapp /app

USER cccapp

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PORT=8000 \
    SERVICE_MODE=api \
    ENVIRONMENT=production

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Launch backend via entrypoint runner
CMD ["python3", "main.py"]
