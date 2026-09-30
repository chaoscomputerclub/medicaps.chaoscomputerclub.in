package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"chaoscomputerclub.in/judge-agent/pkg/client"
	"chaoscomputerclub.in/judge-agent/pkg/config"
	"chaoscomputerclub.in/judge-agent/pkg/discovery"
	"chaoscomputerclub.in/judge-agent/pkg/executor"
	"chaoscomputerclub.in/judge-agent/pkg/governor"
	"chaoscomputerclub.in/judge-agent/pkg/network"
)

func main() {
	log.Println("=================================================================")
	log.Println("🛸 CHAOS COMPUTER CLUB — PORTABLE DISTRIBUTED COMPUTE FABRIC")
	log.Println("   Go Native Node Agent (Zero Python Dependency, In-Memory tmpfs)")
	log.Println("=================================================================")

	cfg := config.LoadFromEnv()

	// 1. Ensure RAM workspace (tmpfs) to protect USB flash from 4K write throttling
	if cfg.UseRAMTmpfs {
		if err := discovery.EnsureRAMWorkspace(cfg.WorkspaceBase); err != nil {
			log.Printf("⚠️  Notice: RAM workspace setup: %v", err)
		} else {
			log.Printf("⚡ In-memory RAM tmpfs active at: %s", cfg.WorkspaceBase)
		}
	}

	// 2. Hardware and environment auto-discovery
	log.Println("🔍 Probing host hardware, network, and container runtime...")
	caps, err := discovery.Discover(cfg.ControlPlaneURL, cfg.WorkspaceBase, cfg.AgentVersion, cfg.NodeID)
	if err != nil {
		log.Fatalf("❌ Hardware discovery failed: %v", err)
	}

	if cfg.DefaultConcurrency > 0 {
		caps.MaxConcurrency = cfg.DefaultConcurrency
	}

	log.Printf("💻 Node ID:         %s (%s)", caps.NodeID, caps.Hostname)
	log.Printf("🖥️  OS & Arch:       %s / %s", caps.OSName, caps.CPU.Architecture)
	log.Printf("⚙️  CPU:             %d physical cores, %d logical threads (%s)",
		caps.CPU.PhysicalCores, caps.CPU.LogicalCores, caps.CPU.Model)
	log.Printf("🧠 RAM:             %d MB Total, %d MB Available", caps.Memory.TotalMB, caps.Memory.AvailableMB)
	log.Printf("🐳 Docker Runtime:  %s (Healthy: %v)", caps.Container.Version, caps.Container.Healthy)
	log.Printf("🌐 Network:         Interface %s, Latency: %.1f ms", caps.Network.Interface, caps.Network.LatencyMS)
	log.Printf("🎯 Concurrency:     Auto-scaled to %d parallel execution slots", caps.MaxConcurrency)

	// 3. Initialize subsystems
	gov := governor.NewResourceGovernor(caps.MaxConcurrency, cfg.MaxCPUThresholdPct, cfg.MinMemoryHeadroomMB)
	gov.Start(1500 * time.Millisecond)
	defer gov.Stop()

	netMgr := network.NewManager(cfg.ControlPlaneURL)
	cpClient := client.NewControlPlaneClient(cfg.ControlPlaneURL, cfg.EnrollmentToken)
	dockerExec := executor.NewDockerExecutor(cfg.DockerBin, cfg.WorkspaceBase)

	// 4. Register with central control plane
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	log.Printf("🚀 Registering node %s with Control Plane (%s)...", caps.NodeID, cfg.ControlPlaneURL)
	regResp, err := cpClient.Register(ctx, caps)
	if err != nil {
		log.Printf("⚠️  Initial registration notice: %v. Retrying in background...", err)
	} else {
		log.Printf("✅ Registered with Control Plane! Status: %s, Assigned Concurrency: %d",
			regResp.Status, regResp.AssignedConcurrency)
	}

	// 5. Setup signal trap for graceful draining on USB removal or host shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	var wg sync.WaitGroup
	isDraining := false
	var drainMu sync.Mutex

	// 6. Start telemetry heartbeat loop (every 5s)
	go func() {
		ticker := time.NewTicker(cfg.HeartbeatInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				snap := gov.Snapshot()
				drainMu.Lock()
				draining := isDraining
				drainMu.Unlock()
				if draining {
					snap.DockerStatus = "draining"
				}
				if err := cpClient.Heartbeat(ctx, caps.NodeID, snap); err != nil {
					// Heartbeat failed, network manager will trigger reconnect if persistent
				}
			}
		}
	}()

	// 7. Start network monitor
	netMgr.Start(ctx, func() {
		log.Println("🌐 [Network] Connected to Control Plane. Resuming job claims.")
		_, _ = cpClient.Register(ctx, caps)
	}, func() {
		log.Println("⚠️  [Network] Connection lost. Entering exponential backoff reconnect...")
	})

	// 8. Bounded job claim & execution loop
	claimSem := make(chan struct{}, caps.MaxConcurrency)
	log.Printf("⚡ Ready to receive judge jobs! Worker pool active with %d bounded slots.", caps.MaxConcurrency)

	go func() {
		for {
			drainMu.Lock()
			draining := isDraining
			drainMu.Unlock()
			if draining {
				return
			}

			select {
			case <-ctx.Done():
				return
			default:
			}

			// Backpressure check before polling queue
			if !gov.TryAcquireSlot() {
				time.Sleep(400 * time.Millisecond)
				continue
			}

			// Atomic slot claim over outbound REST
			claimCtx, claimCancel := context.WithTimeout(ctx, 10*time.Second)
			job, err := cpClient.ClaimJob(claimCtx, caps.NodeID, cfg.ClaimTimeout.Seconds())
			claimCancel()

			if err != nil {
				gov.ReleaseSlot()
				log.Printf("⚠️  [Claim] Error polling queue: %v", err)
				time.Sleep(1 * time.Second)
				continue
			}

			if job == nil {
				// No job currently queued: release slot & wait briefly
				gov.ReleaseSlot()
				time.Sleep(1 * time.Second)
				continue
			}

			// Job claimed: dispatch worker goroutine
			claimSem <- struct{}{}
			wg.Add(1)

			go func(j *client.JobPayload) {
				defer func() {
					<-claimSem
					gov.ReleaseSlot()
					wg.Done()
				}()

				log.Printf("📥 [Job %s] Claimed. Starting isolated Docker execution...", j.JobID)
				res := dockerExec.Execute(ctx, j)
				log.Printf("📤 [Job %s] Completed with verdict: %s (Runtime: %.1fms)", j.JobID, res.Verdict, res.RuntimeMS)

				submitCtx, submitCancel := context.WithTimeout(ctx, 10*time.Second)
				defer submitCancel()
				if err := cpClient.SubmitResult(submitCtx, caps.NodeID, res); err != nil {
					log.Printf("⚠️  [Job %s] Error submitting result: %v", j.JobID, err)
				}
			}(job)
		}
	}()

	// Wait for shutdown signal
	sig := <-sigCh
	log.Printf("\n🛑 Caught signal %v! Commencing graceful node drain...", sig)

	drainMu.Lock()
	isDraining = true
	drainMu.Unlock()

	// Notify control plane of drain
	drainCtx, drainCancel := context.WithTimeout(context.Background(), 5*time.Second)
	_ = cpClient.Drain(drainCtx, caps.NodeID)
	drainCancel()

	// Wait for active jobs to finish (max 20s)
	doneCh := make(chan struct{})
	go func() {
		wg.Wait()
		close(doneCh)
	}()

	select {
	case <-doneCh:
		log.Println("✓ All in-flight jobs completed cleanly.")
	case <-time.After(20 * time.Second):
		log.Println("⚠️  Drain timeout reached. Terminating remaining workers.")
	}

	// Unregister from control plane
	unregCtx, unregCancel := context.WithTimeout(context.Background(), 5*time.Second)
	_ = cpClient.Unregister(unregCtx, caps.NodeID)
	unregCancel()

	log.Printf("👋 Node %s safely stopped. Machine left in clean state.", caps.NodeID)
	fmt.Println("Clean exit.")
}
