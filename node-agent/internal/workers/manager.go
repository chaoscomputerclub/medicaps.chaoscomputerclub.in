package workers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"chaoscomputerclub.in/node-agent/internal/docker"
	"chaoscomputerclub.in/node-agent/internal/governor"
	"chaoscomputerclub.in/node-agent/internal/registration"
	"chaoscomputerclub.in/node-agent/internal/scheduler"
)

// Manager coordinates local workers (Static, API, SSE, Judge).
type Manager struct {
	nodeID        string
	lb            *scheduler.LocalLoadBalancer
	gov           *governor.ResourceGovernor
	client        *registration.Client
	executor      *docker.Executor
	staticServer  *http.Server
	staticPort    int
	maxConcurrent int

	claimSem chan struct{}
	wg       sync.WaitGroup
	stopCh   chan struct{}
}

func NewManager(
	nodeID string,
	lb *scheduler.LocalLoadBalancer,
	gov *governor.ResourceGovernor,
	client *registration.Client,
	executor *docker.Executor,
	maxConcurrent int,
) *Manager {
	return &Manager{
		nodeID:        nodeID,
		lb:            lb,
		gov:           gov,
		client:        client,
		executor:      executor,
		maxConcurrent: maxConcurrent,
		claimSem:      make(chan struct{}, maxConcurrent),
		stopCh:        make(chan struct{}),
	}
}

// StartStaticServer starts a lightweight in-process HTTP static file server
// serving Vite frontend assets if a dist folder is present on the USB/disk.
func (m *Manager) StartStaticServer(distDir string, port int) error {
	if _, err := os.Stat(distDir); err != nil {
		// No local dist folder; node will not serve static assets locally
		return nil
	}

	m.staticPort = port
	mux := http.NewServeMux()
	fs := http.FileServer(http.Dir(distDir))
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// SPA fallback: if file does not exist, serve index.html
		path := filepath.Join(distDir, filepath.Clean(r.URL.Path))
		if _, err := os.Stat(path); os.IsNotExist(err) {
			http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
			return
		}
		fs.ServeHTTP(w, r)
	}))

	server := &http.Server{
		Addr:    fmt.Sprintf("127.0.0.1:%d", port),
		Handler: mux,
	}
	m.staticServer = server

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("⚠️  [Static Server] Exited: %v", err)
		}
	}()

	m.lb.RegisterWorker("static-1", "static", fmt.Sprintf("http://127.0.0.1:%d", port))
	log.Printf("🌐 [Static Server] Serving frontend assets from %s on :%d", distDir, port)
	return nil
}

// StartJudgeWorkers starts the outbound polling worker loop for claiming execution jobs.
func (m *Manager) StartJudgeWorkers(ctx context.Context) {
	log.Printf("⚡ [Judge Workers] Started worker pool with %d bounded slots", m.maxConcurrent)

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-m.stopCh:
				return
			default:
			}

			// Backpressure check before polling
			if !m.gov.TryAcquireSlot() {
				time.Sleep(300 * time.Millisecond)
				continue
			}

			claimCtx, claimCancel := context.WithTimeout(ctx, 8*time.Second)
			job, err := m.client.ClaimJob(claimCtx, m.nodeID, 2.0)
			claimCancel()

			if err != nil {
				m.gov.ReleaseSlot()
				time.Sleep(1 * time.Second)
				continue
			}

			if job == nil {
				m.gov.ReleaseSlot()
				time.Sleep(1 * time.Second)
				continue
			}

			// Job claimed: spawn execution goroutine
			m.claimSem <- struct{}{}
			m.wg.Add(1)

			go func(j *registration.JobPayload) {
				defer func() {
					<-m.claimSem
					m.gov.ReleaseSlot()
					m.wg.Done()
				}()

				log.Printf("📥 [Job %s] Claimed (%s). Running isolated execution...", j.JobID, j.JobType)
				res := m.executor.Execute(ctx, j)
				log.Printf("📤 [Job %s] Finished: %s (Runtime: %.1fms)", j.JobID, res.Verdict, res.RuntimeMS)

				subCtx, subCancel := context.WithTimeout(ctx, 10*time.Second)
				defer subCancel()
				if err := m.client.SubmitResult(subCtx, m.nodeID, res); err != nil {
					log.Printf("⚠️  [Job %s] Result submission error: %v", j.JobID, err)
				}
			}(job)
		}
	}()
}

// Stop gracefully stops workers and waits for in-flight executions to finish.
func (m *Manager) Stop(timeout time.Duration) {
	close(m.stopCh)
	if m.staticServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		_ = m.staticServer.Shutdown(ctx)
		cancel()
	}

	done := make(chan struct{})
	go func() {
		m.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		log.Println("✓ All in-flight judge jobs completed cleanly.")
	case <-time.After(timeout):
		log.Println("⚠️  Drain timeout reached waiting for active jobs.")
	}
}
