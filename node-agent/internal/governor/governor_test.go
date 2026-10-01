package governor

import (
	"testing"
)

func TestResourceGovernorSlots(t *testing.T) {
	gov := NewResourceGovernor(3, 85.0, 1024)

	// Acquire all 3 slots
	if !gov.TryAcquireSlot() {
		t.Fatal("Expected slot 1 acquisition to succeed")
	}
	if !gov.TryAcquireSlot() {
		t.Fatal("Expected slot 2 acquisition to succeed")
	}
	if !gov.TryAcquireSlot() {
		t.Fatal("Expected slot 3 acquisition to succeed")
	}

	// 4th slot must fail
	if gov.TryAcquireSlot() {
		t.Fatal("Expected slot 4 acquisition to fail (max concurrency 3)")
	}

	snap := gov.Snapshot()
	if snap.RunningJobs != 3 {
		t.Errorf("Expected 3 running jobs, got %d", snap.RunningJobs)
	}
	if snap.AvailableSlots != 0 {
		t.Errorf("Expected 0 available slots, got %d", snap.AvailableSlots)
	}

	// Release 1 slot
	gov.ReleaseSlot()
	snap2 := gov.Snapshot()
	if snap2.RunningJobs != 2 {
		t.Errorf("Expected 2 running jobs, got %d", snap2.RunningJobs)
	}
	if snap2.AvailableSlots != 1 {
		t.Errorf("Expected 1 available slot, got %d", snap2.AvailableSlots)
	}
}
