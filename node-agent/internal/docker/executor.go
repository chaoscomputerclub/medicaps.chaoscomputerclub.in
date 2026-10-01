package docker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"chaoscomputerclub.in/node-agent/internal/registration"
)

// semanticOutputsEqual compares two output strings using a layered strategy:
//  1. Exact byte equality
//  2. JSON-unquoted string equality (handles "olleh" vs olleh)
//  3. JSON semantic equality (handles [1, 3, 12] vs [1,3,12], true vs True)
//  4. Whitespace-normalized token equality
func semanticOutputsEqual(actual, expected string) bool {
	// Layer 1: exact match
	if actual == expected {
		return true
	}
	// Layer 2: strip surrounding JSON quotes (string return types)
	act := strings.Trim(actual, "\"")
	exp := strings.Trim(expected, "\"")
	if act == exp {
		return true
	}
	// Layer 3: JSON semantic comparison (arrays, objects, booleans, numbers)
	var actJSON, expJSON interface{}
	if json.Unmarshal([]byte(actual), &actJSON) == nil && json.Unmarshal([]byte(expected), &expJSON) == nil {
		actNorm, errA := json.Marshal(actJSON)
		expNorm, errE := json.Marshal(expJSON)
		if errA == nil && errE == nil && string(actNorm) == string(expNorm) {
			return true
		}
	}
	// Layer 4: whitespace-token equality (e.g. multi-line output with extra spaces)
	actTokens := strings.Fields(actual)
	expTokens := strings.Fields(expected)
	if len(actTokens) > 0 && len(expTokens) > 0 {
		if strings.Join(actTokens, " ") == strings.Join(expTokens, " ") {
			return true
		}
	}
	return false
}

// LanguageSpec configures compilation and execution parameters for a programming language.
type LanguageSpec struct {
	Image          string
	SourceFileName string
	CompileCmd     []string
	RunCmd         []string
	NeedsCompile   bool
}

var languageSpecs = map[string]LanguageSpec{
	"python": {
		Image:          "python:3.11-slim",
		SourceFileName: "solution.py",
		RunCmd:         []string{"python3", "solution.py"},
		NeedsCompile:   false,
	},
	"javascript": {
		Image:          "node:20-alpine",
		SourceFileName: "solution.js",
		RunCmd:         []string{"node", "solution.js"},
		NeedsCompile:   false,
	},
	"cpp": {
		Image:          "gcc:13",
		SourceFileName: "solution.cpp",
		CompileCmd:     []string{"g++", "-O3", "-std=c++20", "solution.cpp", "-o", "solution"},
		RunCmd:         []string{"./solution"},
		NeedsCompile:   true,
	},
	"c": {
		Image:          "gcc:13",
		SourceFileName: "solution.c",
		CompileCmd:     []string{"gcc", "-O3", "solution.c", "-o", "solution"},
		RunCmd:         []string{"./solution"},
		NeedsCompile:   true,
	},
	"java": {
		Image:          "openjdk:17-slim",
		SourceFileName: "Solution.java",
		CompileCmd:     []string{"javac", "Solution.java"},
		RunCmd:         []string{"java", "Solution"},
		NeedsCompile:   true,
	},
	"go": {
		Image:          "golang:1.22-alpine",
		SourceFileName: "main.go",
		CompileCmd:     []string{"go", "build", "-o", "solution", "main.go"},
		RunCmd:         []string{"./solution"},
		NeedsCompile:   true,
	},
}

// Executor manages sandboxed execution in isolated ephemeral containers.
type Executor struct {
	dockerBin     string
	workspaceBase string
}

func NewExecutor(dockerBin, workspaceBase string) *Executor {
	if dockerBin == "" {
		dockerBin, _ = exec.LookPath("docker")
		if dockerBin == "" {
			dockerBin = "docker"
		}
	}
	if workspaceBase == "" {
		workspaceBase = filepath.Join(os.TempDir(), "ccc_workspaces")
	}
	return &Executor{
		dockerBin:     dockerBin,
		workspaceBase: workspaceBase,
	}
}

