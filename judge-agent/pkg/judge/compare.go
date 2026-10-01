// Package judge provides a universal, multi-strategy output comparator for the
// distributed CCC judge system.
//
// # Why a dedicated package?
//
// Inline string equality in executor.go is brittle — every new problem type
// (floats, arrays, booleans, objects, multi-line output) has required a patch.
// This package consolidates all comparison logic in one place, making it easy
// to extend, test, and audit independently of execution concerns.
//
// # Comparison pipeline (ModeDefault)
//
// CompareOutputs applies strategies in order, short-circuiting on first match:
//
//  1. ExactBytes         — byte-for-byte identical (zero-alloc fast-path)
//  2. TrimmedExact       — strip surrounding whitespace / CRLF
//  3. QuoteNormalized    — unquote JSON strings  ("olleh" ≡ olleh)
//  4. JSONSemantic       — parse both as JSON, deep-equal with float ε=1e-6
//                          [1, 3, 12] ≡ [1,3,12]  true ≡ True  1.0 ≡ 1
//  5. LineNormalized     — line-by-line after trimming trailing spaces; handles
//                          multi-line stdout correctly
//  6. TokenSequence      — split on whitespace, compare token-by-token
//
// # Extension points
//
// Use CompareWithMode to override the strategy:
//
//	judge.CompareWithMode(actual, expected, judge.ModeUnordered)
package judge

import (
	"encoding/json"
	"math"
	"sort"
	"strings"
)

// FloatEpsilon is the absolute/relative tolerance for floating-point values
// inside JSON structures.  1e-6 matches the LeetCode judge.
const FloatEpsilon = 1e-6

// Mode controls which comparison strategies are attempted.
type Mode int

const (
	// ModeDefault runs the full layered pipeline (recommended for all problems).
	ModeDefault Mode = iota
	// ModeExact passes only on byte-for-byte equality.
	ModeExact
	// ModeFloat is ModeDefault plus epsilon tolerance for plain scalar outputs.
	ModeFloat
	// ModeUnordered accepts any permutation of a top-level JSON array.
	ModeUnordered
)

// CompareOutputs is the primary entry-point called for every testcase.
// It uses ModeDefault: full layered pipeline with JSON semantic comparison.
func CompareOutputs(actual, expected string) bool {
	return CompareWithMode(actual, expected, ModeDefault)
}

