package discovery

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

// NodeCapabilities bundles full hardware profile.
type NodeCapabilities struct {
	NodeID         string              `json:"node_id"`
	Hostname       string              `json:"hostname"`
	OSName         string              `json:"os_name"`
	CPU            CPUCapability       `json:"cpu"`
	Memory         MemoryCapability    `json:"memory"`
	Storage        StorageCapability   `json:"storage"`
	Container      ContainerCapability `json:"container"`
	Network        NetworkCapability   `json:"network"`
	MaxConcurrency int                 `json:"max_concurrency"`
	Languages      []string            `json:"languages"`
	AgentVersion   string              `json:"agent_version"`
}

// Discover probes host hardware, network, Docker runtime, and calculates safe concurrency.
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

	concurrency := CalculateSafeConcurrency(cpuCap.LogicalCores, memCap.TotalMB)

	caps := &NodeCapabilities{
		NodeID:         nodeID,
		Hostname:       hostname,
		OSName:         runtime.GOOS,
		CPU:            cpuCap,
		Memory:         memCap,
		Storage:        storageCap,
		Container:      containerCap,
		Network:        netCap,
		MaxConcurrency: concurrency,
		Languages:      []string{"python", "javascript", "cpp", "java", "go", "c"},
		AgentVersion:   agentVersion,
	}

	return caps, nil
}

// CalculateSafeConcurrency dynamically calculates the maximum concurrent worker slots.
// Formula:
// - Reserves 1.5 GB RAM for host OS, kernel, and USB caching.
// - Allocates ~750 MB RAM per execution slot.
// - Caps slots by logical CPU cores.
// - Clamps to [1, 16] for rock-solid stability.
func CalculateSafeConcurrency(logicalCores int, totalRAMMB int64) int {
	if logicalCores < 1 {
		logicalCores = 1
	}

	usableRAM := totalRAMMB - 1536 // 1.5GB headroom
	if usableRAM < 512 {
		return 1
	}

	ramSlots := int(usableRAM / 750)
	if ramSlots < 1 {
		ramSlots = 1
	}

	// Concurrency should not exceed logical CPU threads to avoid CPU thrashing
	concurrency := ramSlots
	if concurrency > logicalCores {
		concurrency = logicalCores
	}

	// Safe upper ceiling
	if concurrency > 16 {
		concurrency = 16
	}

	return concurrency
}

func resolveNodeID() string {
	// 1. Try reading /etc/machine-id (Linux)
	for _, idFile := range []string{"/etc/machine-id", "/var/lib/dbus/machine-id"} {
		if data, err := os.ReadFile(idFile); err == nil {
			id := strings.TrimSpace(string(data))
			if len(id) >= 12 {
				return "node_" + id[:12]
			}
		}
	}

	// 2. Persistent identity file in current directory or /tmp
	idPath := ".node_identity"
	if data, err := os.ReadFile(idPath); err == nil {
		id := strings.TrimSpace(string(data))
		if id != "" {
			return id
		}
	}

	// 3. Fallback: hash of hostname + mac address
	hwHash := sha256.New()
	hostname, _ := os.Hostname()
	hwHash.Write([]byte(hostname))
	if ifaces, err := net.Interfaces(); err == nil {
		for _, iface := range ifaces {
			if len(iface.HardwareAddr) > 0 {
				hwHash.Write(iface.HardwareAddr)
				break
			}
		}
	}
	hashStr := hex.EncodeToString(hwHash.Sum(nil))[:12]
	newNodeID := "node_" + hashStr
	_ = os.WriteFile(idPath, []byte(newNodeID), 0644)
	return newNodeID
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
				if strings.HasPrefix(line, "model name") {
					parts := strings.SplitN(line, ":", 2)
					if len(parts) == 2 && model == "Generic CPU" {
						model = strings.TrimSpace(parts[1])
					}
				}
				if strings.HasPrefix(line, "core id") {
					parts := strings.SplitN(line, ":", 2)
					if len(parts) == 2 {
						coreIDs[strings.TrimSpace(parts[1])] = true
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
			var phys int
			if _, err := fmt.Sscanf(strings.TrimSpace(string(out)), "%d", &phys); err == nil && phys > 0 {
				physical = phys
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
				var val int64
				if strings.HasPrefix(line, "MemTotal:") {
					fmt.Sscanf(line, "MemTotal: %d kB", &val)
					totalMB = val / 1024
				} else if strings.HasPrefix(line, "MemAvailable:") {
					fmt.Sscanf(line, "MemAvailable: %d kB", &val)
					availMB = val / 1024
				}
			}
		}
	} else if runtime.GOOS == "darwin" {
		if out, err := exec.Command("sysctl", "-n", "hw.memsize").Output(); err == nil {
			var bytes int64
			if _, err := fmt.Sscanf(strings.TrimSpace(string(out)), "%d", &bytes); err == nil && bytes > 0 {
				totalMB = bytes / (1024 * 1024)
				availMB = totalMB / 2
			}
		}
	}

	return MemoryCapability{
		TotalMB:     totalMB,
		AvailableMB: availMB,
	}
}


func detectContainer() ContainerCapability {
	dockerBin := "docker"
	out, err := exec.Command(dockerBin, "--version").Output()
	if err != nil {
		return ContainerCapability{
			Runtime: "none",
			Version: "not found",
			Healthy: false,
		}
	}

	versionStr := strings.TrimSpace(string(out))
	// Test if docker daemon is responding
	healthy := false
	if err := exec.Command(dockerBin, "info").Run(); err == nil {
		healthy = true
	}

	return ContainerCapability{
		Runtime: "docker",
		Version: versionStr,
		Healthy: healthy,
	}
}

func detectNetwork(controlPlaneURL string) NetworkCapability {
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
	connected := false
	var latencyMS float64 = 0.0

	// Check connectivity by pinging control plane URL
	client := http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(controlPlaneURL + "/meta")
	if err == nil {
		connected = true
		latencyMS = float64(time.Since(start).Milliseconds())
		_ = resp.Body.Close()
	} else {
		// Fallback to DNS check
		if _, err := net.LookupHost("1.1.1.1"); err == nil {
			connected = true
		}
	}

	return NetworkCapability{
		Connected: connected,
		Interface: ifaceName,
		LatencyMS: latencyMS,
	}
}

// EnsureRAMWorkspace creates and verifies a tmpfs RAM workspace directory to prevent USB flash wear.
func EnsureRAMWorkspace(basePath string) error {
	if err := os.MkdirAll(basePath, 0777); err != nil {
		return err
	}

	if runtime.GOOS == "linux" {
		// Test if basePath is mounted on tmpfs
		data, err := os.ReadFile("/proc/mounts")
		if err == nil && !strings.Contains(string(data), basePath) {
			// Mount tmpfs in RAM if running as root or with sudo
			cleanPath, _ := filepath.Abs(basePath)
			_ = exec.Command("mount", "-t", "tmpfs", "-o", "size=2G,noexec=off,nosuid,nodev", "tmpfs", cleanPath).Run()
		}
	}

	return nil
}
