package networking

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Manager monitors link health and manages reconnects.
type Manager struct {
	controlPlaneURL string
	httpClient      *http.Client
	isOnline        bool
	mu              sync.RWMutex
	stopCh          chan struct{}
}

func NewManager(controlPlaneURL string) *Manager {
	return &Manager{
		controlPlaneURL: strings.TrimRight(controlPlaneURL, "/"),
		httpClient: &http.Client{
			Timeout: 3 * time.Second,
		},
		stopCh: make(chan struct{}),
	}
}

// Start runs background network monitor with exponential backoff and jitter.
func (m *Manager) Start(ctx context.Context, onConnect, onDisconnect func()) {
	go func() {
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()

		var backoff = 1 * time.Second
		const maxBackoff = 30 * time.Second

		for {
			select {
			case <-ctx.Done():
				return
			case <-m.stopCh:
				return
			case <-ticker.C:
				ok := m.probe()
				m.mu.Lock()
				wasOnline := m.isOnline
				m.isOnline = ok
				m.mu.Unlock()

				if ok && !wasOnline {
					backoff = 1 * time.Second
					if onConnect != nil {
						onConnect()
					}
				} else if !ok && wasOnline {
					if onDisconnect != nil {
						onDisconnect()
					}
				}

				if !ok {
					// Exponential backoff with full jitter
					jitter := time.Duration(rand.Int63n(int64(backoff)))
					sleepTime := backoff/2 + jitter
					time.Sleep(sleepTime)

					backoff *= 2
					if backoff > maxBackoff {
						backoff = maxBackoff
					}
				}
			}
		}
	}()
}

func (m *Manager) Stop() {
	select {
	case <-m.stopCh:
	default:
		close(m.stopCh)
	}
}

func (m *Manager) IsOnline() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.isOnline
}

func (m *Manager) probe() bool {
	url := fmt.Sprintf("%s/api/health", m.controlPlaneURL)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return false
	}
	resp, err := m.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}
