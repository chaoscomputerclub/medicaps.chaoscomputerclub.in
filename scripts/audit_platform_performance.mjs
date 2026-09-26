#!/usr/bin/env node

/**
 * Chaos Computer Club India — Medi-Caps Chapter Platform
 * Autonomous Global Performance & Resource Consumption Auditor
 *
 * Exhaustively probes, benchmarks, and profiles:
 * 1. Frontend Bundle & Asset Footprint (Vite chunks, Monaco, Workers, CSS)
 * 2. FastAPI Backend Latency & Percentiles (P50, P90, P95, P99)
 * 3. Multi-Tier Caching Efficiency (Client SWR, Redis Cache-Aside, Hit vs Miss)
 * 4. PostgreSQL 16 Query & Index Efficiency (Leaderboard filtering, Pagination)
 * 5. Real-Time Server-Sent Events (SSE) Stream Handshake & Health
 * 6. CodeBox Sandbox Execution Cluster Readiness & Provider State
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const API_BASE = process.env.API_BASE_URL || 'https://medicaps-api.chaoscomputerclub.in/api';
const REPORT_OUTPUT_PATH = path.join(ROOT_DIR, '.planning', 'qa', 'performance_audit_report.json');

// ANSI Color Helpers
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42;30m',
  bgYellow: '\x1b[43;30m',
  bgRed: '\x1b[41;37m',
  bgCyan: '\x1b[46;30m',
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function computePercentile(numbers, p) {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function fetchWithTiming(url, options = {}, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const start = performance.now();
    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(options.timeout || 12000),
      });
      const latency = Math.round((performance.now() - start) * 10) / 10;
      let body = null;
      let text = '';
      try {
        text = await res.text();
        body = JSON.parse(text);
      } catch {
        body = text;
      }

      return {
        ok: res.ok,
        status: res.status,
        headers: res.headers,
        latency,
        data: body,
        rawLength: text.length,
      };
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      return {
        ok: false,
        status: err.name === 'TimeoutError' ? 408 : 0,
        headers: new Headers(),
        latency: Math.round((performance.now() - start) * 10) / 10,
        error: err.message,
        data: null,
        rawLength: 0,
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1: FRONTEND BUNDLE & ASSET AUDIT
// ─────────────────────────────────────────────────────────────────────────────
function auditFrontendBundle() {
  const distDir = path.join(ROOT_DIR, 'dist', 'assets');
  if (!fs.existsSync(distDir)) {
    return {
      status: 'SKIPPED',
      message: 'dist/assets directory not found. Run `npm run build` first.',
      assets: [],
      totals: { rawBytes: 0, gzipBytes: 0, fileCount: 0 },
    };
  }

  const files = fs.readdirSync(distDir);
  const assets = [];
  let totalRaw = 0;
  let totalGzip = 0;

  for (const file of files) {
    const filePath = path.join(distDir, file);
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) continue;

    const content = fs.readFileSync(filePath);
    const gzip = zlib.gzipSync(content);

    let category = 'other';
    if (file.endsWith('.css')) category = 'css';
    else if (file.includes('worker')) category = 'monaco_worker';
    else if (file.includes('monaco')) category = 'monaco_editor';
    else if (file.includes('charts')) category = 'charts';
    else if (file.includes('Page-')) category = 'route_page';
    else if (file.includes('vendor-react') || file.includes('vendor-radix') || file.includes('index-')) category = 'core_ui';
    else if (file.endsWith('.js')) category = 'js_chunk';

    totalRaw += stats.size;
    totalGzip += gzip.length;

    assets.push({
      name: file,
      category,
      rawBytes: stats.size,
      gzipBytes: gzip.length,
    });
  }

  const coreUI = assets.filter((a) => a.category === 'core_ui');
  const coreRawBytes = coreUI.reduce((acc, a) => acc + a.rawBytes, 0);
  const coreGzipBytes = coreUI.reduce((acc, a) => acc + a.gzipBytes, 0);

  const workers = assets.filter((a) => a.category === 'monaco_worker');
  const workerRawBytes = workers.reduce((acc, a) => acc + a.rawBytes, 0);

  const monacoEditor = assets.filter((a) => a.category === 'monaco_editor');
  const monacoRawBytes = monacoEditor.reduce((acc, a) => acc + a.rawBytes, 0);

  return {
    status: 'COMPLETE',
    fileCount: assets.length,
    totalRawBytes: totalRaw,
    totalGzipBytes: totalGzip,
    coreUIRawBytes: coreRawBytes,
    coreUIGzipBytes: coreGzipBytes,
    workerRawBytes,
    monacoRawBytes,
    assets: assets.sort((a, b) => b.rawBytes - a.rawBytes),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2: FASTAPI BACKEND LATENCY & PERCENTILE BENCHMARK
// ─────────────────────────────────────────────────────────────────────────────
async function benchmarkBackendEndpoints(samplesPerEndpoint = 5) {
  const endpoints = [
    { name: 'System Health', path: '/health', targetLatencyMs: 300 },
    { name: 'Public Key Handshake', path: '/auth/jwt-public-key', targetLatencyMs: 250 },
    { name: 'Official Contests List', path: '/contests', targetLatencyMs: 350 },
    { name: 'University Leaderboard', path: '/leaderboard', targetLatencyMs: 400 },
    { name: 'Rating Distribution', path: '/leaderboard/distribution', targetLatencyMs: 350 },
  ];

  const results = [];

  for (const ep of endpoints) {
    const latencies = [];
    let lastResponse = null;

    for (let i = 0; i < samplesPerEndpoint; i++) {
      const res = await fetchWithTiming(`${API_BASE}${ep.path}`, {
        headers: { 'Accept': 'application/json' },
      });
      lastResponse = res;
      if (res.ok) {
        latencies.push(res.latency);
      }
      await new Promise((r) => setTimeout(r, 60));
    }

    if (latencies.length === 0) {
      results.push({
        name: ep.name,
        path: ep.path,
        status: lastResponse ? lastResponse.status : 0,
        success: false,
        error: lastResponse?.error || 'All sample probes failed',
      });
      continue;
    }

    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const avg = Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 10) / 10;
    const p50 = computePercentile(latencies, 50);
    const p90 = computePercentile(latencies, 90);
    const p95 = computePercentile(latencies, 95);
    const p99 = computePercentile(latencies, 99);

    const passed = p95 <= ep.targetLatencyMs * 1.5;

    results.push({
      name: ep.name,
      path: ep.path,
      status: lastResponse.status,
      success: true,
      samples: latencies.length,
      min,
      max,
      avg,
      p50,
      p90,
      p95,
      p99,
      targetMs: ep.targetLatencyMs,
      passed,
      headers: {
        cacheControl: lastResponse.headers.get('cache-control'),
        xCache: lastResponse.headers.get('x-cache'),
        contentEncoding: lastResponse.headers.get('content-encoding'),
      },
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3: CACHE-ASIDE (REDIS & SWR) EFFICIENCY BENCHMARK
// ─────────────────────────────────────────────────────────────────────────────
async function benchmarkCachingTier() {
  const probeEndpoint = `${API_BASE}/leaderboard`;

  // 1. Cold Request (Force Cache-Bypass)
  const coldRes = await fetchWithTiming(probeEndpoint, {
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Accept': 'application/json',
    },
  });

  await new Promise((r) => setTimeout(r, 80));

  // 2. Warm Request (Normal Client Hit)
  const warmRes = await fetchWithTiming(probeEndpoint, {
    headers: {
      'Accept': 'application/json',
    },
  });

  const coldLatency = coldRes.latency;
  const warmLatency = warmRes.latency;
  const speedup = warmLatency > 0 ? (coldLatency / warmLatency).toFixed(2) : 'N/A';
  const warmCacheHeader = warmRes.headers?.get('x-cache') || 'UNKNOWN';

  return {
    endpoint: '/leaderboard',
    coldLatencyMs: coldLatency,
    warmLatencyMs: warmLatency,
    speedupMultiplier: speedup,
    coldStatus: coldRes.status,
    warmStatus: warmRes.status,
    warmXCache: warmCacheHeader,
    cacheControlDirective: warmRes.headers?.get('cache-control') || 'none',
    passed: warmRes.ok && (warmCacheHeader.toUpperCase().includes('HIT') || warmLatency <= coldLatency),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4: POSTGRESQL 16 QUERY & FILTERING LATENCY AUDIT
// ─────────────────────────────────────────────────────────────────────────────
async function auditDatabaseQueries() {
  const queryCases = [
    { name: 'Unfiltered Baseline', query: '' },
    { name: 'Department Filter (CSE)', query: '?department=CSE' },
    { name: 'Batch Filter (2024-28)', query: '?batch=2024-28' },
    { name: 'Star Division (3_star)', query: '?tier=3_star' },
    { name: 'Deep Pagination (Offset 50)', query: '?offset=50&limit=50' },
  ];

  const results = [];

  for (const qc of queryCases) {
    const res = await fetchWithTiming(`${API_BASE}/leaderboard${qc.query}`, {
      headers: { 'Cache-Control': 'no-cache' }, // Force DB hit
    });

    results.push({
      name: qc.name,
      query: qc.query || '(default)',
      status: res.status,
      latencyMs: res.latency,
      totalCountHeader: res.headers?.get('x-total-count'),
      pageSizeHeader: res.headers?.get('x-page-size'),
      passed: res.ok && res.latency < 1200,
    });
    await new Promise((r) => setTimeout(r, 60));
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 5: REAL-TIME SSE STREAM AUDIT
// ─────────────────────────────────────────────────────────────────────────────
async function auditRealtimeSseStream() {
  const sseUrl = `${API_BASE}/events/stream`;
  const start = performance.now();

  return new Promise((resolve) => {
    let settled = false;
    let firstFrame = null;
    let isConnectedPreamble = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({
          endpoint: '/events/stream',
          connected: isConnectedPreamble,
          handshakeLatencyMs: Math.round(performance.now() - start),
          firstFrame,
          passed: isConnectedPreamble,
          note: isConnectedPreamble ? 'Connected successfully with preamble' : 'Timed out waiting for SSE handshake',
        });
      }
    }, 4500);

    fetch(sseUrl, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(5000),
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          clearTimeout(timeout);
          settled = true;
          resolve({
            endpoint: '/events/stream',
            connected: false,
            handshakeLatencyMs: Math.round(performance.now() - start),
            status: res.status,
            passed: false,
            note: `HTTP error: ${res.status}`,
          });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (!settled) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!firstFrame) firstFrame = chunk.trim();
          if (chunk.includes(': connected') || chunk.includes('data:')) {
            isConnectedPreamble = true;
            clearTimeout(timeout);
            settled = true;
            reader.cancel();
            resolve({
              endpoint: '/events/stream',
              connected: true,
              handshakeLatencyMs: Math.round(performance.now() - start),
              firstFrame: chunk.trim().slice(0, 100),
              passed: true,
              note: 'Preamble received; stream verified',
            });
            break;
          }
        }
      })
      .catch((err) => {
        if (!settled) {
          clearTimeout(timeout);
          settled = true;
          resolve({
            endpoint: '/events/stream',
            connected: false,
            handshakeLatencyMs: Math.round(performance.now() - start),
            passed: false,
            note: err.message,
          });
        }
      });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 6: CODEBOX SANDBOX & EXECUTION ENGINE READINESS
// ─────────────────────────────────────────────────────────────────────────────
async function auditExecutionCluster() {
  const healthRes = await fetchWithTiming(`${API_BASE}/health`);
  let services = {};
  if (healthRes.ok && healthRes.data && healthRes.data.services) {
    services = healthRes.data.services;
  }

  const judgeProvider = services.judge_provider || 'unknown';
  const judgeHealthy = Boolean(services.judge_healthy);
  const redisHealthy = services.redis === 'ok';

  return {
    provider: judgeProvider,
    judgeHealthy,
    redisHealthy,
    healthLatencyMs: healthRes.latency,
    passed: healthRes.ok && judgeHealthy && redisHealthy,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT GENERATOR & TACTICAL TERMINAL PRINTER
// ─────────────────────────────────────────────────────────────────────────────
async function runFullPlatformAudit() {
  console.log(`\n${C.bold}${C.bgCyan} 🚀 CHAOS COMPUTER CLUB — COMPREHENSIVE PERFORMANCE & RESOURCE AUDITOR ${C.reset}`);
  console.log(`${C.dim}Target API: ${API_BASE} | Timestamp: ${new Date().toISOString()}${C.reset}\n`);

  // Run modules
  process.stdout.write(`${C.cyan}▸ Auditing Frontend Static Assets & Bundles...${C.reset} `);
  const frontendAudit = auditFrontendBundle();
  console.log(`${C.green}✓ Done${C.reset}`);

  process.stdout.write(`${C.cyan}▸ Benchmarking FastAPI Backend & Endpoints...${C.reset} `);
  const backendAudit = await benchmarkBackendEndpoints(4);
  console.log(`${C.green}✓ Done${C.reset}`);

  process.stdout.write(`${C.cyan}▸ Testing Multi-Tier Caching (Redis Cache-Aside & SWR)...${C.reset} `);
  const cacheAudit = await benchmarkCachingTier();
  console.log(`${C.green}✓ Done${C.reset}`);

  process.stdout.write(`${C.cyan}▸ Auditing PostgreSQL 16 Query & Index Response Profiles...${C.reset} `);
  const dbAudit = await auditDatabaseQueries();
  console.log(`${C.green}✓ Done${C.reset}`);

  process.stdout.write(`${C.cyan}▸ Probing Real-Time SSE Stream Handshake...${C.reset} `);
  const sseAudit = await auditRealtimeSseStream();
  console.log(`${C.green}✓ Done${C.reset}`);

  process.stdout.write(`${C.cyan}▸ Inspecting CodeBox Sandbox & Execution Engine...${C.reset} `);
  const sandboxAudit = await auditExecutionCluster();
  console.log(`${C.green}✓ Done${C.reset}\n`);

  // Render Table 1: Frontend Bundle
  console.log(`${C.bold}1. FRONTEND BUNDLE & ASSET CONSUMPTION${C.reset}`);
  console.log('─'.repeat(80));
  if (frontendAudit.status === 'COMPLETE') {
    console.log(`  Total Bundle Size:      ${C.bold}${formatBytes(frontendAudit.totalRawBytes)}${C.reset} (Gzip: ${formatBytes(frontendAudit.totalGzipBytes)})`);
    console.log(`  Initial Core UI Bundle:  ${C.green}${formatBytes(frontendAudit.coreUIRawBytes)}${C.reset} (Gzip: ${C.green}${formatBytes(frontendAudit.coreUIGzipBytes)}${C.reset})`);
    console.log(`  Monaco Code Editor:      ${C.yellow}${formatBytes(frontendAudit.monacoRawBytes)}${C.reset} (Isolated via lazy chunk)`);
    console.log(`  Language Workers Total:  ${frontendAudit.workerRawBytes > 5000000 ? C.red : C.yellow}${formatBytes(frontendAudit.workerRawBytes)}${C.reset} (Optimization target: prune unused workers)`);
  } else {
    console.log(`  ${C.yellow}⚠ ${frontendAudit.message}${C.reset}`);
  }
  console.log('─'.repeat(80));

  // Render Table 2: Backend Latency Percentiles
  console.log(`\n${C.bold}2. FASTAPI BACKEND LATENCY & PERCENTILE DISTRIBUTION${C.reset}`);
  console.log('─'.repeat(80));
  console.log(`${C.dim}${'ENDPOINT'.padEnd(28)} ${'STATUS'.padEnd(8)} ${'AVG'.padEnd(10)} ${'P50'.padEnd(8)} ${'P95'.padEnd(8)} ${'P99'.padEnd(8)} ${'VERDICT'}${C.reset}`);
  console.log('─'.repeat(80));

  for (const ep of backendAudit) {
    if (!ep.success) {
      console.log(`${ep.name.padEnd(28)} ${C.red}${String(ep.status).padEnd(8)}${C.reset} ${'-'.padEnd(10)} ${'-'.padEnd(8)} ${'-'.padEnd(8)} ${'-'.padEnd(8)} ${C.red}FAILED${C.reset}`);
      continue;
    }
    const verdict = ep.passed ? `${C.green}PASS${C.reset}` : `${C.yellow}WARN${C.reset}`;
    console.log(
      `${ep.name.padEnd(28)} ` +
      `${C.green}${String(ep.status).padEnd(8)}${C.reset} ` +
      `${(ep.avg + 'ms').padEnd(10)} ` +
      `${(ep.p50 + 'ms').padEnd(8)} ` +
      `${(ep.p95 + 'ms').padEnd(8)} ` +
      `${(ep.p99 + 'ms').padEnd(8)} ` +
      verdict
    );
  }
  console.log('─'.repeat(80));

  // Render Table 3: Caching Tier
  console.log(`\n${C.bold}3. MULTI-TIER CACHING & ACCELERATION RATIO${C.reset}`);
  console.log('─'.repeat(80));
  console.log(`  Probed Endpoint:        ${cacheAudit.endpoint}`);
  console.log(`  Cold Latency (Bypass):  ${C.yellow}${cacheAudit.coldLatencyMs} ms${C.reset}`);
  console.log(`  Warm Latency (Cached):  ${C.green}${cacheAudit.warmLatencyMs} ms${C.reset}`);
  console.log(`  Acceleration Speedup:   ${C.bold}${C.cyan}${cacheAudit.speedupMultiplier}x faster${C.reset}`);
  console.log(`  Redis X-Cache Header:   ${cacheAudit.warmXCache.includes('HIT') ? C.green : C.yellow}${cacheAudit.warmXCache}${C.reset}`);
  console.log(`  Cache-Control Policy:   ${C.dim}${cacheAudit.cacheControlDirective}${C.reset}`);
  console.log('─'.repeat(80));

  // Render Table 4: Database Queries
  console.log(`\n${C.bold}4. POSTGRESQL 16 QUERY & FILTERING LATENCY${C.reset}`);
  console.log('─'.repeat(80));
  console.log(`${C.dim}${'QUERY FILTER / SCENARIO'.padEnd(35)} ${'STATUS'.padEnd(8)} ${'LATENCY'.padEnd(12)} ${'TOTAL'.padEnd(8)} ${'VERDICT'}${C.reset}`);
  console.log('─'.repeat(80));
  for (const q of dbAudit) {
    const verdict = q.passed ? `${C.green}PASS${C.reset}` : `${C.red}SLOW${C.reset}`;
    console.log(
      `${q.name.padEnd(35)} ` +
      `${q.status === 200 ? C.green : C.red}${String(q.status).padEnd(8)}${C.reset} ` +
      `${(q.latencyMs + ' ms').padEnd(12)} ` +
      `${String(q.totalCountHeader || '-').padEnd(8)} ` +
      verdict
    );
  }
  console.log('─'.repeat(80));

  // Render Table 5: Real-Time SSE Stream
  console.log(`\n${C.bold}5. REAL-TIME SERVER-SENT EVENTS (SSE) STREAM${C.reset}`);
  console.log('─'.repeat(80));
  console.log(`  Stream Endpoint:        ${sseAudit.endpoint}`);
  console.log(`  Handshake Latency:      ${sseAudit.handshakeLatencyMs} ms`);
  console.log(`  Connection Status:      ${sseAudit.connected ? `${C.green}ACTIVE / CONNECTED${C.reset}` : `${C.red}DISCONNECTED${C.reset}`}`);
  console.log(`  Preamble Received:      ${C.dim}${sseAudit.firstFrame || 'none'}${C.reset}`);
  console.log('─'.repeat(80));

  // Render Table 6: Sandbox Execution
  console.log(`\n${C.bold}6. CODEBOX EXECUTION SANDBOX CLUSTER${C.reset}`);
  console.log('─'.repeat(80));
  console.log(`  Judge Provider:         ${C.bold}${sandboxAudit.provider.toUpperCase()}${C.reset}`);
  console.log(`  Judge Cluster Health:   ${sandboxAudit.judgeHealthy ? `${C.green}OPERATIONAL / READY${C.reset}` : `${C.red}UNHEALTHY${C.reset}`}`);
  console.log(`  Redis Pub/Sub State:    ${sandboxAudit.redisHealthy ? `${C.green}CONNECTED${C.reset}` : `${C.red}OFFLINE${C.reset}`}`);
  console.log('─'.repeat(80));

  // Overall Score Calculation
  const allTests = [
    ...backendAudit.map((b) => b.passed),
    cacheAudit.passed,
    ...dbAudit.map((d) => d.passed),
    sseAudit.passed,
    sandboxAudit.passed,
  ];

  const passCount = allTests.filter(Boolean).length;
  const totalTests = allTests.length;
  const passRate = Math.round((passCount / totalTests) * 100);

  let grade = 'A+';
  let gradeColor = C.bgGreen;
  if (passRate < 70) { grade = 'F'; gradeColor = C.bgRed; }
  else if (passRate < 80) { grade = 'C'; gradeColor = C.bgYellow; }
  else if (passRate < 90) { grade = 'B'; gradeColor = C.bgYellow; }
  else if (passRate < 96) { grade = 'A'; gradeColor = C.bgGreen; }

  console.log(`\n${C.bold}OVERALL PLATFORM PERFORMANCE SCORE:${C.reset} ${gradeColor} ${grade} (${passRate}% PASS RATE) ${C.reset}\n`);

  // Write Structured JSON Report
  const finalReport = {
    timestamp: new Date().toISOString(),
    apiBase: API_BASE,
    grade,
    passRate,
    summary: {
      totalChecks: totalTests,
      passedChecks: passCount,
      failedChecks: totalTests - passCount,
    },
    modules: {
      frontend: frontendAudit,
      backend: backendAudit,
      caching: cacheAudit,
      database: dbAudit,
      realtimeSse: sseAudit,
      sandbox: sandboxAudit,
    },
  };

  try {
    fs.mkdirSync(path.dirname(REPORT_OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_OUTPUT_PATH, JSON.stringify(finalReport, null, 2), 'utf-8');
    console.log(`${C.dim}✓ Complete structured performance report saved to:${C.reset} ${REPORT_OUTPUT_PATH}\n`);
  } catch (err) {
    console.error(`Failed to write JSON report: ${err.message}`);
  }

  process.exit(passRate >= 75 ? 0 : 1);
}

runFullPlatformAudit().catch((err) => {
  console.error(`Fatal audit failure:`, err);
  process.exit(1);
});
