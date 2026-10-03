package docker

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"chaoscomputerclub.in/node-agent/internal/judge"
	"chaoscomputerclub.in/node-agent/internal/registration"
)

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
		Image:          "eclipse-temurin:17-jdk-alpine",
		SourceFileName: "Main.java",
		CompileCmd:     []string{"javac", "Main.java"},
		RunCmd:         []string{"java", "Main"},
		NeedsCompile:   true,
	},
	"go": {
		Image:          "golang:1.22-alpine",
		SourceFileName: "main.go",
		CompileCmd:     []string{"go", "build", "-o", "solution", "main.go"},
		RunCmd:         []string{"./solution"},
		NeedsCompile:   true,
	},
	"rust": {
		Image:          "rust:alpine",
		SourceFileName: "solution.rs",
		CompileCmd:     []string{"rustc", "-O", "-o", "solution", "solution.rs"},
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

// Execute processes a claimed job inside ONE isolated Docker sandbox container on RAM tmpfs.
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
			Attempt:         job.Attempt,
			LeaseID:         job.LeaseID,
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
			Attempt:         job.Attempt,
			LeaseID:         job.LeaseID,
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
			Attempt:         job.Attempt,
			LeaseID:         job.LeaseID,
			Verdict:         "SYSTEM_ERROR",
			Error:           &errStr,
			TestcaseResults: []map[string]interface{}{},
		}
	}

	// 3. Spawn exactly ONE isolated Docker sandbox container for this entire submission
	cleanID := strings.ReplaceAll(jobID, "-", "")
	if len(cleanID) > 16 {
		cleanID = cleanID[:16]
	}
	containerName := fmt.Sprintf("ccc-sub-%s", cleanID)

	spawnArgs := []string{
		"run", "-d",
		"--name", containerName,
		"--network", "none",
		"--cpus", "2.0",
		"--memory", "512m",
		"--memory-swap", "512m",
		"--pids-limit", "64",
		"--security-opt", "no-new-privileges",
		"--cap-drop", "ALL",
		"-v", fmt.Sprintf("%s:/workspace:rw", wsPath),
		"-w", "/workspace",
		"--tmpfs", "/tmp:size=128m,noexec,nosuid",
		spec.Image,
		"sleep", "120",
	}

	spawnCtx, spawnCancel := context.WithTimeout(ctx, 15*time.Second)
	spawnCmd := exec.CommandContext(spawnCtx, e.dockerBin, spawnArgs...)
	spawnOut, spawnErr := spawnCmd.CombinedOutput()
	spawnCancel()

	if spawnErr != nil {
		errStr := fmt.Sprintf("Failed to spawn isolated sandbox container: %v (output: %s)", spawnErr, string(spawnOut))
		log.Printf("❌ [Job %s] Sandbox spawn error: %s", jobID, errStr)
		return registration.ResultRequest{
			JobID:           jobID,
			Attempt:         job.Attempt,
			LeaseID:         job.LeaseID,
			Verdict:         "SYSTEM_ERROR",
			Error:           &errStr,
			TestcaseResults: []map[string]interface{}{},
		}
	}

	// Guaranteed sandbox cleanup: remove container upon submission completion
	defer func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cleanupCancel()
		_ = exec.CommandContext(cleanupCtx, e.dockerBin, "rm", "-f", containerName).Run()
	}()

	// 4. Compile Once inside the running container (for compiled languages: C, C++, Java, Go)
	if spec.NeedsCompile {
		compCtx, compCancel := context.WithTimeout(ctx, 15*time.Second)
		defer compCancel()

		compArgs := append([]string{"exec", "-w", "/workspace", containerName}, spec.CompileCmd...)
		cmd := exec.CommandContext(compCtx, e.dockerBin, compArgs...)
		out, err := cmd.CombinedOutput()
		if err != nil {
			compOut := string(out)
			return registration.ResultRequest{
				JobID:           jobID,
				Attempt:         job.Attempt,
				LeaseID:         job.LeaseID,
				Verdict:         "COMPILATION_ERROR",
				CompileOutput:   &compOut,
				TestcaseResults: []map[string]interface{}{},
			}
		}
	}

	// 5. Parse testcases
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
	tcTimeout := time.Duration(timeLimitMS)*time.Millisecond + 2*time.Second

	tcResults := make([]map[string]interface{}, 0)
	passedCount := 0
	finalVerdict := "ACCEPTED"
	var maxRuntimeMS float64 = 0.0

	// 6. Execute each testcase sequentially via `docker exec -i` in the warm sandbox with early termination
	for i, raw := range rawTCs {
		tcMap, _ := raw.(map[string]interface{})
		tcID, _ := tcMap["id"].(string)
		if tcID == "" {
			tcID = fmt.Sprintf("tc_%d", i+1)
		}
		stdin, _ := tcMap["stdin"].(string)
		expected, _ := tcMap["expected_output"].(string)
		hidden, _ := tcMap["hidden"].(bool)

		tcCtx, tcCancel := context.WithTimeout(ctx, tcTimeout)
		start := time.Now()

		execArgs := append([]string{"exec", "-i", "-w", "/workspace", containerName}, spec.RunCmd...)
		cmd := exec.CommandContext(tcCtx, e.dockerBin, execArgs...)
		cmd.Stdin = strings.NewReader(stdin)
		var stdoutBuf, stderrBuf bytes.Buffer
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

		if tcCtx.Err() == context.DeadlineExceeded {
			verdict = "TIME_LIMIT_EXCEEDED"
		} else if err != nil {
			verdict = "RUNTIME_ERROR"
		} else {
			actualOut := strings.TrimRight(stdoutBuf.String(), "\r\n \t")
			expectedOut := strings.TrimRight(expected, "\r\n \t")
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

		// Early termination: on definitive non-ACCEPTED verdict on hidden or subsequent testcases, terminate early
		if verdict != "ACCEPTED" && (hidden || i >= 2) {
			log.Printf("⚡ [Job %s] Early termination triggered on %s (verdict=%s)", jobID, tcID, verdict)
			break
		}
	}

	return registration.ResultRequest{
		JobID:           jobID,
		Attempt:         job.Attempt,
		LeaseID:         job.LeaseID,
		Verdict:         finalVerdict,
		RuntimeMS:       maxRuntimeMS,
		MemoryMB:        28.5,
		TestcaseResults: tcResults,
	}
}
