# ==============================================================================
# Chaos Computer Club — Universal Multi-Language Judge Sandbox Container
# ==============================================================================

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    openjdk-21-jdk-headless \
    openjdk-21-jre-headless \
    ca-certificates \
    curl \
    procps \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g typescript

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir fastapi uvicorn pydantic httpx

RUN groupadd -g 2000 sandbox && \
    useradd -u 2000 -g sandbox -m -s /bin/bash sandbox

COPY server.py /app/server.py

RUN chown -R sandbox:sandbox /app

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080} --workers 2"]