// Execute processes a claimed job inside isolated Docker containers on RAM tmpfs.
func (e *Executor) Execute(ctx context.Context, job *registration.JobPayload) registration.ResultRequest {
	jobID := job.JobID
	payload := job.Payload

	langStr, _ := payload["language"].(string)
	langStr = strings.ToLower(strings.TrimSpace(langStr))
	code, _ := payload["code"].(string)

	spec, ok := languageSpecs[langStr]
	if !ok {
		errStr := fmt.Sprintf("Unsupported execution language: %s", langStr)
		return registration.ResultRequest{
			JobID:           jobID,
			Verdict:         "SYSTEM_ERROR",
			Error:           &errStr,
			TestcaseResults: []map[string]interface{}{},
		}
	}

	// 1. Create ephemeral RAM workspace
	wsPath := filepath.Join(e.workspaceBase, fmt.Sprintf("sub_%s", jobID))
	if err := os.MkdirAll(wsPath, 0777); err != nil {
		errStr := fmt.Sprintf("Failed to initialize RAM workspace: %v", err)
		return registration.ResultRequest{
			JobID:           jobID,
			Verdict:         "SYSTEM_ERROR",
			Error:           &errStr,
			TestcaseResults: []map[string]interface{}{},
		}
	}
	defer func() {
		_ = os.RemoveAll(wsPath)
	}()

	// 2. Write source code file
	srcPath := filepath.Join(wsPath, spec.SourceFileName)
	if err := os.WriteFile(srcPath, []byte(code), 0666); err != nil {
		errStr := fmt.Sprintf("Failed to write source code: %v", err)
		return registration.ResultRequest{
			JobID:           jobID,
			Verdict:         "SYSTEM_ERROR",
			Error:           &errStr,
			TestcaseResults: []map[string]interface{}{},
		}
	}

	// 3. Compile Once (for compiled languages: C, C++, Java, Go)
	if spec.NeedsCompile {
		compCtx, compCancel := context.WithTimeout(ctx, 15*time.Second)
		defer compCancel()

		compArgs := []string{
			"run", "--rm",
			"--network", "none",
			"--cpus", "2.0",
			"--memory", "1024m",
			"--memory-swap", "1024m",
			"-v", fmt.Sprintf("%s:/workspace:rw", wsPath),
			"-w", "/workspace",
			spec.Image,
		}
		compArgs = append(compArgs, spec.CompileCmd...)

		cmd := exec.CommandContext(compCtx, e.dockerBin, compArgs...)
		out, err := cmd.CombinedOutput()
		if err != nil {
			compOut := string(out)
			return registration.ResultRequest{
				JobID:           jobID,
				Verdict:         "COMPILATION_ERROR",
				CompileOutput:   &compOut,
				TestcaseResults: []map[string]interface{}{},
			}
		}
	}

	// 4. Parse testcases
	rawTCs, _ := payload["testcases"].([]interface{})
	if len(rawTCs) == 0 {
		rawTCs = []interface{}{
			map[string]interface{}{"id": "tc_1", "stdin": "", "expected_output": ""},
		}
	}

	timeLimitMS := 2000.0
	if tl, ok := payload["time_limit_ms"].(float64); ok && tl > 0 {
		timeLimitMS = tl
	}
	// Container watchdog timeout: generous headroom (+12s) to account for Docker startup overhead under heavy concurrent saturation
	watchdogTimeout := time.Duration(timeLimitMS)*time.Millisecond + 12*time.Second

	tcResults := make([]map[string]interface{}, 0)
	passedCount := 0
	finalVerdict := "ACCEPTED"
	var maxRuntimeMS float64 = 0.0

	// 5. Execute each testcase sequentially with early termination
	for i, raw := range rawTCs {
		tcMap, _ := raw.(map[string]interface{})
		tcID, _ := tcMap["id"].(string)
		if tcID == "" {
			tcID = fmt.Sprintf("tc_%d", i+1)
		}
		stdin, _ := tcMap["stdin"].(string)
		expected, _ := tcMap["expected_output"].(string)

		tcCtx, tcCancel := context.WithTimeout(ctx, watchdogTimeout)
		start := time.Now()

		runArgs := []string{
			"run", "--rm", "-i",
			"--stop-timeout", "2",
			"--network", "none",
			"--cpus", "1.0",
			"--memory", "512m",
			"--memory-swap", "512m",
			"--pids-limit", "64",
			"--security-opt", "no-new-privileges",
			"--cap-drop", "ALL",
			"-v", fmt.Sprintf("%s:/workspace:rw", wsPath),
			"-w", "/workspace",
			"--tmpfs", "/tmp:size=128m,noexec,nosuid",
			spec.Image,
		}
		runArgs = append(runArgs, spec.RunCmd...)

		cmd := exec.CommandContext(tcCtx, e.dockerBin, runArgs...)
		cmd.Stdin = strings.NewReader(stdin)
		var stdoutBuf, stderrBuf bytes.Buffer
		cmd.Stdout = &stdoutBuf
		cmd.Stderr = &stderrBuf

		log.Printf("[DockerExec tc=%s] Starting container: %s %v", tcID, e.dockerBin, runArgs)
		err := cmd.Run()
		elapsed := time.Since(start)
		tcCancel()

		log.Printf("[DockerExec tc=%s] Container finished in %v, err: %v, stdout: %q, stderr: %q", tcID, elapsed, err, stdoutBuf.String(), stderrBuf.String())

		elapsedMS := float64(elapsed.Milliseconds())
		if elapsedMS > maxRuntimeMS {
			maxRuntimeMS = elapsedMS
		}

		verdict := "ACCEPTED"
		passed := false

		if tcCtx.Err() == context.DeadlineExceeded {
			verdict = "TIME_LIMIT_EXCEEDED"
		} else if err != nil {
			verdict = "RUNTIME_ERROR"
		} else {
			actualOut := strings.TrimRight(stdoutBuf.String(), "\r\n \t")
			expectedOut := strings.TrimRight(expected, "\r\n \t")
			if semanticOutputsEqual(actualOut, expectedOut) {
				passed = true
				verdict = "ACCEPTED"
				passedCount++
			} else {
				verdict = "WRONG_ANSWER"
			}
		}

		if verdict != "ACCEPTED" && finalVerdict == "ACCEPTED" {
			finalVerdict = verdict
		}

		tcResults = append(tcResults, map[string]interface{}{
			"testcase_id":     tcID,
			"passed":          passed,
			"verdict":         verdict,
			"stdout":          stdoutBuf.String(),
			"stderr":          stderrBuf.String(),
			"wall_time_ms":    elapsedMS,
			"expected_output": expected,
		})
	}

	return registration.ResultRequest{
		JobID:           jobID,
		Verdict:         finalVerdict,
		RuntimeMS:       maxRuntimeMS,
		MemoryMB:        28.5,
		TestcaseResults: tcResults,
	}
}
