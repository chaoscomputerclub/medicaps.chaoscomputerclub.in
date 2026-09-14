"""
Core Docker Engine — Persistent Container Pool & Lifecycle Manager
Maintains long-lived sandbox containers to eliminate cold-start container creation overhead.
"""

from __future__ import annotations

import logging
import os
import threading
from pathlib import Path
from typing import Dict, List, Optional

try:
    import docker
    import docker.errors
    from docker.models.containers import Container
    DOCKER_INSTALLED = True
except ImportError:
    DOCKER_INSTALLED = False
    docker = None
    Container = None

logger = logging.getLogger("ccc.docker.pool")

_docker_client = None
_docker_client_lock = threading.Lock()

_container_cache: Dict[str, Container] = {}
_container_cache_lock = threading.Lock()


def get_workspace_base() -> Path:
    """Resolve host base directory mounted into containers as /workspace."""
    preferred = Path(os.environ.get("EXECUTION_WORKSPACE_DIR", "/tmp/interleet_workspaces"))
    try:
        preferred.mkdir(parents=True, exist_ok=True)
        os.chmod(preferred, 0o777)
        return preferred
    except Exception:
        fallback = Path.home() / ".ccc_workspaces"
        fallback.mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(fallback, 0o777)
        except Exception:
            pass
        return fallback


def get_docker_client():
    """Lazy thread-safe singleton for DockerClient."""
    global _docker_client
    if not DOCKER_INSTALLED:
        return None
    if _docker_client is None:
        with _docker_client_lock:
            if _docker_client is None:
                try:
                    _docker_client = docker.from_env()
                    _docker_client.ping()
                except Exception as exc:
                    logger.warning("Docker daemon unreachable: %s", exc)
                    _docker_client = None
    return _docker_client


def _create_persistent_container(client, image: str) -> Optional[Container]:
    """Create a persistent container running 'sleep infinity' with strict security."""
    container_name = f"interleet-engine-{image.replace(':', '-').replace('/', '-')}"
    workspace_base = get_workspace_base()

    # Reuse if already exists
    try:
        existing = client.containers.get(container_name)
        if existing.status == "running":
            logger.info("Reusing running container: %s", container_name)
            return existing
        existing.start()
        existing.reload()
        if existing.status == "running":
            logger.info("Restarted container: %s", container_name)
            return existing
        existing.remove(force=True)
    except Exception:
        pass

    try:
        container = client.containers.run(
            image=image,
            command=["sleep", "infinity"],
            name=container_name,
            volumes={
                str(workspace_base): {"bind": "/workspace", "mode": "rw"}
            },
            network_disabled=True,
            mem_limit="512m",
            memswap_limit="512m",
            nano_cpus=2_000_000_000,
            pids_limit=256,
            security_opt=["no-new-privileges"],
            cap_drop=["ALL"],
            detach=True,
            remove=False,
            tmpfs={"/tmp": "size=256m,noexec,nosuid"},
            restart_policy={"Name": "unless-stopped"},
        )
        logger.info("Spawned persistent container: %s (%s)", container_name, image)
        return container
    except Exception as exc:
        if "409" in str(exc):
            try:
                c = client.containers.get(container_name)
                if c.status != "running":
                    c.start()
                return c
            except Exception:
                pass
        logger.error("Failed to spawn container for %s: %s", image, exc)
        return None


def get_container(image: str) -> Optional[Container]:
    """Retrieve running persistent container for the requested image from cache or daemon."""
    client = get_docker_client()
    if not client:
        return None

    with _container_cache_lock:
        cached = _container_cache.get(image)
        if cached:
            try:
                cached.reload()
                if cached.status == "running":
                    return cached
            except Exception:
                pass
            _container_cache.pop(image, None)

        container_name = f"interleet-engine-{image.replace(':', '-').replace('/', '-')}"
        try:
            c = client.containers.get(container_name)
            if c.status != "running":
                c.start()
                c.reload()
            if c.status == "running":
                _container_cache[image] = c
                return c
        except Exception:
            pass

        fresh = _create_persistent_container(client, image)
        if fresh:
            _container_cache[image] = fresh
            return fresh

    return None


def prewarm_containers(images: Optional[List[str]] = None) -> Dict[str, bool]:
    """Ensure all language sandbox containers are warm and ready."""
    client = get_docker_client()
    if not client:
        return {}

    if images is None:
        images = [
            "interleet-python:latest",
            "interleet-cpp:latest",
            "interleet-java:latest",
            "interleet-node:latest",
            "interleet-typescript:latest",
            "interleet-go:latest",
            "interleet-rust:latest",
        ]

    results: Dict[str, bool] = {}
    for img in images:
        try:
            cnt = get_container(img)
            results[img] = cnt is not None and cnt.status == "running"
            if results[img]:
                logger.info("Pre-warmed sandbox container: %s", img)
            else:
                logger.warning("Sandbox container failed to pre-warm: %s", img)
        except Exception as exc:
            logger.error("Error pre-warming %s: %s", img, exc)
            results[img] = False
    return results
