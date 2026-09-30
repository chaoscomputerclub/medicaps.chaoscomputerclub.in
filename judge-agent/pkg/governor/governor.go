package governor

import (
	"fmt"
	"os"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// TelemetrySnapshot represents point-in-time host metrics.
type TelemetrySnapshot struct {
	CPUUsagePct       float64 `json:"cpu_usage_pct"`
	MemoryUsagePct    float64 `json:"memory_usage_pct"`
	AvailableMemoryMB int64   `json:"available_memory_mb"`
	RunningJobs       int     `json:"running_jobs"`
	AvailableSlots    int     `json:"available_slots"`
	NetworkStatus     string  `json:"network_status"`
	DockerStatus      string  `json:"docker_status"`
}

// ResourceGovernor watches host vitals and gates job intake to prevent CPU/RAM thrashing.
type ResourceGovernor struct {
	maxConcurrency      int
	activeJobs          int32
	maxCPUPct           float64
	minMemHeadroomMB    int64
	mu                  sync.RWMutex
	lastSnapshot        TelemetrySnapshot
	prevCPUTotal        uint64
	prevCPUIdle         uint64
	stopCh              chan struct{}
}

// NewResourceGovernor initializes the governor with calculated hardware limits.
func NewResourceGovernor(maxConcurrency int, maxCPUPct float64, minMemHeadroomMB int64) *ResourceGovernor {
	if maxConcurrency < 1 {
		maxConcurrency = 1
	}
	g := &ResourceGovernor{
		maxConcurrency:   maxConcurrency,
		maxCPUPct:        maxCPUPct,
		minMemHeadroomMB: minMemHeadroomMB,
		stopCh:           make(chan struct{}),
	}
	g.updateMetrics()
	return g
}

// Start begins the background telemetry polling loop.
func (g *ResourceGovernor) Start(pollInterval time.Duration) {
	go func() {
		ticker := time.NewTicker(pollInterval)
		defer ticker.Stop()
		for {
			select {
			case <-g.stopCh:
				return
			case <-ticker.C:
				g.updateMetrics()
			}
		}
	}()
}

// Stop shuts down the background watcher.
func (g *ResourceGovernor) Stop() {
	close(g.stopCh)
}

// TryAcquireSlot atomically checks resource headroom and reserves an execution slot.
func (g *ResourceGovernor) TryAcquireSlot() bool {
	g.mu.RLock()
	snap := g.lastSnapshot
	g.mu.RUnlock()

	// 1. Backpressure guard: CPU over-threshold
	if snap.CPUUsagePct >= g.maxCPUPct {
		return false
	}

	// 2. Backpressure guard: low RAM headroom
	if snap.AvailableMemoryMB < g.minMemHeadroomMB {
		return false
	}

	// 3. Concurrency ceiling guard
	curr := atomic.LoadInt32(&g.activeJobs)
	if int(curr) >= g.maxConcurrency {
		return false
	}

	// Atomic increment
	return atomic.CompareAndSwapInt32(&g.activeJobs, curr, curr+1)
}

// ReleaseSlot releases a reserved execution slot.
func (g *ResourceGovernor) ReleaseSlot() {
	for {
		curr := atomic.LoadInt32(&g.activeJobs)
		if curr <= 0 {
			break
		}
		if atomic.CompareAndSwapInt32(&g.activeJobs, curr, curr-1) {
			break
		}
	}
}

// Snapshot returns the latest telemetry readings.
func (g *ResourceGovernor) Snapshot() TelemetrySnapshot {
	g.mu.RLock()
	defer g.mu.RUnlock()

	snap := g.lastSnapshot
	running := int(atomic.LoadInt32(&g.activeJobs))
	snap.RunningJobs = running
	avail := g.maxConcurrency - running
	if avail < 0 {
		avail = 0
	}
	snap.AvailableSlots = avail
	return snap
}

func (g *ResourceGovernor) updateMetrics() {
	cpuPct := g.sampleCPUUsage()
	totalMB, availMB := g.sampleMemory()

	var memPct float64 = 0.0
	if totalMB > 0 {
		memPct = float64(totalMB-availMB) / float64(totalMB) * 100.0
	}

	g.mu.Lock()
	defer g.mu.Unlock()

	running := int(atomic.LoadInt32(&g.activeJobs))
	availSlots := g.maxConcurrency - running
	if availSlots < 0 {
		availSlots = 0
	}

	g.lastSnapshot = TelemetrySnapshot{
		CPUUsagePct:       cpuPct,
		MemoryUsagePct:    memPct,
		AvailableMemoryMB: availMB,
		RunningJobs:       running,
		AvailableSlots:    availSlots,
		NetworkStatus:     "healthy",
		DockerStatus:      "healthy",
	}
}

func (g *ResourceGovernor) sampleCPUUsage() float64 {
	if runtime.GOOS != "linux" {
		return 15.0 // Nominal baseline on non-Linux
	}

	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0.0
	}

	lines := strings.Split(string(data), "\n")
	if len(lines) == 0 {
		return 0.0
	}

	fields := strings.Fields(lines[0])
	if len(fields) < 5 || fields[0] != "cpu" {
		return 0.0
	}

	var user, nice, system, idle, iowait, irq, softirq, steal uint64
	fmt.Sscanf(strings.Join(fields[1:], " "), "%d %d %d %d %d %d %d %d",
		&user, &nice, &system, &idle, &iowait, &irq, &softirq, &steal)

	idleAll := idle + iowait
	systemAll := system + irq + softirq
	total := user + nice + systemAll + idleAll + steal

	if g.prevCPUTotal == 0 {
		g.prevCPUTotal = total
		g.prevCPUIdle = idleAll
		return 0.0
	}

	totalDelta := total - g.prevCPUTotal
	idleDelta := idleAll - g.prevCPUIdle

	g.prevCPUTotal = total
	g.prevCPUIdle = idleAll

	if totalDelta == 0 {
		return 0.0
	}

	usage := float64(totalDelta-idleDelta) / float64(totalDelta) * 100.0
	if usage < 0 {
		usage = 0
	}
	if usage > 100 {
		usage = 100
	}
	return usage
}

func (g *ResourceGovernor) sampleMemory() (int64, int64) {
	if runtime.GOOS != "linux" {
		return 16384, 8192
	}

	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 4096, 2048
	}

	var totalMB, availMB int64
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		var val int64
		if strings.HasPrefix(line, "MemTotal:") {
			fmt.Sscanf(line, "MemTotal: %d kB", &val)
			totalMB = val / 1024
		} else if strings.HasPrefix(line, "MemAvailable:") {
			fmt.Sscanf(line, "MemAvailable: %d kB", &val)
			availMB = val / 1024
		}
	}

	return totalMB, availMB
}
