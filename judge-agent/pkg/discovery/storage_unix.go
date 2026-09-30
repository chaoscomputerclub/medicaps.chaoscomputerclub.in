//go:build !windows

package discovery

import (
	"os"
	"syscall"
)

func detectStorage(path string) StorageCapability {
	_ = os.MkdirAll(path, 0755)
	var stat syscall.Statfs_t
	var availGB float64 = 10.0
	if err := syscall.Statfs(path, &stat); err == nil {
		availBytes := stat.Bavail * uint64(stat.Bsize)
		availGB = float64(availBytes) / (1024 * 1024 * 1024)
	}

	return StorageCapability{
		AvailableGB: availGB,
		USBMode:     true,
	}
}
