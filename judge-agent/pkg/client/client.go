package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"chaoscomputerclub.in/judge-agent/pkg/discovery"
	"chaoscomputerclub.in/judge-agent/pkg/governor"
)

// RegisterResponse received from control plane.
type RegisterResponse struct {
	NodeID              string `json:"node_id"`
	Status              string `json:"status"`
	HeartbeatIntervalS  int    `json:"heartbeat_interval_s"`
	HeartbeatTTLS       int    `json:"heartbeat_ttl_s"`
	AssignedConcurrency int    `json:"assigned_concurrency"`
	QueueName           string `json:"queue_name"`
}

// JobPayload represents the work item to execute.
type JobPayload struct {
	JobID       string                 `json:"id"`
	Status      string                 `json:"status"`
	QueueName   string                 `json:"queue_name"`
	Payload     map[string]interface{} `json:"payload"`
	CreatedAt   string                 `json:"created_at"`
	Priority    string                 `json:"priority"`
}

// ClaimResponse holds claimed job if any.
type ClaimResponse struct {
	Job *JobPayload `json:"job"`
}

// ResultRequest holds execution verdict and testcase breakdown.
type ResultRequest struct {
	JobID           string                   `json:"job_id"`
	Verdict         string                   `json:"verdict"`
	RuntimeMS       float64                  `json:"runtime_ms"`
	MemoryMB        float64                  `json:"memory_mb"`
	TestcaseResults []map[string]interface{} `json:"testcase_results"`
	CompileOutput   string                   `json:"compile_output,omitempty"`
	Error           string                   `json:"error,omitempty"`
}

// ControlPlaneClient executes authenticated REST communication with the FastAPI control plane.
type ControlPlaneClient struct {
	baseURL   string
	authToken string
	client    *http.Client
}

// NewControlPlaneClient initializes a pooled HTTP client.
func NewControlPlaneClient(baseURL, authToken string) *ControlPlaneClient {
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
	}
	return &ControlPlaneClient{
		baseURL:   baseURL,
		authToken: authToken,
		client: &http.Client{
			Transport: transport,
			Timeout:   15 * time.Second,
		},
	}
}

// Register posts hardware discovery capabilities and receives central scheduler authorization.
func (c *ControlPlaneClient) Register(ctx context.Context, caps *discovery.NodeCapabilities) (*RegisterResponse, error) {
	url := fmt.Sprintf("%s/nodes/register", c.baseURL)
	body, err := json.Marshal(caps)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	c.setHeaders(req)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("register network failure: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("register rejected with status %d: %s", resp.StatusCode, string(respBody))
	}

	var regResp RegisterResponse
	if err := json.NewDecoder(resp.Body).Decode(&regResp); err != nil {
		return nil, fmt.Errorf("invalid register response JSON: %w", err)
	}

	return &regResp, nil
}

// Heartbeat sends periodic telemetry ping.
func (c *ControlPlaneClient) Heartbeat(ctx context.Context, nodeID string, snap governor.TelemetrySnapshot) error {
	url := fmt.Sprintf("%s/nodes/%s/heartbeat", c.baseURL, nodeID)
	body, err := json.Marshal(snap)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	c.setHeaders(req)

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("heartbeat error %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// ClaimJob requests an available execution job from the queue.
func (c *ControlPlaneClient) ClaimJob(ctx context.Context, nodeID string, timeoutSec float64) (*JobPayload, error) {
	url := fmt.Sprintf("%s/nodes/%s/claim", c.baseURL, nodeID)
	payload := map[string]float64{"timeout_seconds": timeoutSec}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	c.setHeaders(req)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("claim error %d: %s", resp.StatusCode, string(respBody))
	}

	var claimResp ClaimResponse
	if err := json.NewDecoder(resp.Body).Decode(&claimResp); err != nil {
		return nil, err
	}

	return claimResp.Job, nil
}

// SubmitResult posts verified execution results back to the control plane.
func (c *ControlPlaneClient) SubmitResult(ctx context.Context, nodeID string, res ResultRequest) error {
	url := fmt.Sprintf("%s/nodes/%s/result", c.baseURL, nodeID)
	body, err := json.Marshal(res)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	c.setHeaders(req)

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("result submit error %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// Drain informs the control plane that the node is preparing to disconnect.
func (c *ControlPlaneClient) Drain(ctx context.Context, nodeID string) error {
	url := fmt.Sprintf("%s/nodes/%s/drain", c.baseURL, nodeID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return err
	}
	c.setHeaders(req)

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// Unregister cleanly removes the node from the cluster registry.
func (c *ControlPlaneClient) Unregister(ctx context.Context, nodeID string) error {
	url := fmt.Sprintf("%s/nodes/%s/unregister", c.baseURL, nodeID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return err
	}
	c.setHeaders(req)

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (c *ControlPlaneClient) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "CCC-Judge-Agent/2.0 (Go)")
	if c.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.authToken)
	}
}
