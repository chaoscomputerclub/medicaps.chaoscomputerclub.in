/**
 * Chaos Computer Club — Medi-Caps Chapter
 * Cloudflare Worker: Global Dynamic Edge Ingress & Load Balancing Fabric
 *
 * Architecture Principles:
 * - Sub-5ms edge latency overhead.
 * - Global Load Balancing across multi-cloud peers (Railway, Render, Koyeb, Cloud Run, VPS).
 * - Dynamic Round-Robin & IP-hash affinity with instant zero-downtime failover.
 * - Active edge circuit-breaker with ephemeral peer health caching.
 * - Dedicated judge execution routing for distributed sandboxes.
 * - Streaming pass-through for Server-Sent Events (SSE).
 */

// Ephemeral in-memory edge state for peer health & round-robin counters
const peerHealthState = new Map(); // peerUrl -> { failures: number, lastFailedAt: number }
let roundRobinIndex = 0;

const DEFAULT_ROUTER_PEERS = [
  "https://ccc-medicaps-peer.onrender.com",
];

export default {
  async fetch(request, env, ctx) {
    const startTime = performance.now();

    // 1. Instant CORS Preflight Handling (0ms backend overhead)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-Peer-Id, X-Peer-Signature, Last-Event-ID, X-Auth-Token",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const clientIp = request.headers.get("cf-connecting-ip") || "0.0.0.0";

    // 2. Static Frontend Routing (Vercel Global Edge)
    if (!path.startsWith("/api/") && !path.startsWith("/submissions")) {
      const frontendOrigin = env.FRONTEND_ORIGIN || "https://medicaps.chaoscomputerclub.in";
      const targetUrl = new URL(path + url.search, frontendOrigin);
      return fetch(new Request(targetUrl, request));
    }

    // 3. Fast Edge Health Check (Sub-millisecond probe for DNS / WAF / Load Balancer audits)
    if (path === "/api/health/edge") {
      const configuredPeers = (env.ROUTER_PEERS || DEFAULT_ROUTER_PEERS.join(","))
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const configuredJudges = (env.JUDGE_PEERS || "")
        .split(",")
        .map((j) => j.trim())
        .filter(Boolean);

      return new Response(
        JSON.stringify({
          status: "healthy",
          role: "global_edge_load_balancer",
          colo: request.cf?.colo || "global",
          country: request.cf?.country || "IN",
          protocol: "ccc-p2p-fabric-v2",
          load_balancer: {
            strategy: "dynamic_health_round_robin_failover",
            configured_api_peers: configuredPeers,
            configured_judge_peers: configuredJudges,
            active_pool_size: configuredPeers.length,
          },
          edge_latency_ms: Math.round((performance.now() - startTime) * 100) / 100,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "X-Load-Balancer-Algo": "dynamic_health_round_robin",
          },
        }
      );
    }

    // 4. Resolve Peer Pool (API Peers or Dedicated Judge Peers)
    const isJudgeDirectPath = path.startsWith("/api/judge/") || path.startsWith("/submissions");
    let poolOrigins = [];

    if (isJudgeDirectPath && env.JUDGE_PEERS) {
      poolOrigins = env.JUDGE_PEERS.split(",").map((p) => p.trim()).filter(Boolean);
    }

    if (poolOrigins.length === 0) {
      poolOrigins = (env.ROUTER_PEERS || DEFAULT_ROUTER_PEERS.join(","))
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    }

    if (poolOrigins.length === 0) {
      poolOrigins = DEFAULT_ROUTER_PEERS;
    }

    // 5. Intelligent Load Balancing & Candidate Ordering
    const now = Date.now();
    const sortedPeers = [...poolOrigins].sort((a, b) => {
      const aState = peerHealthState.get(a);
      const bState = peerHealthState.get(b);
      const aCooldown = aState && now - aState.lastFailedAt < 15000;
      const bCooldown = bState && now - bState.lastFailedAt < 15000;
      if (aCooldown && !bCooldown) return 1;
      if (!aCooldown && bCooldown) return -1;
      return 0;
    });

    // Round-Robin offset for fair distribution among healthy candidates
    const healthyCount = sortedPeers.filter((p) => {
      const s = peerHealthState.get(p);
      return !s || now - s.lastFailedAt >= 15000;
    }).length || sortedPeers.length;

    const offset = roundRobinIndex % healthyCount;
    roundRobinIndex = (roundRobinIndex + 1) % 1000000;

    const orderedPeers = [
      ...sortedPeers.slice(offset, healthyCount),
      ...sortedPeers.slice(0, offset),
      ...sortedPeers.slice(healthyCount),
    ];

    // Clone request body once if needed for retries
    const requestMethod = request.method;
    const isStreamable = path.startsWith("/api/events/");
    let bodyData = null;
    if (requestMethod !== "GET" && requestMethod !== "HEAD" && !isStreamable) {
      bodyData = await request.arrayBuffer();
    }

    let lastError = null;
    let attemptedCount = 0;

    for (let i = 0; i < orderedPeers.length; i++) {
      const peerOrigin = orderedPeers[i];
      const targetUrl = new URL(path + url.search, peerOrigin);
      attemptedCount++;

      try {
        const proxyHeaders = new Headers(request.headers);
        proxyHeaders.set("X-Forwarded-Host", url.host);
        proxyHeaders.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
        proxyHeaders.set("X-Edge-Colo", request.cf?.colo || "global");
        proxyHeaders.set("X-Load-Balancer-Hop", String(i + 1));

        const isMultiPeer = orderedPeers.length > 1;
        // Fast 7s timeout for intermediate peers when alternatives exist, 45s for last peer or SSE
        const peerTimeoutMs = isStreamable ? 300000 : (isMultiPeer && i < orderedPeers.length - 1 ? 7000 : 45000);

        const proxyReq = new Request(targetUrl, {
          method: requestMethod,
          headers: proxyHeaders,
          body: bodyData ? bodyData.slice(0) : request.body,
          redirect: "manual",
          signal: isStreamable ? undefined : AbortSignal.timeout(peerTimeoutMs),
        });

        const response = await fetch(proxyReq);

        // Detect provider dead-ends (Render no-server, Railway down, Cloud Run 404 HTML, 502/503/504)
        const contentType = (response.headers.get("content-type") || "").toLowerCase();
        const isProviderDead = (
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504 ||
          (response.status === 404 && (
            contentType.includes("text/html") ||
            contentType.includes("text/plain") ||
            response.headers.get("x-render-routing") === "no-server" ||
            response.headers.get("x-railway-error") !== null ||
            response.headers.get("x-koyeb-error") !== null
          ))
        );

        if (isProviderDead) {
          peerHealthState.set(peerOrigin, {
            failures: ((peerHealthState.get(peerOrigin)?.failures || 0) + 1),
            lastFailedAt: Date.now(),
          });

          if (i < orderedPeers.length - 1) {
            continue; // Transparent failover to next peer in pool
          }
          lastError = new Error(`Peer '${peerOrigin}' unreachable or unconfigured (HTTP ${response.status})`);
          break;
        }

        // Peer responded successfully — mark healthy and clear failure count
        peerHealthState.set(peerOrigin, { failures: 0, lastFailedAt: 0 });

        const newHeaders = new Headers(response.headers);
        newHeaders.set("Access-Control-Allow-Origin", "*");
        newHeaders.set("Access-Control-Allow-Credentials", "true");
        newHeaders.set("X-Routed-By-Peer", peerOrigin);
        newHeaders.set("X-Peer-Pool-Size", String(poolOrigins.length));
        newHeaders.set("X-Load-Balancer-Algo", "dynamic_health_round_robin");
        newHeaders.set("X-Edge-Colo", request.cf?.colo || "global");

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      } catch (err) {
        lastError = err;
        peerHealthState.set(peerOrigin, {
          failures: ((peerHealthState.get(peerOrigin)?.failures || 0) + 1),
          lastFailedAt: Date.now(),
        });
        // Proceed to next peer
      }
    }

    // 6. Clean Edge Fallback for Authentication & Health Probing
    if (path === "/api/auth/refresh" || path === "/api/auth/me") {
      return new Response(
        JSON.stringify({
          detail: "No active session or refresh token provided",
          authenticated: false,
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    if (path === "/api/health") {
      return new Response(
        JSON.stringify({
          status: "waking_up",
          chapter: "Chaos Computer Club — Medi-Caps University",
          protocol: "ccc-p2p-fabric-v2",
          notice: "Backend compute peers (Render/Railway) are currently starting or awaiting connection.",
          configured_peers: poolOrigins,
          attempted_hops: attemptedCount,
          edge_colo: request.cf?.colo || "global",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // 7. Structured Degraded Error Response
    return new Response(
      JSON.stringify({
        error: "All data-plane router peers unreachable or unconfigured",
        detail: lastError ? lastError.message : "No active compute peers in fabric pool",
        protocol: "ccc-p2p-fabric-v2",
        configured_peers: poolOrigins,
        attempted_peers: attemptedCount,
        recovery_hint: "Connect a backend compute peer (Render/Railway) or run ./scripts/sync_global_load_balancer.sh",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  },
};
