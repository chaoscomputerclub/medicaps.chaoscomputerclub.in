package governor

import (
	"testing"
)

func TestResourceGovernorSlotManagement(t *testing.T) {
	gov := NewResourceGovernor(3, 90.0, 256)

	// Acquire up to max concurrency
	if !gov.TryAcquireSlot() {
		t.Fatal("Failed to acquire slot 1")
	}
	if !gov.TryAcquireSlot() {
		t.Fatal("Failed to acquire slot 2")
	}
	if !gov.TryAcquireSlot() {
		t.Fatal("Failed to acquire slot 3")
	}

	// 4th slot should be blocked
	if gov.TryAcquireSlot() {
		t.Fatal("Acquired 4th slot, exceeding max concurrency of 3")
	}

	// Release 1 slot
	gov.ReleaseSlot()

	// Now 1 slot should be acquirable
	if !gov.TryAcquireSlot() {
		t.Fatal("Failed to re-acquire slot after release")
	}

	// Clean up
	gov.ReleaseSlot()
	gov.ReleaseSlot()
	gov.ReleaseSlot()

	snap := gov.Snapshot()
	if snap.RunningJobs != 0 {
		t.Fatalf("Expected 0 running jobs, got %d", snap.RunningJobs)
	}
	if snap.AvailableSlots != 3 {
		t.Fatalf("Expected 3 available slots, got %d", snap.AvailableSlots)
	}
}
