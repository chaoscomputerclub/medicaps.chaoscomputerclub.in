import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const sseErrorRate = new Rate('sse_error_rate');

export const options = {
  stages: [
    { duration: '30s', target: 100 },  // Ramp to 100 subscribers
    { duration: '1m', target: 500 },   // Ramp to 500 subscribers
    { duration: '2m', target: 1000 },  // Sustained 1000 concurrent SSE connections
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    'sse_error_rate': ['rate<0.01'], // < 1% connection drop/failure
  },
};

const BASE_URL = __ENV.TARGET_URL || 'https://medicaps.chaoscomputerclub.in';

export default function () {
  const params = {
    headers: {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
    timeout: '60s',
  };

  // Connect to SSE stream
  const res = http.get(`${BASE_URL}/api/events/stream`, params);

  const isOk = check(res, {
    'sse status is 200': (r) => r.status === 200,
    'content-type is event-stream': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('text/event-stream'),
  });

  sseErrorRate.add(!isOk);
  sleep(10); // Hold connection simulation
}
