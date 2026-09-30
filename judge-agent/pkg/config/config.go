package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all runtime parameters for the portable Go Node Agent.
type Config struct {
	ControlPlaneURL     string
	EnrollmentToken     string
	NodeID              string
	Hostname            string
	WorkspaceBase       string
	DockerBin           string
	HeartbeatInterval   time.Duration
	ClaimTimeout        time.Duration
	MaxCPUThresholdPct  float64
	MinMemoryHeadroomMB int64
	DefaultConcurrency  int
	AgentVersion        string
	UseRAMTmpfs         bool
}

// LoadFromEnv loads configuration from environment variables with safe defaults.
func LoadFromEnv() *Config {
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "portable-node"
	}

	cfg := &Config{
		ControlPlaneURL:     getEnv("CONTROL_PLANE_URL", "https://medicaps.chaoscomputerclub.in/api/v1"),
		EnrollmentToken:     getEnv("JUDGE_AGENT_SECRET", getEnv("ENROLLMENT_TOKEN", "")),
		NodeID:              getEnv("NODE_ID", ""),
		Hostname:            getEnv("HOSTNAME", hostname),
		WorkspaceBase:       getEnv("WORKSPACE_BASE", "/tmp/ccc_workspaces"),
		DockerBin:           getEnv("DOCKER_BIN", "docker"),
		HeartbeatInterval:   time.Duration(getEnvInt("HEARTBEAT_INTERVAL_SECONDS", 5)) * time.Second,
		ClaimTimeout:        time.Duration(getEnvInt("CLAIM_TIMEOUT_SECONDS", 2)) * time.Second,
		MaxCPUThresholdPct:  getEnvFloat("MAX_CPU_THRESHOLD_PCT", 88.0),
		MinMemoryHeadroomMB: int64(getEnvInt("MIN_MEMORY_HEADROOM_MB", 512)),
		DefaultConcurrency:  getEnvInt("DEFAULT_CONCURRENCY", 0), // 0 means auto-calculate from hardware
		AgentVersion:        "2.0.0-go",
		UseRAMTmpfs:         getEnvBool("USE_RAM_TMPFS", true),
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvFloat(key string, fallback float64) float64 {
	if val := os.Getenv(key); val != "" {
		if f, err := strconv.ParseFloat(val, 64); err == nil {
			return f
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if val := os.Getenv(key); val != "" {
		b, err := strconv.ParseBool(val)
		if err == nil {
			return b
		}
	}
	return fallback
}
