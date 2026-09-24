#!/usr/bin/env node

/**
 * Autonomous API Contract, Schema Fuzzing & RBAC Matrix Engine
 * Chaos Computer Club — Medi-Caps Chapter QA Platform
 */

import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TARGET_API_BASE = process.env.API_BASE_URL || 'https://medicaps.chaoscomputerclub.in/api';

console.log('='.repeat(80));
console.log(' 🛡️  CCC AUTONOMOUS API CONTRACT & RBAC MATRIX AUDITOR');
console.log(` Target Endpoint: ${TARGET_API_BASE}`);
console.log('='.repeat(80));

async function makeRequest(url, options = {}, payload = null, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const startTime = performance.now();
    try {
      const fetchOpts = {
        method: options.method || 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        signal: AbortSignal.timeout(10000),
      };

      if (payload) {
        fetchOpts.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
      }

      const res = await fetch(url, fetchOpts);
      const latency = Math.round((performance.now() - startTime) * 10) / 10;
      let json = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      return {
        status: res.status,
        headers: res.headers,
        data: json,
        latency,
      };
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      const latency = Math.round((performance.now() - startTime) * 10) / 10;
      return {
        status: err.name === 'TimeoutError' ? 408 : 0,
        error: err.message,
        latency,
      };
    }
  }
}

async function runApiContractAudit() {
  const auditResults = [];

  // 1. Core Endpoints Contract Check
  const coreEndpoints = [
    { name: 'System Health', path: '/health', expectedStatus: [200], requiredFields: ['status', 'services'] },
    { name: 'Public Key Handshake', path: '/auth/jwt-public-key', expectedStatus: [200], requiredFields: ['public_key', 'algorithm'] },
    { name: 'Official Contests Stream', path: '/contests', expectedStatus: [200], isArray: true },
    { name: 'University Leaderboard', path: '/leaderboard', expectedStatus: [200] },
    { name: 'Rating Distribution Histogram', path: '/leaderboard/distribution', expectedStatus: [200] },
  ];

  for (const ep of coreEndpoints) {
    const res = await makeRequest(`${TARGET_API_BASE}${ep.path}`);
    let passed = ep.expectedStatus.includes(res.status);
    let violation = null;

    if (!passed) {
      violation = `Expected status ${ep.expectedStatus.join('/')}, got ${res.status}`;
    } else if (res.data) {
      if (ep.requiredFields) {
        for (const field of ep.requiredFields) {
          if (!(field in res.data)) {
            passed = false;
            violation = `Missing required contract field: '${field}'`;
            break;
          }
        }
      }
    }

    auditResults.push({
      testType: 'CANONICAL_CONTRACT',
      name: ep.name,
      endpoint: ep.path,
      method: 'GET',
      status: res.status,
      latency: res.latency,
      passed,
      violation,
    });
  }

  // 2. Authentication & RBAC Boundary Protection
  const protectedEndpoints = [
    { name: 'Contest Registration (Unauthenticated)', path: '/contests/weekly-1/register', method: 'POST', payload: {} },
    { name: 'Cadet Profile Follow (Unauthenticated)', path: '/profile/follow', method: 'POST', payload: { handle: 'proctor' } },
    { name: 'Admin Force Sync (Unauthenticated)', path: '/admin/sync-contests', method: 'POST', payload: {} },
  ];

  for (const ep of protectedEndpoints) {
    const res = await makeRequest(`${TARGET_API_BASE}${ep.path}`, { method: ep.method }, ep.payload);
    // Unauthenticated requests MUST receive 401 or 403 or 404 (if unexposed)
    const passed = [401, 403, 404].includes(res.status);
    const violation = passed ? null : `Security Failure: Unauthenticated mutation returned HTTP ${res.status}`;

    auditResults.push({
      testType: 'RBAC_SECURITY_GATE',
      name: ep.name,
      endpoint: ep.path,
      method: ep.method,
      status: res.status,
      latency: res.latency,
      passed,
      violation,
    });
  }

  // 3. Negative Boundary Fuzzing (Malformed Payloads)
  const fuzzCases = [
    {
      name: 'SQL Injection Probe in Query Param',
      path: '/leaderboard?department=%27%20OR%201=1;%20--',
      method: 'GET',
    },
    {
      name: 'Type Inversion in Auth Handle Probe',
      path: '/auth/check-handle?handle=123456789',
      method: 'GET',
    },
    {
      name: 'Excessive Payload String Buffer Fuzz',
      path: `/auth/check-handle?handle=${'A'.repeat(2000)}`,
      method: 'GET',
    },
  ];

  for (const fc of fuzzCases) {
    const res = await makeRequest(`${TARGET_API_BASE}${fc.path}`, { method: fc.method }, fc.payload);
    // Server must reject gracefully with 4xx or 200 without crashing with 500
    const passed = res.status < 500 && res.status !== 0;
    const violation = passed ? null : `Crash Failure: Malformed payload caused internal server error (HTTP ${res.status})`;

    auditResults.push({
      testType: 'NEGATIVE_FUZZ_BOUNDARY',
      name: fc.name,
      endpoint: fc.path,
      method: fc.method,
      status: res.status,
      latency: res.latency,
      passed,
      violation,
    });
  }

  // Summary
  const total = auditResults.length;
  const passedCount = auditResults.filter((r) => r.passed).length;
  const failedCount = total - passedCount;
  const successRate = Math.round((passedCount / total) * 100);

  console.log(`\nAudit Results: Total: ${total} | Passed: ${passedCount} | Failed: ${failedCount} | Success Rate: ${successRate}%\n`);
  console.log('-'.repeat(80));
  console.log('TYPE                      STATUS  LATENCY    TEST NAME');
  console.log('-'.repeat(80));

  for (const r of auditResults) {
    const mark = r.passed ? '✓' : '✗';
    const typePad = r.testType.padEnd(24);
    const statusPad = String(r.status).padEnd(6);
    const latPad = `${r.latency}ms`.padEnd(10);
    console.log(`${mark} ${typePad} ${statusPad}  ${latPad} ${r.name}`);
    if (r.violation) {
      console.log(`  └─ ⚠️  ${r.violation}`);
    }
  }
  console.log('='.repeat(80));

  // Save artifacts
  const outDir = path.resolve('.planning/qa');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outDir, 'api_contract_report.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), total, passed: passedCount, failed: failedCount, auditResults }, null, 2)
  );

  if (failedCount > 0) {
    process.exit(1);
  }
}

runApiContractAudit().catch((err) => {
  console.error('Fatal API Contract Audit Error:', err);
  process.exit(1);
});
