package heartbeat

import (
	"context"
	"log"
	"time"

	"chaoscomputerclub.in/node-agent/internal/governor"
	"chaoscomputerclub.in/node-agent/internal/registration"
)

// Reporter handles background heartbeat pings to the Control Plane.
type Reporter struct {
	nodeID   string
	interval time.Duration
	client   *registration.Client
	gov      *governor.ResourceGovernor
}

func NewReporter(nodeID string, interval time.Duration, client *registration.Client, gov *governor.ResourceGovernor) *Reporter {
	if interval <= 0 {
		interval = 5 * time.Second
	}
	return &Reporter{
		nodeID:   nodeID,
		interval: interval,
		client:   client,
		gov:      gov,
	}
}

// Start launches the heartbeat loop in a background goroutine until ctx is cancelled.
func (r *Reporter) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(r.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				snap := r.gov.Snapshot()
				hbCtx, cancel := context.WithTimeout(ctx, 4*time.Second)
				err := r.client.Heartbeat(hbCtx, r.nodeID, snap)
				cancel()

				if err != nil {
					log.Printf("⚠️  [Heartbeat] Telemetry ping failed: %v", err)
				}
			}
		}
	}()
}
