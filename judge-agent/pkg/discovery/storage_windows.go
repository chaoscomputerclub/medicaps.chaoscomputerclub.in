//go:build windows

package discovery

import (
	"os"
)

func detectStorage(path string) StorageCapability {
	_ = os.MkdirAll(path, 0755)
	return StorageCapability{
		AvailableGB: 50.0,
		USBMode:     true,
	}
}
