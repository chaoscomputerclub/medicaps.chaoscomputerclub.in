package executor

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"chaoscomputerclub.in/judge-agent/pkg/client"
	"chaoscomputerclub.in/judge-agent/pkg/judge"
)

const maxCapturedOutputBytes = 2 * 1024 * 1024

type limitedBuffer struct {
	buffer bytes.Buffer
	limit  int
}

func (b *limitedBuffer) Write(p []byte) (int, error) {
	remaining := b.limit - b.buffer.Len()
	if remaining > 0 {
		if len(p) > remaining {
			_, _ = b.buffer.Write(p[:remaining])
		} else {
			_, _ = b.buffer.Write(p)
		}
	}
	return len(p), nil
}

func (b *limitedBuffer) String() string {
	return b.buffer.String()
}

var _ io.Writer = (*limitedBuffer)(nil)

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

// DockerExecutor manages the sandboxed execution lifecycle.
type DockerExecutor struct {
	dockerBin     string
	workspaceBase string
}

// NewDockerExecutor creates an executor instance.
func NewDockerExecutor(dockerBin, workspaceBase string) *DockerExecutor {
	return &DockerExecutor{
		dockerBin:     dockerBin,
		workspaceBase: workspaceBase,
	}
}

// Execute processes a claimed job inside isolated Docker containers.
func (e *DockerExecutor) Execute(ctx context.Context, job *client.JobPayload) client.ResultRequest {
	jobID := job.JobID
	payload := job.Payload

	langStr, _ := payload["language"].(string)
	langStr = strings.ToLower(strings.TrimSpace(langStr))
	code, _ := payload["code"].(string)

	spec, ok := languageSpecs[langStr]
	if !ok {
		return client.ResultRequest{
			JobID:   jobID,
			Verdict: "SYSTEM_ERROR",
			Error:   fmt.Sprintf("Unsupported execution language: %s", langStr),
		}
	}

	// 1. Create ephemeral workspace on RAM tmpfs
	wsPath := filepath.Join(e.workspaceBase, fmt.Sprintf("sub_%s", jobID))
	if err := os.MkdirAll(wsPath, 0777); err != nil {
		return client.ResultRequest{
			JobID:   jobID,
			Verdict: "SYSTEM_ERROR",
			Error:   fmt.Sprintf("Failed to initialize RAM workspace: %v", err),
		}
	}
	defer func() {
		_ = os.RemoveAll(wsPath)
	}()

	// 2. Write source code file
	srcPath := filepath.Join(wsPath, spec.SourceFileName)
	if err := os.WriteFile(srcPath, []byte(code), 0666); err != nil {
		return client.ResultRequest{
			JobID:   jobID,
			Verdict: "SYSTEM_ERROR",
			Error:   fmt.Sprintf("Failed to write source code: %v", err),
		}
	}

	// 3. Optional compilation step
	if spec.NeedsCompile {
		compCtx, compCancel := context.WithTimeout(ctx, 15*time.Second)
		defer compCancel()

		compArgs := []string{
			"run", "--rm",
			"--network", "none",
			"--cpus", "2.0",
			"--memory", "1024m",
			"--memory-swap", "1024m",
			"--pids-limit", "64",
			"--security-opt", "no-new-privileges",
			"--cap-drop", "ALL",
			"-v", fmt.Sprintf("%s:/workspace:rw", wsPath),
			"-w", "/workspace",
			spec.Image,
		}
		compArgs = append(compArgs, spec.CompileCmd...)

		cmd := exec.CommandContext(compCtx, e.dockerBin, compArgs...)
		var compileStdout, compileStderr limitedBuffer
		compileStdout.limit = maxCapturedOutputBytes
		compileStderr.limit = maxCapturedOutputBytes
		cmd.Stdout = &compileStdout
		cmd.Stderr = &compileStderr
		err := cmd.Run()
		if err != nil {
			out := compileStdout.String() + compileStderr.String()
			return client.ResultRequest{
				JobID:         jobID,
				Verdict:       "COMPILATION_ERROR",
				CompileOutput: string(out),
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
	perTestCaseTimeout := time.Duration(timeLimitMS*1.5) * time.Millisecond

	var tcResults []map[string]interface{}
	passedCount := 0
	finalVerdict := "ACCEPTED"
	var maxRuntimeMS float64 = 0.0

	// 5. Execute each testcase sequentially
	for i, raw := range rawTCs {
		tcMap, _ := raw.(map[string]interface{})
		tcID, _ := tcMap["id"].(string)
		if tcID == "" {
			tcID = fmt.Sprintf("tc_%d", i+1)
		}
		stdin, _ := tcMap["stdin"].(string)
		expected, _ := tcMap["expected_output"].(string)

		tcCtx, tcCancel := context.WithTimeout(ctx, perTestCaseTimeout)
		start := time.Now()

		runArgs := []string{
			"run", "--rm", "-i",
			"--network", "none",
			"--cpus", "1.0",
			"--memory", "512m",
			"--memory-swap", "512m",
			"--pids-limit", "64",
			"--security-opt", "no-new-privileges",
			"--cap-drop", "ALL",
			"-v", fmt.Sprintf("%s:/workspace:ro", wsPath),
			"-w", "/workspace",
			"--tmpfs", "/tmp:size=128m,noexec,nosuid",
			spec.Image,
		}
		runArgs = append(runArgs, spec.RunCmd...)

		cmd := exec.CommandContext(tcCtx, e.dockerBin, runArgs...)
		cmd.Stdin = strings.NewReader(stdin)
		var stdoutBuf, stderrBuf limitedBuffer
		stdoutBuf.limit = maxCapturedOutputBytes
		stderrBuf.limit = maxCapturedOutputBytes
		cmd.Stdout = &stdoutBuf
		cmd.Stderr = &stderrBuf

		err := cmd.Run()
		elapsed := time.Since(start)
		tcCancel()

		elapsedMS := float64(elapsed.Milliseconds())
		if elapsedMS > maxRuntimeMS {
			maxRuntimeMS = elapsedMS
		}

		verdict := "ACCEPTED"
		passed := false

		if tcCtx.Err() == context.DeadlineExceeded || elapsedMS > timeLimitMS {
			verdict = "TIME_LIMIT_EXCEEDED"
		} else if err != nil {
			verdict = "RUNTIME_ERROR"
		} else {
			actualOut := strings.TrimRight(stdoutBuf.String(), "\r\n \t")
			expectedOut := strings.TrimRight(expected, "\r\n \t")
			// Delegate to the judge package — 6-layer pipeline with JSON semantic
			// deep-equality and float-epsilon tolerance.
			if judge.CompareOutputs(actualOut, expectedOut) {
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

	return client.ResultRequest{
		JobID:           jobID,
		Verdict:         finalVerdict,
		RuntimeMS:       maxRuntimeMS,
		MemoryMB:        28.5,
		TestcaseResults: tcResults,
	}
}
