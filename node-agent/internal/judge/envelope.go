package judge

import (
	"encoding/json"
	"fmt"
	"strings"
)

// RunnerEnvelope represents the canonical structured result envelope emitted by judge runners.
type RunnerEnvelope struct {
	Status      string      `json:"status"`
	ReturnValue interface{} `json:"return_value"`
	Error       string      `json:"error,omitempty"`
}

const RunnerResultMarker = "<<<CCC_RUNNER_RESULT>>>"

// ParseRunnerEnvelope searches for the canonical result envelope in raw stdout.
// Returns the envelope and the user stdout with the envelope marker and JSON stripped.
func ParseRunnerEnvelope(rawStdout string) (*RunnerEnvelope, string) {
	if !strings.Contains(rawStdout, RunnerResultMarker) {
		return nil, rawStdout
	}

	parts := strings.Split(rawStdout, RunnerResultMarker)
	if len(parts) >= 3 {
		envelopeJSON := strings.TrimSpace(parts[1])
		userStdout := strings.TrimRight(parts[0]+strings.Join(parts[2:], ""), "\r\n")

		var env RunnerEnvelope
		if err := json.Unmarshal([]byte(envelopeJSON), &env); err == nil {
			return &env, userStdout
		}
	}
	return nil, rawStdout
}

// FormatCanonicalValue serializes a return_value primitive or structure into a canonical string.
func FormatCanonicalValue(val interface{}) string {
	if val == nil {
		return "null"
	}
	switch v := val.(type) {
	case bool:
		if v {
			return "true"
		}
		return "false"
	case string:
		return v
	case float64:
		if v == float64(int64(v)) {
			return fmt.Sprintf("%d", int64(v))
		}
		return fmt.Sprintf("%v", v)
	case int, int32, int64:
		return fmt.Sprintf("%d", v)
	default:
		bytes, err := json.Marshal(v)
		if err == nil {
			return string(bytes)
		}
		return fmt.Sprintf("%v", v)
	}
}
