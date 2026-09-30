import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const leaderboardLatency = new Trend('leaderboard_duration_ms');
const errorRate = new Rate('leaderboard_error_rate');

export const options = {
  stages: [
    { duration: '15s', target: 100 },  // Quick ramp
    { duration: '45s', target: 500 },  // 500 simultaneous stampede requests
    { duration: '15s', target: 0 },    // Cool-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<200', 'p(99)<350'], // SingleFlight coalescing keeps latency low
    'leaderboard_error_rate': ['rate<0.001'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'https://medicaps.chaoscomputerclub.in';
const CONTEST_SLUG = __ENV.CONTEST_SLUG || 'ccc-test-1';

export default function () {
  const t0 = Date.now();
  const res = http.get(`${BASE_URL}/api/contests/${CONTEST_SLUG}/leaderboard`, {
    tags: { name: 'leaderboard_stampede' },
  });
  leaderboardLatency.add(Date.now() - t0);

  const ok = check(res, {
    'leaderboard returns 200': (r) => r.status === 200,
  });

  errorRate.add(!ok);
  sleep(0.5); // Tight aggressive polling simulating live scoreboard crowd
}
