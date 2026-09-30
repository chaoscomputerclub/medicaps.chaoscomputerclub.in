package network

import (
	"context"
	"math/rand"
	"net/http"
	"sync"
	"time"
)

// State represents current connectivity state.
type State string

const (
	StateDisconnected State = "DISCONNECTED"
	StateConnecting   State = "CONNECTING"
	StateConnected    State = "CONNECTED"
	StateDegraded     State = "DEGRADED"
)

// Manager handles network health monitoring and exponential backoff reconnection.
type Manager struct {
	controlPlaneURL string
	state           State
	mu              sync.RWMutex
	client          *http.Client
	stopCh          chan struct{}
}

// NewManager creates a network connectivity monitor.
func NewManager(controlPlaneURL string) *Manager {
	return &Manager{
		controlPlaneURL: controlPlaneURL,
		state:           StateDisconnected,
		client: &http.Client{
			Timeout: 4 * time.Second,
		},
		stopCh: make(chan struct{}),
	}
}

// Start begins the network observation loop.
func (m *Manager) Start(ctx context.Context, onConnected func(), onDisconnected func()) {
	go func() {
		backoff := 1 * time.Second
		maxBackoff := 60 * time.Second

		for {
			select {
			case <-ctx.Done():
				return
			case <-m.stopCh:
				return
			default:
				alive, latency := m.probe()
				m.mu.Lock()
				prevState := m.state
				if alive {
					if latency > 1500*time.Millisecond {
						m.state = StateDegraded
					} else {
						m.state = StateConnected
					}
					backoff = 1 * time.Second // Reset on healthy connection
				} else {
					m.state = StateDisconnected
				}
				currState := m.state
				m.mu.Unlock()

				if prevState != currState {
					if currState == StateConnected || currState == StateDegraded {
						if onConnected != nil {
							onConnected()
						}
					} else if currState == StateDisconnected {
						if onDisconnected != nil {
							onDisconnected()
						}
					}
				}

				// Sleep with backoff if disconnected, else standard 5s check
				var sleepDuration time.Duration
				if currState == StateDisconnected {
					// Add 10-30% jitter to avoid thundering herd on network recovery
					jitter := time.Duration(rand.Float64() * float64(backoff) * 0.3)
					sleepDuration = backoff + jitter
					backoff *= 2
					if backoff > maxBackoff {
						backoff = maxBackoff
					}
				} else {
					sleepDuration = 5 * time.Second
				}

				select {
				case <-time.After(sleepDuration):
				case <-ctx.Done():
					return
				case <-m.stopCh:
					return
				}
			}
		}
	}()
}

// Stop terminates network monitoring.
func (m *Manager) Stop() {
	close(m.stopCh)
}

// GetState returns current connectivity state.
func (m *Manager) GetState() State {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.state
}

// IsConnected returns true if network is online.
func (m *Manager) IsConnected() bool {
	st := m.GetState()
	return st == StateConnected || st == StateDegraded
}

func (m *Manager) probe() (bool, time.Duration) {
	start := time.Now()
	resp, err := m.client.Get(m.controlPlaneURL + "/meta")
	if err != nil {
		return false, 0
	}
	defer resp.Body.Close()
	return resp.StatusCode < 500, time.Since(start)
}
