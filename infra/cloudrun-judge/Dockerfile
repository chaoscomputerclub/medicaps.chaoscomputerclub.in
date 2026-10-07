# ==============================================================================
# Google Cloud Run Multi-Language Judge Service
# Chaos Computer Club — Isolated Sandbox Execution Engine
# ==============================================================================

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

WORKDIR /app

# Install all compilers & execution runtimes: Python, C/C++, Java 21, Node.js 20
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    openjdk-21-jdk-headless \
    openjdk-21-jre-headless \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create virtualenv for Python service dependencies
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir fastapi uvicorn pydantic

# Create unprivileged runner user
RUN groupadd -g 2000 sandbox && \
    useradd -u 2000 -g sandbox -m -s /bin/bash sandbox

COPY infra/cloudrun-judge/server.py /app/server.py

# Give sandbox user permissions to app directory
RUN chown -R sandbox:sandbox /app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Launch Judge HTTP service
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
