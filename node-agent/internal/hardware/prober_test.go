package hardware

import (
	"testing"
)

func TestCapacityDerivation(t *testing.T) {
	// High-end laptop (12 threads, 8 GB RAM)
	slots := deriveJudgeSlots(12, 6200, 8192)
	if slots < 6 || slots > 7 {
		t.Errorf("Expected 6 or 7 judge slots for 12 threads and 8GB RAM, got %d", slots)
	}

	apiWorkers := deriveAPIWorkers(6)
	if apiWorkers != 3 {
		t.Errorf("Expected 3 API workers for 6 physical cores, got %d", apiWorkers)
	}

	sseCap := deriveSSECapacity(8192)
	if sseCap != 1228 {
		t.Errorf("Expected 1228 SSE capacity for 8192 MB RAM, got %d", sseCap)
	}

	// Budget PC (4 threads, 4 GB RAM)
	budgetSlots := deriveJudgeSlots(4, 2048, 4096)
	if budgetSlots != 2 {
		t.Errorf("Expected 2 judge slots for budget PC, got %d", budgetSlots)
	}
}

func TestResolveNodeID(t *testing.T) {
	id1 := resolveNodeID()
	id2 := resolveNodeID()
	if id1 != id2 {
		t.Errorf("Node ID must be idempotent across calls on same machine, got %s vs %s", id1, id2)
	}
	if len(id1) != 17 || id1[:5] != "node_" {
		t.Errorf("Invalid node ID format: %s", id1)
	}
}
