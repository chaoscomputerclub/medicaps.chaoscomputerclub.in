package main

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"chaoscomputerclub.in/node-agent/internal/docker"
	"chaoscomputerclub.in/node-agent/internal/governor"
	"chaoscomputerclub.in/node-agent/internal/hardware"
	"chaoscomputerclub.in/node-agent/internal/heartbeat"
	"chaoscomputerclub.in/node-agent/internal/networking"
	"chaoscomputerclub.in/node-agent/internal/registration"
	"chaoscomputerclub.in/node-agent/internal/scheduler"
	"chaoscomputerclub.in/node-agent/internal/security"
	"chaoscomputerclub.in/node-agent/internal/workers"
)

type Config struct {
	ControlPlaneURL     string
	EnrollmentToken     string
	NodeID              string
	WorkspaceBase       string
	UseRAMTmpfs         bool
	DistDir             string
	StaticPort          int
	HeartbeatInterval   time.Duration
	MaxCPUThresholdPct  float64
	MinMemoryHeadroomMB int64
	AgentVersion        string
}

func parseEnvFile(paths ...string) {
	for _, p := range paths {
		f, err := os.Open(p)
		if err != nil {
			continue
		}
		defer f.Close()
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				k := strings.TrimSpace(parts[0])
				v := strings.TrimSpace(parts[1])
				v = strings.Trim(v, `"'`)
				if os.Getenv(k) == "" {
					os.Setenv(k, v)
				}
			}
		}
		break
	}
}

func loadConfig() Config {
	parseEnvFile("node.env", "config/node.env", "../config/node.env", "/opt/ccc-node/config/node.env")

	cpURL := os.Getenv("CONTROL_PLANE_URL")
	if cpURL == "" {
		cpURL = "https://medicaps-api.chaoscomputerclub.in"
	}

	token := os.Getenv("ENROLLMENT_TOKEN")
	if token == "" {
		token = os.Getenv("JUDGE_AGENT_SECRET")
	}

	wsBase := os.Getenv("WORKSPACE_BASE")
	if wsBase == "" {
		wsBase = "/tmp/ccc_workspaces"
	}

	useRAM := true
	if val := os.Getenv("USE_RAM_TMPFS"); val != "" {
		useRAM = (val == "true" || val == "1")
	}

	distDir := os.Getenv("DIST_DIR")
	if distDir == "" {
		distDir = "./dist"
	}

	staticPort := 8085
	if val := os.Getenv("STATIC_PORT"); val != "" {
		if p, err := strconv.Atoi(val); err == nil && p > 0 {
			staticPort = p
		}
	}

	hbInterval := 5 * time.Second
	if val := os.Getenv("HEARTBEAT_INTERVAL_S"); val != "" {
		if sec, err := strconv.Atoi(val); err == nil && sec > 0 {
			hbInterval = time.Duration(sec) * time.Second
		}
	}

	maxCPU := 85.0
	if val := os.Getenv("MAX_CPU_THRESHOLD_PCT"); val != "" {
		if v, err := strconv.ParseFloat(val, 64); err == nil && v > 0 {
			maxCPU = v
		}
	}

	minMem := int64(1024)
	if val := os.Getenv("MIN_MEMORY_HEADROOM_MB"); val != "" {
		if v, err := strconv.ParseInt(val, 10, 64); err == nil && v > 0 {
			minMem = v
		}
	}

	return Config{
		ControlPlaneURL:     cpURL,
		EnrollmentToken:     token,
		NodeID:              os.Getenv("NODE_ID"),
		WorkspaceBase:       wsBase,
		UseRAMTmpfs:         useRAM,
		DistDir:             distDir,
		StaticPort:          staticPort,
		HeartbeatInterval:   hbInterval,
		MaxCPUThresholdPct:  maxCPU,
		MinMemoryHeadroomMB: minMem,
		AgentVersion:        "2.1.0",
	}
}

