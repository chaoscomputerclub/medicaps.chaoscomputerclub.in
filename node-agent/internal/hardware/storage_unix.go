//go:build !windows

package hardware

import (
	"os"
	"os/exec"
	"runtime"
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

// EnsureRAMWorkspace creates and mounts an in-memory tmpfs filesystem at path on Linux.
func EnsureRAMWorkspace(path string) error {
	if err := os.MkdirAll(path, 0777); err != nil {
		return err
	}
	if runtime.GOOS == "linux" {
		// Attempt tmpfs mount if root/sudo is permitted; else rely on /tmp
		_ = exec.Command("mount", "-t", "tmpfs", "-o", "size=2048M,noexec,nosuid", "tmpfs", path).Run()
	}
	_ = os.Chmod(path, 0777)
	return nil
}
