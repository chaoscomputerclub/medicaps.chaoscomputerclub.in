package judge

import (
	"testing"
)

// TestCompareOutputs covers the full range of output types that contest
// problems can produce.  Each test case documents the real-world scenario
// that motivated it, so failures are immediately actionable.
func TestCompareOutputs(t *testing.T) {
	type tc struct {
		name   string
		actual string
		exp    string
		want   bool
	}

	tests := []tc{
		// ── Strings ───────────────────────────────────────────────────────────
		{name: "exact string", actual: "olleh", exp: "olleh", want: true},
		{name: "JSON-quoted string vs plain", actual: `"olleh"`, exp: "olleh", want: true},
		{name: "both JSON-quoted string", actual: `"olleh"`, exp: `"olleh"`, want: true},
		{name: "trailing newline", actual: "hello\n", exp: "hello", want: true},
		{name: "CRLF vs LF", actual: "hello\r\n", exp: "hello\n", want: true},
		{name: "wrong string", actual: "world", exp: "hello", want: false},

		// ── Booleans ─────────────────────────────────────────────────────────
		{name: "true == true", actual: "true", exp: "true", want: true},
		{name: "True (Python) == true (JSON)", actual: "True", exp: "true", want: false}, // Python True is not valid JSON; stored expected is "true"
		{name: "JSON true == JSON quoted-string true", actual: "true", exp: `"true"`, want: true}, // token-layer: both split to ["true"]

		// ── Integers ─────────────────────────────────────────────────────────
		{name: "int equal", actual: "42", exp: "42", want: true},
		{name: "int vs float same value", actual: "1", exp: "1.0", want: true},
		{name: "negative int", actual: "-7", exp: "-7", want: true},
		{name: "wrong int", actual: "3", exp: "4", want: false},

		// ── Floats ───────────────────────────────────────────────────────────
		{name: "float exact", actual: "3.14", exp: "3.14", want: true},
		{name: "float within epsilon", actual: "0.1000001", exp: "0.1", want: true},
		{name: "float outside epsilon", actual: "0.2", exp: "0.1", want: false},
		{name: "float trailing zero", actual: "2.50", exp: "2.5", want: true},

		// ── Arrays (Move Zeroes, Two Sum, etc.) ───────────────────────────────
		{name: "array spacing difference", actual: "[1, 3, 12, 0, 0]", exp: "[1,3,12,0,0]", want: true},
		{name: "array exact", actual: "[1,2,3]", exp: "[1,2,3]", want: true},
		{name: "nested array", actual: "[[1,2],[3,4]]", exp: "[[1, 2], [3, 4]]", want: true},
		{name: "empty array", actual: "[]", exp: "[]", want: true},
		{name: "array wrong order", actual: "[3,1,2]", exp: "[1,2,3]", want: false},
		{name: "array wrong element", actual: "[1,2,4]", exp: "[1,2,3]", want: false},

		// ── Objects / Maps ────────────────────────────────────────────────────
		{name: "object spacing", actual: `{"a": 1, "b": 2}`, exp: `{"a":1,"b":2}`, want: true},
		{name: "object key order agnostic", actual: `{"b":2,"a":1}`, exp: `{"a":1,"b":2}`, want: true},
		{name: "object wrong value", actual: `{"a":1}`, exp: `{"a":2}`, want: false},

		// ── Multi-line output ─────────────────────────────────────────────────
		{name: "multi-line exact", actual: "1\n2\n3", exp: "1\n2\n3", want: true},
		{name: "multi-line trailing spaces", actual: "1   \n2\n3", exp: "1\n2\n3", want: true},
		{name: "multi-line trailing newline", actual: "1\n2\n3\n", exp: "1\n2\n3", want: true},
		{name: "multi-line wrong", actual: "1\n2\n4", exp: "1\n2\n3", want: false},

		// ── Token sequence ────────────────────────────────────────────────────
		{name: "extra internal spaces", actual: "hello   world", exp: "hello world", want: true},
		{name: "tab vs space", actual: "hello\tworld", exp: "hello world", want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CompareOutputs(tt.actual, tt.exp)
			if got != tt.want {
				t.Errorf("CompareOutputs(%q, %q) = %v; want %v", tt.actual, tt.exp, got, tt.want)
			}
		})
	}
}

func TestCompareWithMode(t *testing.T) {
	// ModeExact
	if CompareWithMode("hello", "hello\n", ModeExact) {
		t.Error("ModeExact: should not match trailing newline")
	}
	if !CompareWithMode("hello", "hello", ModeExact) {
		t.Error("ModeExact: exact bytes should match")
	}

	// ModeUnordered
	if !CompareWithMode("[3,1,2]", "[1,2,3]", ModeUnordered) {
		t.Error("ModeUnordered: any permutation should match")
	}
	if CompareWithMode("[3,1,2]", "[1,2,4]", ModeUnordered) {
		t.Error("ModeUnordered: different elements should not match")
	}

	// ModeFloat
	if !CompareWithMode("3.1415927", "3.1415926", ModeFloat) {
		t.Error("ModeFloat: values within epsilon should match")
	}
	if CompareWithMode("3.5", "4.0", ModeFloat) {
		t.Error("ModeFloat: values outside epsilon should not match")
	}
}