// CompareWithMode is the parameterized comparator for callers that know the
// problem's output type (e.g. float-heavy, unordered set).
func CompareWithMode(actual, expected string, mode Mode) bool {
	// ── Layer 1: exact bytes ──────────────────────────────────────────────────
	if actual == expected {
		return true
	}
	if mode == ModeExact {
		return false
	}

	// ── Layer 2: trim surrounding whitespace and CRLF ────────────────────────
	act := strings.TrimSpace(strings.ReplaceAll(actual, "\r\n", "\n"))
	exp := strings.TrimSpace(strings.ReplaceAll(expected, "\r\n", "\n"))
	if act == exp {
		return true
	}

	// ── Layer 3: JSON quote normalization ────────────────────────────────────
	// Handles: "olleh" vs olleh, '"true"' vs 'true'
	actU := unquoteIfJSONString(act)
	expU := unquoteIfJSONString(exp)
	if actU == expU {
		return true
	}

	// ── Layer 4: JSON semantic comparison ────────────────────────────────────
	// Handles: [1, 3, 12, 0, 0] vs [1,3,12,0,0]
	//          {"a": 1}         vs {"a":1}
	//          true             vs True
	//          1.0              vs 1
	//          null             vs None  (Python-printed null won't JSON-parse, but
	//                                    the expected stored value is "null")
	var actJSON, expJSON interface{}
	actIsJSON := json.Unmarshal([]byte(act), &actJSON) == nil
	expIsJSON := json.Unmarshal([]byte(exp), &expJSON) == nil

	if actIsJSON && expIsJSON {
		if mode == ModeUnordered {
			if deepEqualUnordered(actJSON, expJSON) {
				return true
			}
		} else {
			if deepEqual(actJSON, expJSON) {
				return true
			}
		}
	}

	// ── ModeFloat: plain scalar epsilon tolerance ────────────────────────────
	if mode == ModeFloat {
		if floatClose(act, exp) {
			return true
		}
	}

	// ── Layer 5: line-by-line normalized ────────────────────────────────────
	// Multi-line stdout where each line may have trailing whitespace.
	actLines := normalizeLines(actual)
	expLines := normalizeLines(expected)
	if len(actLines) == len(expLines) && len(actLines) > 0 {
		match := true
		for i := range actLines {
			if actLines[i] != expLines[i] {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}

	// ── Layer 6: token-sequence comparison ───────────────────────────────────
	// Handles extra internal whitespace: "1  2  3" vs "1 2 3"
	actTokens := strings.Fields(act)
	expTokens := strings.Fields(exp)
	if len(actTokens) > 0 && len(actTokens) == len(expTokens) {
		match := true
		for i := range actTokens {
			if actTokens[i] != expTokens[i] {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}

	return false
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// unquoteIfJSONString strips surrounding double-quotes from a JSON string
// literal.  Arrays, objects, and numbers are passed through unchanged.
func unquoteIfJSONString(s string) string {
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		var v string
		if json.Unmarshal([]byte(s), &v) == nil {
			return v
		}
	}
	return s
}

// normalizeLines trims trailing whitespace per-line, collapses CRLF to LF,
// and drops trailing blank lines so "foo\n\n" ≡ "foo\n" ≡ "foo".
func normalizeLines(s string) []string {
	raw := strings.Split(strings.ReplaceAll(s, "\r\n", "\n"), "\n")
	out := make([]string, 0, len(raw))
	for _, l := range raw {
		out = append(out, strings.TrimRight(l, " \t"))
	}
	for len(out) > 0 && out[len(out)-1] == "" {
		out = out[:len(out)-1]
	}
	return out
}

// floatClose returns true when both strings parse as JSON numbers within ε.
func floatClose(a, b string) bool {
	var af, bf float64
	if json.Unmarshal([]byte(a), &af) != nil {
		return false
	}
	if json.Unmarshal([]byte(b), &bf) != nil {
		return false
	}
	return numbersClose(af, bf)
}

// numbersClose returns true when a and b are within FloatEpsilon of each other
// (absolute or relative).
func numbersClose(a, b float64) bool {
	if a == b {
		return true
	}
	diff := math.Abs(a - b)
	if diff <= FloatEpsilon {
		return true
	}
	denom := math.Max(math.Abs(a), math.Abs(b))
	return denom > 0 && diff/denom <= FloatEpsilon
}

// deepEqual recursively compares two JSON-decoded values with float tolerance.
// json.Unmarshal always uses float64 for numbers, so int 1 and float 1.0
// both decode to float64(1) — handled naturally.
func deepEqual(a, b interface{}) bool {
	switch av := a.(type) {
	case nil:
		return b == nil
	case bool:
		bv, ok := b.(bool)
		return ok && av == bv
	case float64:
		bv, ok := b.(float64)
		return ok && numbersClose(av, bv)
	case string:
		bv, ok := b.(string)
		return ok && av == bv
	case []interface{}:
		bv, ok := b.([]interface{})
		if !ok || len(av) != len(bv) {
			return false
		}
		for i := range av {
			if !deepEqual(av[i], bv[i]) {
				return false
			}
		}
		return true
	case map[string]interface{}:
		bv, ok := b.(map[string]interface{})
		if !ok || len(av) != len(bv) {
			return false
		}
		for k, va := range av {
			vb, exists := bv[k]
			if !exists || !deepEqual(va, vb) {
				return false
			}
		}
		return true
	default:
		return a == b
	}
}

// deepEqualUnordered is like deepEqual but sorts the top-level array before
// comparing, so [3,1,2] ≡ [1,2,3].  Nested arrays remain order-sensitive.
func deepEqualUnordered(a, b interface{}) bool {
	aArr, aIsArr := a.([]interface{})
	bArr, bIsArr := b.([]interface{})
	if aIsArr && bIsArr {
		if len(aArr) != len(bArr) {
			return false
		}
		sA := canonicalTokens(aArr)
		sB := canonicalTokens(bArr)
		for i := range sA {
			if sA[i] != sB[i] {
				return false
			}
		}
		return true
	}
	return deepEqual(a, b)
}

// canonicalTokens serializes each array element to canonical JSON and sorts
// the results, giving a stable ordering for any element type.
func canonicalTokens(arr []interface{}) []string {
	tokens := make([]string, len(arr))
	for i, v := range arr {
		b, err := json.Marshal(v)
		if err != nil {
			tokens[i] = "null"
		} else {
			tokens[i] = string(b)
		}
	}
	sort.Strings(tokens)
	return tokens
}
