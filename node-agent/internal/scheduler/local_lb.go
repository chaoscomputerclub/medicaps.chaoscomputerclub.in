package scheduler

import (
	"fmt"
	"sync"
	"sync/atomic"

	"chaoscomputerclub.in/node-agent/internal/governor"
)

// WorkerState tracks the health and active connections of a local worker process.
type WorkerState struct {
	ID             string
	WorkerType     string // "api", "static", "sse", "judge"
	TargetURL      string
	ActiveRequests int64
	Healthy        bool
}

// LocalLoadBalancer routes incoming tunnel requests and judge jobs among local worker processes.
type LocalLoadBalancer struct {
	mu       sync.RWMutex
	workers  []*WorkerState
	rrIndex  uint64
	governor *governor.ResourceGovernor
}

func NewLocalLoadBalancer(gov *governor.ResourceGovernor) *LocalLoadBalancer {
	return &LocalLoadBalancer{
		workers:  make([]*WorkerState, 0),
		governor: gov,
	}
}

func (lb *LocalLoadBalancer) RegisterWorker(id, wType, targetURL string) {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	lb.workers = append(lb.workers, &WorkerState{
		ID:         id,
		WorkerType: wType,
		TargetURL:  targetURL,
		Healthy:    true,
	})
}

func (lb *LocalLoadBalancer) UnregisterWorker(id string) {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	filtered := make([]*WorkerState, 0, len(lb.workers))
	for _, w := range lb.workers {
		if w.ID != id {
			filtered = append(filtered, w)
		}
	}
	lb.workers = filtered
}

// SelectWorker picks the least-loaded healthy worker matching wType.
func (lb *LocalLoadBalancer) SelectWorker(wType string) (*WorkerState, error) {
	lb.mu.RLock()
	defer lb.mu.RUnlock()

	var candidate *WorkerState
	var minActive int64 = 1<<62 - 1

	for _, w := range lb.workers {
		if w.WorkerType == wType && w.Healthy {
			active := atomic.LoadInt64(&w.ActiveRequests)
			if active < minActive {
				minActive = active
				candidate = w
			}
		}
	}

	if candidate == nil {
		return nil, fmt.Errorf("no healthy worker available for type: %s", wType)
	}

	return candidate, nil
}