func main() {
	log.Println("=================================================================")
	log.Println("🛸 CHAOS COMPUTER CLUB — GLOBAL DISTRIBUTED COMPUTE FABRIC")
	log.Println("   Dynamic Node Agent Daemon v2.1.0 (Zero-Inbound-Port Architecture)")
	log.Println("=================================================================")

	cfg := loadConfig()

	// 1. Prepare in-memory RAM tmpfs workspace
	if cfg.UseRAMTmpfs {
		if err := hardware.EnsureRAMWorkspace(cfg.WorkspaceBase); err != nil {
			log.Printf("⚠️  Notice: RAM workspace setup: %v", err)
		} else {
			log.Printf("⚡ In-memory RAM tmpfs active at: %s", cfg.WorkspaceBase)
		}
	}

	// 2. Hardware auto-discovery & dynamic capacity derivation
	log.Println("🔍 Probing host hardware, network, and container runtime...")
	caps, err := hardware.Discover(cfg.ControlPlaneURL, cfg.WorkspaceBase, cfg.AgentVersion, cfg.NodeID)
	if err != nil {
		log.Fatalf("❌ Hardware discovery failed: %v", err)
	}

	log.Printf("💻 Node ID:         %s (%s)", caps.NodeID, caps.Hostname)
	log.Printf("🖥️  OS & Arch:       %s / %s", caps.OSName, caps.CPU.Architecture)
	log.Printf("⚙️  CPU:             %d physical cores, %d logical threads (%s)",
		caps.CPU.PhysicalCores, caps.CPU.LogicalCores, caps.CPU.Model)
	log.Printf("🧠 RAM:             %d MB Total, %d MB Available", caps.Memory.TotalMB, caps.Memory.AvailableMB)
	log.Printf("🐳 Docker Runtime:  %s (Healthy: %v)", caps.Container.Version, caps.Container.Healthy)
	log.Printf("🌐 Network:         Interface %s, Latency: %.1f ms", caps.Network.Interface, caps.Network.LatencyMS)
	log.Printf("🎯 Derived Capacity: %d Judge Slots | %d API Workers | %d SSE Conns",
		caps.JudgeCapacity, caps.APICapacity, caps.SSECapacity)

	// 3. Initialize subsystems
	gov := governor.NewResourceGovernor(caps.MaxConcurrency, cfg.MaxCPUThresholdPct, cfg.MinMemoryHeadroomMB)
	gov.Start(1500 * time.Millisecond)
	defer gov.Stop()

	lb := scheduler.NewLocalLoadBalancer(gov)
	cpClient := registration.NewClient(cfg.ControlPlaneURL, cfg.EnrollmentToken)
	dockerExec := docker.NewExecutor("docker", cfg.WorkspaceBase)
	workerMgr := workers.NewManager(caps.NodeID, lb, gov, cpClient, dockerExec, caps.MaxConcurrency)
	netMgr := networking.NewManager(cfg.ControlPlaneURL)
	hbReporter := heartbeat.NewReporter(caps.NodeID, cfg.HeartbeatInterval, cpClient, gov)
	lifecycle := security.NewLifecycleCoordinator(caps.NodeID, cpClient, workerMgr, cfg.WorkspaceBase, 20*time.Second)

	// 4. Register with central control plane
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	log.Printf("🚀 Registering node %s with Control Plane (%s)...", caps.NodeID, cfg.ControlPlaneURL)
	regResp, err := cpClient.Register(ctx, caps)
	if err != nil {
		log.Printf("⚠️  Initial registration notice: %v. Retrying in background...", err)
	} else {
		log.Printf("✅ Registered with Control Plane! Status: %s, Queue: %s, Concurrency: %d",
			regResp.Status, regResp.QueueName, regResp.AssignedConcurrency)
	}

	// 5. Start background telemetry heartbeat loop (every 5s)
	hbReporter.Start(ctx)

	// 6. Start network monitor
	netMgr.Start(ctx, func() {
		log.Println("🌐 [Network] Connected to Control Plane. Reconciling node state...")
		_, _ = cpClient.Register(ctx, caps)
	}, func() {
		log.Println("⚠️  [Network] Connection lost. Entering exponential backoff reconnect...")
	})

	// 7. Start local Static Frontend Server (if dist exists)
	_ = workerMgr.StartStaticServer(cfg.DistDir, cfg.StaticPort)

	// 8. Start Judge Worker pool
	workerMgr.StartJudgeWorkers(ctx)

	log.Printf("🚀 [Fabric] Node %s is live and ready in global compute fabric!", caps.NodeID)

	// 9. Block on shutdown signal trap
	lifecycle.WaitForShutdown()
	fmt.Println("Clean exit.")
}
