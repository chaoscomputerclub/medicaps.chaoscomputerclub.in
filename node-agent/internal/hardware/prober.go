package hardware

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// CPUCapability describes host CPU topology.
type CPUCapability struct {
	PhysicalCores int      `json:"physical_cores"`
	LogicalCores  int      `json:"logical_cores"`
	Architecture  string   `json:"architecture"`
	Model         string   `json:"model"`
	FrequencyMHz  *float64 `json:"frequency_mhz,omitempty"`
}

// MemoryCapability describes host RAM.
type MemoryCapability struct {
	TotalMB     int64 `json:"total_mb"`
	AvailableMB int64 `json:"available_mb"`
}

// StorageCapability describes workspace storage.
type StorageCapability struct {
	AvailableGB float64 `json:"available_gb"`
	USBMode     bool    `json:"usb_mode"`
}

// ContainerCapability describes Docker/container runtime.
type ContainerCapability struct {
	Runtime string `json:"runtime"`
	Version string `json:"version"`
	Healthy bool   `json:"healthy"`
}

// NetworkCapability describes network health and interface.
type NetworkCapability struct {
	Connected bool    `json:"connected"`
	Interface string  `json:"interface"`
	LatencyMS float64 `json:"latency_ms"`
}

// NodeCapabilities bundles full hardware profile and dynamic serving capacity.
type NodeCapabilities struct {
	NodeID          string            `json:"node_id"`
	Hostname        string            `json:"hostname"`
	OSName          string            `json:"os_name"`
	CPU             CPUCapability     `json:"cpu"`
	Memory          MemoryCapability  `json:"memory"`
	Storage         StorageCapability `json:"storage"`
	Container       ContainerCapability `json:"container"`
	Network         NetworkCapability `json:"network"`
	Capabilities    map[string]bool   `json:"capabilities"`
	MaxConcurrency  int               `json:"max_concurrency"`
	APICapacity     int               `json:"api_capacity"`
	SSECapacity     int               `json:"sse_capacity"`
	JudgeCapacity   int               `json:"judge_capacity"`
	Languages       []string          `json:"languages"`
	AgentVersion    string            `json:"agent_version"`
	ProtocolVersion string            `json:"protocol_version"`
}

// Discover probes host hardware, network, Docker runtime, and derives capacity.
func Discover(controlPlaneURL, workspaceBase, agentVersion, customNodeID string) (*NodeCapabilities, error) {
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "portable-node"
	}

	nodeID := customNodeID
	if nodeID == "" {
		nodeID = resolveNodeID()
	}

	cpuCap := detectCPU()
	memCap := detectMemory()
	storageCap := detectStorage(workspaceBase)
	containerCap := detectContainer()
	netCap := detectNetwork(controlPlaneURL)

	// Dynamic capacity derivation
	judgeSlots := deriveJudgeSlots(cpuCap.LogicalCores, memCap.AvailableMB, memCap.TotalMB)
	apiWorkers := deriveAPIWorkers(cpuCap.PhysicalCores)
	sseCapacity := deriveSSECapacity(memCap.TotalMB)

	caps := &NodeCapabilities{
		NodeID:   nodeID,
		Hostname: hostname,
		OSName:   runtime.GOOS,
		CPU:      cpuCap,
		Memory:   memCap,
		Storage:  storageCap,
		Container: containerCap,
		Network:  netCap,
		Capabilities: map[string]bool{
			"frontend": true,
			"api":      true,
			"sse":      true,
			"judge":    containerCap.Healthy,
		},
		MaxConcurrency:  judgeSlots,
		APICapacity:     apiWorkers,
		SSECapacity:     sseCapacity,
		JudgeCapacity:   judgeSlots,
		Languages:       []string{"python", "javascript", "typescript", "cpp", "c", "java", "go", "rust"},
		AgentVersion:    agentVersion,
		ProtocolVersion: "2.0",
	}

	return caps, nil
}

func deriveJudgeSlots(logicalCores int, availMB, totalMB int64) int {
	if logicalCores <= 0 {
		logicalCores = 1
	}
	byCore := int(float64(logicalCores) * 0.6)
	if byCore < 1 {
		byCore = 1
	}
	byMem := int((availMB - 1024) / 512)
	if byMem < 1 {
		byMem = 1
	}
	slots := byCore
	if byMem < slots {
		slots = byMem
	}
	if slots > 16 {
		slots = 16
	}
	if slots < 1 {
		slots = 1
	}
	return slots
}

func deriveAPIWorkers(physicalCores int) int {
	if physicalCores <= 0 {
		physicalCores = 1
	}
	w := physicalCores / 2
	if w < 1 {
		w = 1
	}
	if w > 4 {
		w = 4
	}
	return w
}

func deriveSSECapacity(totalMB int64) int {
	cap := int(float64(totalMB) * 0.15)
	if cap < 300 {
		cap = 300
	}
	if cap > 2000 {
		cap = 2000
	}
	return cap
}

