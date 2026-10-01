package registration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"chaoscomputerclub.in/node-agent/internal/hardware"
)

// RegisterResponse represents control-plane configuration returned on registration.
type RegisterResponse struct {
	NodeID              string `json:"node_id"`
	Status              string `json:"status"`
	HeartbeatIntervalS  int    `json:"heartbeat_interval_s"`
	HeartbeatTTLS       int    `json:"heartbeat_ttl_s"`
	AssignedConcurrency int    `json:"assigned_concurrency"`
	APICapacity         int    `json:"api_capacity"`
	SSECapacity         int    `json:"sse_capacity"`
	JudgeCapacity       int    `json:"judge_capacity"`
	QueueName           string `json:"queue_name"`
}

// TelemetrySnapshot describes node telemetry emitted during heartbeat.
type TelemetrySnapshot struct {
	CPUUsagePct       float64 `json:"cpu_usage_pct"`
	MemoryUsagePct    float64 `json:"memory_usage_pct"`
	AvailableMemoryMB int64   `json:"available_memory_mb"`
	RunningJobs       int     `json:"running_jobs"`
	AvailableSlots    int     `json:"available_slots"`
	APIActive         int     `json:"api_active"`
	SSEActive         int     `json:"sse_active"`
	JudgeActive       int     `json:"judge_active"`
	NetworkStatus     string  `json:"network_status"`
	DockerStatus      string  `json:"docker_status"`
}

// JobPayload represents a claimed execution job from the queue.
type JobPayload struct {
	JobID   string                 `json:"id"`
	JobType string                 `json:"job_type"`
	Attempt int                    `json:"attempt"`
	LeaseID string                 `json:"lease_id"`
	Payload map[string]interface{} `json:"payload"`
}

// ResultRequest represents execution results returned to control plane.
type ResultRequest struct {
	JobID           string                   `json:"job_id"`
	Attempt         int                      `json:"attempt"`
	LeaseID         string                   `json:"lease_id"`
	Verdict         string                   `json:"verdict"`
	RuntimeMS       float64                  `json:"runtime_ms"`
	MemoryMB        float64                  `json:"memory_mb"`
	TestcaseResults []map[string]interface{} `json:"testcase_results"`
	CompileOutput   *string                  `json:"compile_output"`
	Error           *string                  `json:"error"`
}

// Client interacts with Central Control Plane REST APIs.
type Client struct {
	baseURL         string
	enrollmentToken string
	httpClient      *http.Client
}

func NewClient(baseURL, enrollmentToken string) *Client {
	return &Client{
		baseURL:         strings.TrimRight(baseURL, "/"),
		enrollmentToken: strings.TrimSpace(enrollmentToken),
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (c *Client) Register(ctx context.Context, caps *hardware.NodeCapabilities) (*RegisterResponse, error) {
	body, err := json.Marshal(caps)
	if err != nil {
		return nil, fmt.Errorf("marshal register payload: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/nodes/register", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("register status %d: %s", resp.StatusCode, string(respBody))
	}

	var regResp RegisterResponse
	if err := json.NewDecoder(resp.Body).Decode(&regResp); err != nil {
		return nil, fmt.Errorf("decode register response: %w", err)
	}
	return &regResp, nil
}

func (c *Client) Heartbeat(ctx context.Context, nodeID string, snap *TelemetrySnapshot) error {
	body, err := json.Marshal(snap)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/api/v1/nodes/%s/heartbeat", c.baseURL, nodeID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("heartbeat status %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func (c *Client) ClaimJob(ctx context.Context, nodeID string, timeoutSeconds float64) (*JobPayload, error) {
	reqBody := map[string]float64{"timeout_seconds": timeoutSeconds}
	body, _ := json.Marshal(reqBody)

	url := fmt.Sprintf("%s/api/v1/nodes/%s/claim", c.baseURL, nodeID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("claim status %d: %s", resp.StatusCode, string(respBody))
	}

	var data struct {
		Job *JobPayload `json:"job"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	return data.Job, nil
}

func (c *Client) SubmitResult(ctx context.Context, nodeID string, res ResultRequest) error {
	if res.TestcaseResults == nil {
		res.TestcaseResults = make([]map[string]interface{}, 0)
	}
	body, err := json.Marshal(res)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/api/v1/nodes/%s/result", c.baseURL, nodeID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("submit status %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func (c *Client) Drain(ctx context.Context, nodeID string) error {
	url := fmt.Sprintf("%s/api/v1/nodes/%s/drain", c.baseURL, nodeID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return err
	}
	c.setHeaders(req)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (c *Client) Ready(ctx context.Context, nodeID string) error {
	url := fmt.Sprintf("%s/api/v1/nodes/%s/ready", c.baseURL, nodeID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return err
	}
	c.setHeaders(req)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (c *Client) Unregister(ctx context.Context, nodeID string) error {
	url := fmt.Sprintf("%s/api/v1/nodes/%s/unregister", c.baseURL, nodeID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return err
	}
	c.setHeaders(req)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (c *Client) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if c.enrollmentToken != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.enrollmentToken))
	}
}
