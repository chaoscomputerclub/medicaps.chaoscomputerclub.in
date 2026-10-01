package security

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"chaoscomputerclub.in/node-agent/internal/registration"
	"chaoscomputerclub.in/node-agent/internal/workers"
)

// LifecycleCoordinator handles signal traps, graceful node draining, and teardown.
type LifecycleCoordinator struct {
	nodeID        string
	client        *registration.Client
	workerMgr     *workers.Manager
	workspaceBase string
	drainTimeout  time.Duration
}

func NewLifecycleCoordinator(
	nodeID string,
	client *registration.Client,
	workerMgr *workers.Manager,
	workspaceBase string,
	drainTimeout time.Duration,
) *LifecycleCoordinator {
	if drainTimeout <= 0 {
		drainTimeout = 20 * time.Second
	}
	return &LifecycleCoordinator{
		nodeID:        nodeID,
		client:        client,
		workerMgr:     workerMgr,
		workspaceBase: workspaceBase,
		drainTimeout:  drainTimeout,
	}
}

// WaitForShutdown blocks until SIGINT or SIGTERM is caught, then executes graceful drain.
func (lc *LifecycleCoordinator) WaitForShutdown() {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	sig := <-sigCh
	log.Printf("\n🛑 Caught signal %v! Commencing graceful node drain...", sig)

	// 1. Notify control plane of drain
	drainCtx, drainCancel := context.WithTimeout(context.Background(), 5*time.Second)
	_ = lc.client.Drain(drainCtx, lc.nodeID)
	drainCancel()

	// 2. Stop workers and drain in-flight jobs
	lc.workerMgr.Stop(lc.drainTimeout)

	// 3. Unregister from control plane
	unregCtx, unregCancel := context.WithTimeout(context.Background(), 5*time.Second)
	_ = lc.client.Unregister(unregCtx, lc.nodeID)
	unregCancel()

	// 4. Clean RAM workspace
	if lc.workspaceBase != "" && lc.workspaceBase != "/" {
		_ = os.RemoveAll(lc.workspaceBase)
	}

	log.Printf("👋 Node %s safely stopped. Machine left in clean state.", lc.nodeID)
}
