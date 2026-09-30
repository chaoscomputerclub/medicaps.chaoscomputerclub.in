package discovery

import (
	"testing"
)

func TestCalculateSafeConcurrency(t *testing.T) {
	tests := []struct {
		name         string
		logicalCores int
		totalRAMMB   int64
		expectedMin  int
		expectedMax  int
	}{
		{
			name:         "Ultra-low spec (2C, 2GB RAM)",
			logicalCores: 2,
			totalRAMMB:   2048,
			expectedMin:  1,
			expectedMax:  1,
		},
		{
			name:         "Standard campus laptop (8C, 8GB RAM)",
			logicalCores: 8,
			totalRAMMB:   8192,
			expectedMin:  6,
			expectedMax:  8,
		},
		{
			name:         "Gaming/Dev laptop (12 threads, 8GB RAM)",
			logicalCores: 12,
			totalRAMMB:   8192,
			expectedMin:  6,
			expectedMax:  8,
		},
		{
			name:         "High performance workstation (16C, 32GB RAM)",
			logicalCores: 16,
			totalRAMMB:   32768,
			expectedMin:  16,
			expectedMax:  16,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalculateSafeConcurrency(tt.logicalCores, tt.totalRAMMB)
			if got < tt.expectedMin || got > tt.expectedMax {
				t.Errorf("CalculateSafeConcurrency(%d, %d) = %d; want between [%d, %d]",
					tt.logicalCores, tt.totalRAMMB, got, tt.expectedMin, tt.expectedMax)
			}
		})
	}
}

func TestResolveNodeID(t *testing.T) {
	id := resolveNodeID()
	if id == "" {
		t.Fatal("Expected non-empty node ID")
	}
	if len(id) < 5 {
		t.Fatalf("Node ID too short: %s", id)
	}
}