func resolveNodeID() string {
	cachedPath := filepath.Join(os.TempDir(), "ccc_node_id")
	if data, err := os.ReadFile(cachedPath); err == nil {
		id := strings.TrimSpace(string(data))
		if strings.HasPrefix(id, "node_") && len(id) == 17 {
			return id
		}
	}

	raw := fmt.Sprintf("%s-%s-%s-%d", runtime.GOOS, runtime.GOARCH, getMachineIDSeed(), os.Getpid())
	hash := sha256.Sum256([]byte(raw))
	id := fmt.Sprintf("node_%s", hex.EncodeToString(hash[:])[:12])
	_ = os.WriteFile(cachedPath, []byte(id), 0644)
	return id
}

func getMachineIDSeed() string {
	for _, p := range []string{"/etc/machine-id", "/var/lib/dbus/machine-id"} {
		if data, err := os.ReadFile(p); err == nil {
			return strings.TrimSpace(string(data))
		}
	}
	if ifaces, err := net.Interfaces(); err == nil {
		for _, iface := range ifaces {
			if len(iface.HardwareAddr) > 0 {
				return iface.HardwareAddr.String()
			}
		}
	}
	return "generic-hardware-seed"
}

func detectCPU() CPUCapability {
	logical := runtime.NumCPU()
	physical := logical
	model := "Generic CPU"

	if runtime.GOOS == "linux" {
		if data, err := os.ReadFile("/proc/cpuinfo"); err == nil {
			lines := strings.Split(string(data), "\n")
			coreIDs := make(map[string]bool)
			for _, line := range lines {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					key := strings.TrimSpace(parts[0])
					val := strings.TrimSpace(parts[1])
					if key == "model name" && model == "Generic CPU" {
						model = val
					}
					if key == "core id" {
						coreIDs[val] = true
					}
				}
			}
			if len(coreIDs) > 0 {
				physical = len(coreIDs)
			}
		}
	} else if runtime.GOOS == "darwin" {
		if out, err := exec.Command("sysctl", "-n", "machdep.cpu.brand_string").Output(); err == nil {
			model = strings.TrimSpace(string(out))
		}
		if out, err := exec.Command("sysctl", "-n", "hw.physicalcpu").Output(); err == nil {
			if p, err := strconv.Atoi(strings.TrimSpace(string(out))); err == nil && p > 0 {
				physical = p
			}
		}
	}

	return CPUCapability{
		PhysicalCores: physical,
		LogicalCores:  logical,
		Architecture:  runtime.GOARCH,
		Model:         model,
	}
}

func detectMemory() MemoryCapability {
	var totalMB int64 = 4096
	var availMB int64 = 2048

	if runtime.GOOS == "linux" {
		if data, err := os.ReadFile("/proc/meminfo"); err == nil {
			lines := strings.Split(string(data), "\n")
			for _, line := range lines {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					val, _ := strconv.ParseInt(parts[1], 10, 64)
					if strings.HasPrefix(parts[0], "MemTotal:") {
						totalMB = val / 1024
					} else if strings.HasPrefix(parts[0], "MemAvailable:") {
						availMB = val / 1024
					}
				}
			}
		}
	} else if runtime.GOOS == "darwin" {
		if out, err := exec.Command("sysctl", "-n", "hw.memsize").Output(); err == nil {
			if bytesVal, err := strconv.ParseInt(strings.TrimSpace(string(out)), 10, 64); err == nil {
				totalMB = bytesVal / (1024 * 1024)
				availMB = int64(float64(totalMB) * 0.6)
			}
		}
	}

	return MemoryCapability{
		TotalMB:     totalMB,
		AvailableMB: availMB,
	}
}

func detectContainer() ContainerCapability {
	dockerBin, err := exec.LookPath("docker")
	if err != nil {
		return ContainerCapability{Runtime: "docker", Version: "not_installed", Healthy: false}
	}
	out, err := exec.Command(dockerBin, "--version").Output()
	if err != nil {
		return ContainerCapability{Runtime: "docker", Version: "unavailable", Healthy: false}
	}
	vStr := strings.TrimSpace(string(out))
	err = exec.Command(dockerBin, "info").Run()
	healthy := (err == nil)

	return ContainerCapability{
		Runtime: "docker",
		Version: vStr,
		Healthy: healthy,
	}
}

func detectNetwork(cpURL string) NetworkCapability {
	ifaceName := "eth0"
	if ifaces, err := net.Interfaces(); err == nil {
		for _, iface := range ifaces {
			if iface.Flags&net.FlagUp != 0 && iface.Flags&net.FlagLoopback == 0 {
				ifaceName = iface.Name
				break
			}
		}
	}

	start := time.Now()
	client := http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(fmt.Sprintf("%s/api/health", strings.TrimRight(cpURL, "/")))
	latency := float64(time.Since(start).Milliseconds())

	connected := false
	if err == nil && resp != nil {
		connected = (resp.StatusCode == http.StatusOK)
		_ = resp.Body.Close()
	}

	return NetworkCapability{
		Connected: connected,
		Interface: ifaceName,
		LatencyMS: latency,
	}
}
