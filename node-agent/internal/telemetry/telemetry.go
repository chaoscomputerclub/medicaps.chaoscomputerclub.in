package telemetry

import (
	"sync/atomic"
)

// Metrics records node-level execution counters.
type Metrics struct {
	JobsClaimed   uint64
	JobsSucceeded uint64
	JobsFailed    uint64
	TotalTimeMS   uint64
}

var globalMetrics Metrics

func IncJobsClaimed() {
	atomic.AddUint64(&globalMetrics.JobsClaimed, 1)
}

func IncJobsSucceeded() {
	atomic.AddUint64(&globalMetrics.JobsSucceeded, 1)
}

func IncJobsFailed() {
	atomic.AddUint64(&globalMetrics.JobsFailed, 1)
}

func AddExecutionTime(ms uint64) {
	atomic.AddUint64(&globalMetrics.TotalTimeMS, ms)
}

func Snapshot() (claimed, succeeded, failed, totalMS uint64) {
	return atomic.LoadUint64(&globalMetrics.JobsClaimed),
		atomic.LoadUint64(&globalMetrics.JobsSucceeded),
		atomic.LoadUint64(&globalMetrics.JobsFailed),
		atomic.LoadUint64(&globalMetrics.TotalTimeMS)
}
