package scheduler

import (
	"sync/atomic"
	"testing"

	"chaoscomputerclub.in/node-agent/internal/governor"
)

func TestLocalLoadBalancer(t *testing.T) {
	gov := governor.NewResourceGovernor(4, 85.0, 1024)
	lb := NewLocalLoadBalancer(gov)

	lb.RegisterWorker("api-1", "api", "http://127.0.0.1:8081")
	lb.RegisterWorker("api-2", "api", "http://127.0.0.1:8082")

	w, err := lb.SelectWorker("api")
	if err != nil {
		t.Fatalf("Failed to select worker: %v", err)
	}
	if w.WorkerType != "api" {
		t.Errorf("Expected api worker, got %s", w.WorkerType)
	}

	// Artificially increase load on w
	atomic.AddInt64(&w.ActiveRequests, 5)

	// Next selection should pick the other worker
	w2, err := lb.SelectWorker("api")
	if err != nil {
		t.Fatalf("Failed to select worker: %v", err)
	}
	if w2.ID == w.ID {
		t.Errorf("Expected load balancer to select least-loaded worker, but selected same worker %s", w2.ID)
	}

	// Missing worker type should error
	_, err = lb.SelectWorker("non-existent")
	if err == nil {
		t.Error("Expected error selecting non-existent worker type")
	}
}
