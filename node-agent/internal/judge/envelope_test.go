package judge

import (
	"testing"
)

func TestParseRunnerEnvelope(t *testing.T) {
	raw := "user debug line 1\nuser debug line 2\n<<<CCC_RUNNER_RESULT>>>\n{\"status\": \"SUCCESS\", \"return_value\": true}\n<<<CCC_RUNNER_RESULT>>>\n"
	env, userOut := ParseRunnerEnvelope(raw)

	if env == nil {
		t.Fatalf("expected non-nil envelope")
	}
	if env.Status != "SUCCESS" {
		t.Errorf("expected SUCCESS, got %s", env.Status)
	}
	if env.ReturnValue != true {
		t.Errorf("expected true, got %v", env.ReturnValue)
	}
	if userOut != "user debug line 1\nuser debug line 2" {
		t.Errorf("expected user debug lines, got %q", userOut)
	}

	formatted := FormatCanonicalValue(env.ReturnValue)
	if formatted != "true" {
		t.Errorf("expected 'true', got %q", formatted)
	}
}

func TestParseRunnerEnvelope_RuntimeError(t *testing.T) {
	raw := "<<<CCC_RUNNER_RESULT>>>\n{\"status\": \"RUNTIME_ERROR\", \"error\": \"Index out of bounds\"}\n<<<CCC_RUNNER_RESULT>>>\n"
	env, _ := ParseRunnerEnvelope(raw)

	if env == nil {
		t.Fatalf("expected non-nil envelope")
	}
	if env.Status != "RUNTIME_ERROR" {
		t.Errorf("expected RUNTIME_ERROR, got %s", env.Status)
	}
	if env.Error != "Index out of bounds" {
		t.Errorf("expected 'Index out of bounds', got %q", env.Error)
	}
}
