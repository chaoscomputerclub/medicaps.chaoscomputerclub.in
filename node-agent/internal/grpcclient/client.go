package grpcclient

import (
	"context"
	"crypto/tls"
	"fmt"
	"strings"
	"time"

	"chaoscomputerclub.in/node-agent/internal/pb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
)

// Client wraps the gRPC FabricControlPlaneClient stub with auto-reconnect and retry.
type Client struct {
	conn   *grpc.ClientConn
	stub   pb.FabricControlPlaneClient
	target string
}

func NewClient(target string, useTLS bool) (*Client, error) {
	// Strip scheme if present
	cleanTarget := strings.TrimPrefix(target, "https://")
	cleanTarget = strings.TrimPrefix(cleanTarget, "http://")
	cleanTarget = strings.TrimPrefix(cleanTarget, "grpc://")
	cleanTarget = strings.TrimPrefix(cleanTarget, "grpcs://")

	var creds credentials.TransportCredentials
	if useTLS {
		creds = credentials.NewTLS(&tls.Config{
			InsecureSkipVerify: false,
		})
	} else {
		creds = insecure.NewCredentials()
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(
		ctx,
		cleanTarget,
		grpc.WithTransportCredentials(creds),
		grpc.WithBlock(),
	)
	if err != nil {
		// Non-blocking fallback connection so agent can start and retry in background
		conn, err = grpc.Dial(cleanTarget, grpc.WithTransportCredentials(creds))
		if err != nil {
			return nil, fmt.Errorf("failed to dial gRPC endpoint %s: %w", cleanTarget, err)
		}
	}

	return &Client{
		conn:   conn,
		stub:   pb.NewFabricControlPlaneClient(conn),
		target: cleanTarget,
	}, nil
}

func (c *Client) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

func (c *Client) Register(
	ctx context.Context,
	req *pb.RegisterNodeRequest,
) (*pb.RegisterNodeResponse, error) {
	return c.stub.RegisterNode(ctx, req)
}

func (c *Client) Heartbeat(
	ctx context.Context,
	req *pb.HeartbeatRequest,
) (*pb.HeartbeatResponse, error) {
	return c.stub.SendHeartbeat(ctx, req)
}

func (c *Client) Drain(
	ctx context.Context,
	nodeID, reason string,
) (*pb.DrainNodeResponse, error) {
	return c.stub.DrainNode(ctx, &pb.DrainNodeRequest{
		NodeId: nodeID,
		Reason: reason,
	})
}

func (c *Client) Ready(
	ctx context.Context,
	nodeID string,
) (*pb.ReadyNodeResponse, error) {
	return c.stub.MarkReady(ctx, &pb.ReadyNodeRequest{
		NodeId: nodeID,
	})
}

func (c *Client) Claim(
	ctx context.Context,
	nodeID string,
	timeoutSec float32,
) (*pb.ClaimJobResponse, error) {
	return c.stub.ClaimJob(ctx, &pb.ClaimJobRequest{
		NodeId:         nodeID,
		TimeoutSeconds: timeoutSec,
	})
}

func (c *Client) SubmitResult(
	ctx context.Context,
	res *pb.SubmitResultRequest,
) (*pb.SubmitResultResponse, error) {
	return c.stub.SubmitResult(ctx, res)
}
