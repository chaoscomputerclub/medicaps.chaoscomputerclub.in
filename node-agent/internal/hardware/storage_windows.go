//go:build windows

package hardware

import (
	"os"
)

func detectStorage(path string) StorageCapability {
	_ = os.MkdirAll(path, 0755)
	return StorageCapability{
		AvailableGB: 20.0,
		USBMode:     true,
	}
}

func EnsureRAMWorkspace(path string) error {
	return os.MkdirAll(path, 0777)
}
