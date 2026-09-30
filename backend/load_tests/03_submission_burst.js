import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const submissionSuccessRate = new Rate('submission_accepted_rate');
const rateLimitHits = new Counter('rate_limit_429_hits');
const concurrencyLimitHits = new Counter('user_concurrency_429_hits');

export const options = {
  stages: [
    { duration: '20s', target: 50 },  // 50 concurrent cadets
    { duration: '1m', target: 200 },  // 200 concurrent cadets burst
    { duration: '30s', target: 0 },   // Drain
  ],
  thresholds: {
    'http_req_duration': ['p(95)<300'], // Enqueue latency < 300ms
  },
};

const BASE_URL = __ENV.TARGET_URL || 'https://medicaps.chaoscomputerclub.in';
const CONTEST_SLUG = __ENV.CONTEST_SLUG || 'ccc-test-1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'load_test_bearer_token';

export default function () {
  const payload = JSON.stringify({
    problem_id: 'prob-1',
    code: 'class Solution:\n    def solve(self, a, b):\n        return a + b\n',
    language: 'python',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}-${__VU}`,
      'X-Request-ID': `k6-burst-vu${__VU}-${Date.now()}`,
    },
  };

  const res = http.post(`${BASE_URL}/api/contests/${CONTEST_SLUG}/arena/submit`, payload, params);

  const accepted = check(res, {
    'accepted or rate-limited': (r) => r.status === 200 || r.status === 202 || r.status === 429,
  });

  if (res.status === 200 || res.status === 202) {
    submissionSuccessRate.add(true);
  } else if (res.status === 429) {
    if (res.body && res.body.includes('concurrency')) {
      concurrencyLimitHits.add(1);
    } else {
      rateLimitHits.add(1);
    }
  }

  sleep(Math.random() * 5 + 5); // Submit every 5-10s
}
