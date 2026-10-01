#!/usr/bin/env python3
"""
Hardware & OS Baseline Telemetry Collector
Gathers CPU, RAM, Disk, Network, Docker, and OS parameters.
"""

import json
import os
import subprocess
import sys

def run(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT, text=True).strip()
    except Exception as e:
        return f"ERR: {e}"

def main():
    data = {}
    
    # ── CPU ──
    data["cpu"] = {
        "lscpu": run("lscpu 2>/dev/null || sysctl -a | grep machdep.cpu 2>/dev/null"),
        "loadavg": run("cat /proc/loadavg 2>/dev/null || sysctl -n vm.loadavg 2>/dev/null"),
        "cores_logical": os.cpu_count(),
        "vmstat": run("vmstat 1 2 2>/dev/null | tail -1"),
    }
    
    # ── RAM ──
    data["ram"] = {
        "free_m": run("free -m 2>/dev/null || vm_stat 2>/dev/null"),
        "meminfo": run("cat /proc/meminfo 2>/dev/null | grep -E 'MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree'"),
    }
    
    # ── Disk ──
    data["disk"] = {
        "space": run("df -hT / /tmp 2>/dev/null || df -h / /tmp 2>/dev/null"),
        "inodes": run("df -i / /tmp 2>/dev/null"),
    }
    
    # ── OS & Limits ──
    data["os"] = {
        "uname": run("uname -a"),
        "ulimit_n": run("ulimit -n"),
        "ulimit_u": run("ulimit -u"),
        "tcp_port_range": run("cat /proc/sys/net/ipv4/ip_local_port_range 2>/dev/null || sysctl net.inet.ip.portrange 2>/dev/null"),
        "tcp_max_syn_backlog": run("cat /proc/sys/net/ipv4/tcp_max_syn_backlog 2>/dev/null"),
        "somaxconn": run("cat /proc/sys/net/core/somaxconn 2>/dev/null || sysctl kern.ipc.somaxconn 2>/dev/null"),
    }
    
    # ── Docker ──
    data["docker"] = {
        "version": run("docker version --format '{{.Server.Version}}' 2>/dev/null || echo 'Not installed'"),
        "ps_count": run("docker ps -q 2>/dev/null | wc -l"),
        "images": run("docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}' 2>/dev/null"),
    }
    
    # ── Go Node Agent ──
    data["go_agent"] = {
        "ps": run("ps aux | grep node-agent | grep -v grep"),
    }
    
    print(json.dumps(data, indent=2))

if __name__ == "__main__":
    main()
