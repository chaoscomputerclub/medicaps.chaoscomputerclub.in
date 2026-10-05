package docker

import (
	"archive/tar"
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"chaoscomputerclub.in/node-agent/internal/judge"
	"chaoscomputerclub.in/node-agent/internal/registration"
)

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0777)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func archiveClasses(wsPath, destTar string) error {
	matches, err := filepath.Glob(filepath.Join(wsPath, "*.class"))
	if err != nil || len(matches) == 0 {
		return fmt.Errorf("no class files found to archive in %s", wsPath)
	}
	tarFile, err := os.Create(destTar)
	if err != nil {
		return err
	}
	defer tarFile.Close()

	tw := tar.NewWriter(tarFile)
	defer tw.Close()

	for _, match := range matches {
		info, err := os.Stat(match)
		if err != nil {
			continue
		}
		hdr, err := tar.FileInfoHeader(info, "")
		if err != nil {
			continue
		}
		hdr.Name = filepath.Base(match)
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		data, err := os.ReadFile(match)
		if err != nil {
			return err
		}
		if _, err := tw.Write(data); err != nil {
			return err
		}
	}
	return nil
}

func extractClasses(srcTar, wsPath string) error {
	tarFile, err := os.Open(srcTar)
	if err != nil {
		return err
	}
	defer tarFile.Close()

	tr := tar.NewReader(tarFile)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		cleanName := filepath.Clean(hdr.Name)
		if strings.Contains(cleanName, "..") {
			continue
		}
		dest := filepath.Join(wsPath, cleanName)
		out, err := os.OpenFile(dest, os.O_CREATE|os.O_RDWR|os.O_TRUNC, 0777)
		if err != nil {
			return err
		}
		if _, err := io.Copy(out, tr); err != nil {
			out.Close()
			return err
		}
		out.Close()
	}
	return nil
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
		RunCmd:         []string{"python3", "/workspace/solution.py"},
		NeedsCompile:   false,
	},
	"javascript": {
		Image:          "node:20-alpine",
		SourceFileName: "solution.js",
		RunCmd:         []string{"node", "/workspace/solution.js"},
		NeedsCompile:   false,
	},
	"cpp": {
		Image:          "gcc:13",
		SourceFileName: "solution.cpp",
		CompileCmd:     []string{"g++", "-O3", "-std=c++20", "/workspace/solution.cpp", "-o", "/workspace/solution"},
		RunCmd:         []string{"/workspace/solution"},
		NeedsCompile:   true,
	},
	"c": {
		Image:          "gcc:13",
		SourceFileName: "solution.c",
		CompileCmd:     []string{"gcc", "-O3", "/workspace/solution.c", "-o", "/workspace/solution"},
		RunCmd:         []string{"/workspace/solution"},
		NeedsCompile:   true,
	},
	"java": {
		Image:          "eclipse-temurin:17-jdk-alpine",
		SourceFileName: "Main.java",
		CompileCmd:     []string{"javac", "-d", "/workspace", "/workspace/Main.java"},
		RunCmd:         []string{"java", "-cp", "/workspace", "Main"},
		NeedsCompile:   true,
	},
	"go": {
		Image:          "golang:1.22-alpine",
		SourceFileName: "main.go",
		CompileCmd:     []string{"go", "build", "-o", "/workspace/solution", "/workspace/main.go"},
		RunCmd:         []string{"/workspace/solution"},
		NeedsCompile:   true,
	},
	"rust": {
		Image:          "rust:alpine",
		SourceFileName: "solution.rs",
		CompileCmd:     []string{"rustc", "-O", "-o", "/workspace/solution", "/workspace/solution.rs"},
		RunCmd:         []string{"/workspace/solution"},
		NeedsCompile:   true,
	},
	"typescript": {
		Image:          "interleet-typescript:latest",
		SourceFileName: "solution.ts",
		CompileCmd:     []string{"sh", "-c", "tsc --skipLibCheck --target ES2020 --module commonjs /workspace/solution.ts 2>&1"},
		RunCmd:         []string{"node", "/workspace/solution.js"},
		NeedsCompile:   true,
	},
	"ts": {
		Image:          "interleet-typescript:latest",
		SourceFileName: "solution.ts",
		CompileCmd:     []string{"sh", "-c", "tsc --skipLibCheck --target ES2020 --module commonjs /workspace/solution.ts 2>&1"},
		RunCmd:         []string{"node", "/workspace/solution.js"},
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
			AttemptID:       job.AttemptID,
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
			AttemptID:       job.AttemptID,
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
			AttemptID:       job.AttemptID,
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
			AttemptID:       job.AttemptID,
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

	// 4. Compile Once inside the running container (with content-addressed caching)
	var compileDurationMS float64 = 0.0
	if spec.NeedsCompile {
		cacheDir := filepath.Join(e.workspaceBase, "compilation_cache", langStr)
		_ = os.MkdirAll(cacheDir, 0755)

		artifactName := "solution"
		if langStr == "typescript" || langStr == "ts" {
			artifactName = "solution.js"
		}
		dstPath := filepath.Join(wsPath, artifactName)

		keyRaw := fmt.Sprintf("%s|%s|%s", spec.Image, strings.Join(spec.CompileCmd, " "), code)
		cacheHash := fmt.Sprintf("%x", sha256.Sum256([]byte(keyRaw)))
		cachedArtifact := filepath.Join(cacheDir, cacheHash)

		cached := false
		if langStr == "java" {
			if info, err := os.Stat(cachedArtifact); err == nil && info.Size() > 0 {
				if extractErr := extractClasses(cachedArtifact, wsPath); extractErr == nil {
					cached = true
					log.Printf("⚡ [Job %s] Compilation cache hit for Java classes (%s)", jobID, cacheHash[:12])
				}
			}
		} else {
			if info, err := os.Stat(cachedArtifact); err == nil && info.Size() > 0 {
				if copyErr := copyFile(cachedArtifact, dstPath); copyErr == nil {
					_ = os.Chmod(dstPath, 0777)
					cached = true
					log.Printf("⚡ [Job %s] Compilation cache hit (%s)", jobID, cacheHash[:12])
				}
			}
		}

		if !cached {
			compStart := time.Now()
			compCtx, compCancel := context.WithTimeout(ctx, 15*time.Second)
			defer compCancel()

			compArgs := append([]string{"exec", "-w", "/workspace", containerName}, spec.CompileCmd...)
			cmd := exec.CommandContext(compCtx, e.dockerBin, compArgs...)
			out, err := cmd.CombinedOutput()
			compileDurationMS = float64(time.Since(compStart).Milliseconds())
			if err != nil {
				compOut := string(out)
				return registration.ResultRequest{
					JobID:           jobID,
					AttemptID:       job.AttemptID,
					Attempt:         job.Attempt,
					LeaseID:         job.LeaseID,
					Verdict:         "COMPILATION_ERROR",
					CompileTimeMS:   compileDurationMS,
					CompileOutput:   &compOut,
					TestcaseResults: []map[string]interface{}{},
				}
			}

			// Store artifact in cache atomically
			if langStr == "java" {
				tmpCached := fmt.Sprintf("%s.tmp.%d.tar", cachedArtifact, time.Now().UnixNano())
				if arcErr := archiveClasses(wsPath, tmpCached); arcErr == nil {
					_ = os.Chmod(tmpCached, 0777)
					_ = os.Rename(tmpCached, cachedArtifact)
				}
			} else {
				if info, err := os.Stat(dstPath); err == nil && info.Size() > 0 {
					_ = os.Chmod(dstPath, 0777)
					tmpCached := fmt.Sprintf("%s.tmp.%d", cachedArtifact, time.Now().UnixNano())
					if copyErr := copyFile(dstPath, tmpCached); copyErr == nil {
						_ = os.Chmod(tmpCached, 0777)
						_ = os.Rename(tmpCached, cachedArtifact)
					}
				}
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

	// 6. Capacity-aware bounded testcase execution
	concurrency := runtime.NumCPU()
	if concurrency > 4 {
		concurrency = 4
	}
	if langStr == "java" && concurrency > 2 {
		concurrency = 2
	}
	if concurrency < 1 {
		concurrency = 1
	}
	if len(rawTCs) == 1 {
		concurrency = 1
	}

	type tcOutcome struct {
		index   int
		result  map[string]interface{}
		runtime float64
		passed  bool
		verdict string
	}

	outcomes := make([]tcOutcome, 0, len(rawTCs))
	var outcomesMu sync.Mutex

	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	var earlyStopMu sync.Mutex
	earlyStopped := false

	for idx, raw := range rawTCs {
		earlyStopMu.Lock()
		if earlyStopped {
			earlyStopMu.Unlock()
			break
		}
		earlyStopMu.Unlock()

		sem <- struct{}{}
		wg.Add(1)

		go func(i int, tcRaw interface{}) {
			defer func() {
				<-sem
				wg.Done()
			}()

			earlyStopMu.Lock()
			if earlyStopped {
				earlyStopMu.Unlock()
				return
			}
			earlyStopMu.Unlock()

			tcMap, _ := tcRaw.(map[string]interface{})
			tcID, _ := tcMap["id"].(string)
			if tcID == "" {
				tcID = fmt.Sprintf("tc_%d", i+1)
			}
			stdin, _ := tcMap["stdin"].(string)
			expected, _ := tcMap["expected_output"].(string)
			hidden, _ := tcMap["hidden"].(bool)

			// Create isolated per-testcase execution directory
			tcRunDir := filepath.Join(wsPath, "runs", fmt.Sprintf("tc_%d", i))
			_ = os.MkdirAll(tcRunDir, 0777)

			tcCtx, tcCancel := context.WithTimeout(ctx, tcTimeout)
			defer tcCancel()

			start := time.Now()
			execArgs := append([]string{"exec", "-i", "-w", fmt.Sprintf("/workspace/runs/tc_%d", i), containerName}, spec.RunCmd...)
			cmd := exec.CommandContext(tcCtx, e.dockerBin, execArgs...)
			cmd.Stdin = strings.NewReader(stdin)
			var stdoutBuf, stderrBuf bytes.Buffer
			cmd.Stdout = &stdoutBuf
			cmd.Stderr = &stderrBuf

			err := cmd.Run()
			elapsed := time.Since(start)
			elapsedMS := float64(elapsed.Milliseconds())

			verdict := "ACCEPTED"
			passed := false

			envelope, userStdout := judge.ParseRunnerEnvelope(stdoutBuf.String())
			if envelope != nil {
				if envelope.Status == "FUNCTION_NOT_FOUND" {
					verdict = "FUNCTION_NOT_FOUND"
					passed = false
					if envelope.Error != "" {
						stderrBuf.WriteString("\n" + envelope.Error)
					}
				} else if envelope.Status == "RUNTIME_ERROR" {
					verdict = "RUNTIME_ERROR"
					passed = false
					if envelope.Error != "" {
						stderrBuf.WriteString("\n" + envelope.Error)
					}
				} else if envelope.Status == "SUCCESS" {
					actualOut := judge.FormatCanonicalValue(envelope.ReturnValue)
					expectedOut := strings.TrimRight(expected, "\r\n \t")
					if judge.CompareOutputs(actualOut, expectedOut) {
						passed = true
						verdict = "ACCEPTED"
					} else {
						verdict = "WRONG_ANSWER"
					}
				}
			} else if tcCtx.Err() == context.DeadlineExceeded {
				verdict = "TIME_LIMIT_EXCEEDED"
			} else if err != nil {
				verdict = "RUNTIME_ERROR"
			} else {
				actualOut := strings.TrimRight(stdoutBuf.String(), "\r\n \t")
				expectedOut := strings.TrimRight(expected, "\r\n \t")
				if judge.CompareOutputs(actualOut, expectedOut) {
					passed = true
					verdict = "ACCEPTED"
				} else {
					verdict = "WRONG_ANSWER"
				}
			}

			// Early termination trigger on non-ACCEPTED verdict
			if verdict != "ACCEPTED" && (hidden || i >= 2) {
				earlyStopMu.Lock()
				if !earlyStopped {
					earlyStopped = true
					log.Printf("⚡ [Job %s] Early termination triggered on %s (verdict=%s)", jobID, tcID, verdict)
				}
				earlyStopMu.Unlock()
			}

			displayStdout := stdoutBuf.String()
			if envelope != nil && envelope.Status == "SUCCESS" {
				displayStdout = judge.FormatCanonicalValue(envelope.ReturnValue)
			} else if envelope != nil {
				displayStdout = userStdout
			}

			displayStderr := stderrBuf.String()

			outcome := tcOutcome{
				index:   i,
				runtime: elapsedMS,
				passed:  passed,
				verdict: verdict,
				result: map[string]interface{}{
					"testcase_id":     tcID,
					"passed":          passed,
					"verdict":         verdict,
					"stdout":          displayStdout,
					"stderr":          displayStderr,
					"wall_time_ms":    elapsedMS,
					"expected_output": expected,
				},
			}

			outcomesMu.Lock()
			outcomes = append(outcomes, outcome)
			outcomesMu.Unlock()
		}(idx, raw)
	}

	wg.Wait()

	// Map executed outcomes by index
	outcomeMap := make(map[int]tcOutcome, len(outcomes))
	for _, o := range outcomes {
		outcomeMap[o.index] = o
	}

	tcResults := make([]map[string]interface{}, len(rawTCs))
	passedCount := 0
	var maxRuntimeMS float64 = 0.0
	finalVerdict := "ACCEPTED"

	for i, raw := range rawTCs {
		if o, ok := outcomeMap[i]; ok {
			tcResults[i] = o.result
			if o.runtime > maxRuntimeMS {
				maxRuntimeMS = o.runtime
			}
			if o.passed {
				passedCount++
			} else if finalVerdict == "ACCEPTED" {
				finalVerdict = o.verdict
			}
		} else {
			// Unexecuted testcase due to early stop
			tcMap, _ := raw.(map[string]interface{})
			tcID, _ := tcMap["id"].(string)
			if tcID == "" {
				tcID = fmt.Sprintf("tc_%d", i+1)
			}
			expected, _ := tcMap["expected_output"].(string)
			tcResults[i] = map[string]interface{}{
				"testcase_id":     tcID,
				"passed":          false,
				"verdict":         "NOT_EXECUTED",
				"stdout":          "",
				"stderr":          "",
				"wall_time_ms":    0.0,
				"expected_output": expected,
			}
		}
	}

	return registration.ResultRequest{
		JobID:           jobID,
		AttemptID:       job.AttemptID,
		Attempt:         job.Attempt,
		LeaseID:         job.LeaseID,
		Verdict:         finalVerdict,
		RuntimeMS:       maxRuntimeMS,
		CompileTimeMS:   compileDurationMS,
		MemoryMB:        28.5,
		TestcaseResults: tcResults,
	}
}
