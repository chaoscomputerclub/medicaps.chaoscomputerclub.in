package governor

import (
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"chaoscomputerclub.in/node-agent/internal/registration"
)

// ResourceGovernor regulates local execution slots and protects physical resources.
type ResourceGovernor struct {
	mu sync.RWMutex

	maxConcurrency      int
	activeSlots         int
	activeAPIRequests   int
	activeSSEStreams    int
	maxCPUThresholdPct  float64
	minMemoryHeadroomMB int64

	currentCPUUsagePct  float64
	currentMemUsagePct  float64
	availableMemoryMB   int64

	lastCPUTotal uint64
	lastCPUIdle  uint64

	dockerStatus  string
	networkStatus string
	inBackpressure bool
	normalCycles   int

	stopCh chan struct{}
}

func NewResourceGovernor(maxConcurrency int, maxCPU float64, minMemMB int64) *ResourceGovernor {
	if maxCPU <= 0 {
		maxCPU = 85.0
	}
	if minMemMB <= 0 {
		minMemMB = 1024
	}
	if maxConcurrency <= 0 {
		maxConcurrency = 4
	}

	return &ResourceGovernor{
		maxConcurrency:      maxConcurrency,
		maxCPUThresholdPct:  maxCPU,
		minMemoryHeadroomMB: minMemMB,
		dockerStatus:        "healthy",
		networkStatus:       "healthy",
		stopCh:              make(chan struct{}),
	}
}

func (g *ResourceGovernor) Start(interval time.Duration) {
	if interval <= 0 {
		interval = 1500 * time.Millisecond
	}
	go g.samplingLoop(interval)
}

func (g *ResourceGovernor) Stop() {
	select {
	case <-g.stopCh:
	default:
		close(g.stopCh)
	}
}

func (g *ResourceGovernor) CanAcquireSlot() bool {
	g.mu.RLock()
	defer g.mu.RUnlock()

	if g.inBackpressure {
		return false
	}
	return g.activeSlots < g.maxConcurrency
}

func (g *ResourceGovernor) TryAcquireSlot() bool {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.inBackpressure {
		return false
	}
	if g.activeSlots >= g.maxConcurrency {
		return false
	}
	g.activeSlots++
	return true
}

func (g *ResourceGovernor) ReleaseSlot() {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.activeSlots > 0 {
		g.activeSlots--
	}
}

func (g *ResourceGovernor) IncAPIRequests() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.activeAPIRequests++
}

func (g *ResourceGovernor) DecAPIRequests() {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.activeAPIRequests > 0 {
		g.activeAPIRequests--
	}
}

func (g *ResourceGovernor) IncSSEStreams() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.activeSSEStreams++
}

func (g *ResourceGovernor) DecSSEStreams() {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.activeSSEStreams > 0 {
		g.activeSSEStreams--
	}
}

func (g *ResourceGovernor) SetDockerStatus(status string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.dockerStatus = status
}

func (g *ResourceGovernor) SetNetworkStatus(status string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.networkStatus = status
}

func (g *ResourceGovernor) Snapshot() *registration.TelemetrySnapshot {
	g.mu.RLock()
	defer g.mu.RUnlock()

	availSlots := g.maxConcurrency - g.activeSlots
	if availSlots < 0 {
		availSlots = 0
	}

	return &registration.TelemetrySnapshot{
		CPUUsagePct:       g.currentCPUUsagePct,
		MemoryUsagePct:    g.currentMemUsagePct,
		AvailableMemoryMB: g.availableMemoryMB,
		RunningJobs:       g.activeSlots,
		AvailableSlots:    availSlots,
		APIActive:         g.activeAPIRequests,
		SSEActive:         g.activeSSEStreams,
		JudgeActive:       g.activeSlots,
		NetworkStatus:     g.networkStatus,
		DockerStatus:      g.dockerStatus,
	}
}

func (g *ResourceGovernor) samplingLoop(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-g.stopCh:
			return
		case <-ticker.C:
			g.sample()
		}
	}
}

func (g *ResourceGovernor) sample() {
	cpuUsage := g.sampleCPU()
	memUsage, availMB := g.sampleMemory()

	g.mu.Lock()
	g.currentCPUUsagePct = cpuUsage
	g.currentMemUsagePct = memUsage
	g.availableMemoryMB = availMB

	// Backpressure check with hysteresis
	isPressure := (cpuUsage >= g.maxCPUThresholdPct) || (availMB < g.minMemoryHeadroomMB)
	if isPressure {
		g.inBackpressure = true
		g.normalCycles = 0
	} else {
		g.normalCycles++
		if g.normalCycles >= 3 {
			g.inBackpressure = false
		}
	}
	g.mu.Unlock()
}

func (g *ResourceGovernor) sampleCPU() float64 {
	if runtime.GOOS != "linux" {
		return 15.0
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

	var total uint64 = 0
	var idle uint64 = 0

	for i, f := range fields[1:] {
		val, _ := strconv.ParseUint(f, 10, 64)
		total += val
		if i == 3 { // idle field
			idle = val
		}
	}

	g.mu.Lock()
	defer g.mu.Unlock()

	deltaTotal := total - g.lastCPUTotal
	deltaIdle := idle - g.lastCPUIdle

	g.lastCPUTotal = total
	g.lastCPUIdle = idle

	if deltaTotal == 0 {
		return 0.0
	}
	used := float64(deltaTotal-deltaIdle) / float64(deltaTotal) * 100.0
	if used < 0.0 {
		used = 0.0
	}
	if used > 100.0 {
		used = 100.0
	}
	return used
}

func (g *ResourceGovernor) sampleMemory() (float64, int64) {
	if runtime.GOOS == "linux" {
		data, err := os.ReadFile("/proc/meminfo")
		if err == nil {
			var totalKB, availKB int64
			for _, line := range strings.Split(string(data), "\n") {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					val, _ := strconv.ParseInt(parts[1], 10, 64)
					if strings.HasPrefix(parts[0], "MemTotal:") {
						totalKB = val
					} else if strings.HasPrefix(parts[0], "MemAvailable:") {
						availKB = val
					}
				}
			}
			if totalKB > 0 {
				usedPct := float64(totalKB-availKB) / float64(totalKB) * 100.0
				return usedPct, availKB / 1024
			}
		}
	} else if runtime.GOOS == "darwin" {
		if out, err := exec.Command("sysctl", "-n", "hw.memsize").Output(); err == nil {
			if totalBytes, err := strconv.ParseInt(strings.TrimSpace(string(out)), 10, 64); err == nil {
				totalMB := totalBytes / (1024 * 1024)
				availMB := int64(float64(totalMB) * 0.6)
				return 40.0, availMB
			}
		}
	}

	return 25.0, 4096
}
