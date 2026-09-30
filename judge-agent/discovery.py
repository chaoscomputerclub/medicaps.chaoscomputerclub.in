"""
Chaos Computer Club — Portable Node Fabric
discovery.py — Hardware & Environment Discovery Engine

Probes host system capabilities, CPU cores/threads, RAM, storage, container
runtimes, and network connectivity without hardcoding assumptions.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import platform
import socket
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    psutil = None
    PSUTIL_AVAILABLE = False

logger = logging.getLogger("ccc.node.discovery")


class HardwareDiscovery:
    """Discovers host capabilities and returns a normalized capability document."""

    @staticmethod
    def get_node_id(storage_dir: Path) -> str:
        """
        Generate or load persistent node identity based on machine hardware hash.
        Ensures the same physical machine retains its identity across restarts.
        """
        id_file = storage_dir / ".node_id"
        if id_file.exists():
            try:
                node_id = id_file.read_text().strip()
                if node_id.startswith("node_"):
                    return node_id
            except Exception:
                pass

        # Synthesize stable hardware fingerprint
        components = [
            platform.node(),
            platform.machine(),
            platform.processor(),
            str(psutil.cpu_count(logical=False)),
            str(psutil.virtual_memory().total),
        ]
        
        # Read system machine-id if available
        for p in ["/etc/machine-id", "/var/lib/dbus/machine-id"]:
            f = Path(p)
            if f.exists():
                try:
                    components.append(f.read_text().strip())
                    break
                except Exception:
                    pass

        raw = ":".join(components)
        digest = hashlib.sha256(raw.encode()).hexdigest()[:12]
        node_id = f"node_{digest}"

        try:
            storage_dir.mkdir(parents=True, exist_ok=True)
            id_file.write_text(node_id)
        except Exception as exc:
            logger.warning("Could not persist node_id to %s: %s", id_file, exc)

        return node_id

    @staticmethod
    def get_cpu_info() -> Dict[str, Any]:
        """Detect CPU physical/logical cores, frequency, and model."""
        if PSUTIL_AVAILABLE:
            phys_cores = psutil.cpu_count(logical=False) or 1
            log_cores = psutil.cpu_count(logical=True) or 1
            freq = psutil.cpu_freq()
            freq_mhz = round(freq.current, 1) if freq else None
        else:
            log_cores = os.cpu_count() or 1
            phys_cores = max(1, log_cores // 2)
            freq_mhz = None
        
        model = platform.processor() or "Unknown CPU"
        # On Linux, parse /proc/cpuinfo for full human-readable model
        if platform.system() == "Linux":
            try:
                with open("/proc/cpuinfo", "r") as f:
                    for line in f:
                        if "model name" in line:
                            model = line.split(":", 1)[1].strip()
                            break
            except Exception:
                pass

        return {
            "physical_cores": phys_cores,
            "logical_cores": log_cores,
            "architecture": platform.machine(),
            "model": model,
            "frequency_mhz": freq_mhz,
        }

    @staticmethod
    def get_memory_info() -> Dict[str, Any]:
        """Detect RAM capacity and availability."""
        if PSUTIL_AVAILABLE:
            mem = psutil.virtual_memory()
            return {
                "total_mb": mem.total // (1024 * 1024),
                "available_mb": mem.available // (1024 * 1024),
                "used_pct": mem.percent,
            }
        return {
            "total_mb": 4096,
            "available_mb": 2048,
            "used_pct": 50.0,
        }

    @staticmethod
    def get_storage_info(work_dir: Path) -> Dict[str, Any]:
        """Detect storage capacity and USB/removable status."""
        try:
            if PSUTIL_AVAILABLE:
                usage = psutil.disk_usage(str(work_dir))
                avail_gb = round(usage.free / (1024 ** 3), 2)
            else:
                stat = os.statvfs(str(work_dir))
                avail_gb = round((stat.f_bavail * stat.f_frsize) / (1024 ** 3), 2)
        except Exception:
            avail_gb = 10.0

        is_usb = False
        if platform.system() == "Linux":
            try:
                res = subprocess.run(["findmnt", "-no", "SOURCE", str(work_dir)], capture_output=True, text=True)
                src = res.stdout.strip()
                if "sd" in src or "usb" in src:
                    is_usb = True
            except Exception:
                pass

        return {
            "available_gb": avail_gb,
            "usb_mode": is_usb,
        }

    @staticmethod
    def get_container_capability() -> Dict[str, Any]:
        """Verify Docker availability, daemon health, and version."""
        try:
            proc = subprocess.run(
                ["docker", "version", "--format", "{{.Server.Version}}"],
                capture_output=True,
                text=True,
                timeout=3,
            )
            if proc.returncode == 0 and proc.stdout.strip():
                return {
                    "runtime": "docker",
                    "version": proc.stdout.strip(),
                    "healthy": True,
                }
        except Exception:
            pass

        return {
            "runtime": "none",
            "version": "unavailable",
            "healthy": False,
        }

    @staticmethod
    def get_network_info(target_host: str = "medicaps.chaoscomputerclub.in") -> Dict[str, Any]:
        """Probe default network interface, internet reachability, and latency."""
        interface = "unknown"
        connected = False
        latency_ms = 0.0

        start = time.time()
        try:
            s = socket.create_connection((target_host, 443), timeout=3.0)
            latency_ms = round((time.time() - start) * 1000.0, 2)
            s.close()
            connected = True
        except Exception:
            # Fallback probe to DNS
            try:
                socket.create_connection(("8.8.8.8", 53), timeout=2.0).close()
                connected = True
            except Exception:
                connected = False

        # Identify default network interface
        try:
            stats = psutil.net_if_stats()
            for iface, stat in stats.items():
                if stat.isup and not iface.startswith(("lo", "docker", "veth", "br-")):
                    interface = iface
                    break
        except Exception:
            pass

        return {
            "connected": connected,
            "interface": interface,
            "latency_ms": latency_ms,
        }

    @classmethod
    def collect_capabilities(cls, storage_dir: Path, target_host: str = "medicaps.chaoscomputerclub.in") -> Dict[str, Any]:
        """Collect and normalize full hardware capability document."""
        cpu = cls.get_cpu_info()
        mem = cls.get_memory_info()
        storage = cls.get_storage_info(storage_dir)
        container = cls.get_container_capability()
        network = cls.get_network_info(target_host)
        node_id = cls.get_node_id(storage_dir)

        # Dynamic concurrency recommendation:
        # 1 slot per 1.5 logical cores, bounded by available RAM (min 768MB per concurrent sandbox)
        core_based_slots = max(1, cpu["logical_cores"] - 2)
        ram_based_slots = max(1, mem["available_mb"] // 768)
        recommended_concurrency = max(1, min(core_based_slots, ram_based_slots, 16))

        return {
            "node_id": node_id,
            "hostname": platform.node(),
            "os_name": platform.system().lower(),
            "cpu": cpu,
            "memory": mem,
            "storage": storage,
            "container": container,
            "network": network,
            "max_concurrency": recommended_concurrency,
            "languages": ["python", "javascript", "cpp", "java", "c"],
            "agent_version": "2.0.0",
        }
