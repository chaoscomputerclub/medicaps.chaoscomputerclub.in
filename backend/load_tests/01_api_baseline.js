import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom Metrics
const errorRate = new Rate('api_error_rate');
const contestLatency = new Trend('api_contest_latency_ms');
const metricsLatency = new Trend('api_metrics_latency_ms');

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Warm-up
    { duration: '1m', target: 200 },   // Normal load
    { duration: '1m', target: 500 },   // Peak load
    { duration: '30s', target: 1000 }, // Stress peak
    { duration: '30s', target: 0 },    // Cool-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<150', 'p(99)<300'],
    'api_error_rate': ['rate<0.001'], // < 0.1% error rate
  },
};

const BASE_URL = __ENV.TARGET_URL || 'https://medicaps.chaoscomputerclub.in';

export default function () {
  // 1. Healthcheck probe
  const healthRes = http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' } });
  const healthOk = check(healthRes, {
    'health returns 200': (r) => r.status === 200,
    'health body operational': (r) => r.body && r.body.includes('operational'),
  });
  errorRate.add(!healthOk);

  // 2. Contests list (Cached via SingleFlight & SWR)
  const t0 = Date.now();
  const contestRes = http.get(`${BASE_URL}/api/contests`, { tags: { name: 'contests_list' } });
  contestLatency.add(Date.now() - t0);
  const contestOk = check(contestRes, {
    'contests returns 200': (r) => r.status === 200,
  });
  errorRate.add(!contestOk);

  // 3. Prometheus metrics scraping endpoint
  const t1 = Date.now();
  const metricsRes = http.get(`${BASE_URL}/api/v1/metrics`, { tags: { name: 'metrics' } });
  metricsLatency.add(Date.now() - t1);
  const metricsOk = check(metricsRes, {
    'metrics returns 200': (r) => r.status === 200,
    'metrics has ccc_queue_pending': (r) => r.body && r.body.includes('ccc_queue_pending'),
  });
  errorRate.add(!metricsOk);

  sleep(Math.random() * 2 + 1); // Random sleep 1-3s between iterations
}
