// k6 Load Test — ECR System Phase 7B
// Run: k6 run --vus 10 --duration 30s k6-load-test.js
// Run: k6 run --vus 25 --duration 60s k6-load-test.js
// Run: k6 run --vus 50 --duration 120s k6-load-test.js
// Run: k6 run --vus 100 --duration 180s k6-load-test.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const errorRate = new Rate('errors');
const authLatency = new Trend('auth_latency');
const reportListLatency = new Trend('report_list_latency');
const healthLatency = new Trend('health_latency');
const loginFailures = new Counter('login_failures');

export const options = {
  thresholds: {
    errors: ['rate<0.05'],
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    auth_latency: ['p(95)<1000'],
    health_latency: ['p(95)<500'],
  },
  stages: [
    { duration: '10s', target: 10 },  // ramp up
    { duration: '30s', target: 10 },  // steady
    { duration: '10s', target: 0 },   // ramp down
  ],
};

export default function () {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/health/live`);
    healthLatency.add(res.timings.duration);
    check(res, {
      'health status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
    sleep(1);
  });

  group('Authentication', () => {
    const payload = JSON.stringify({ username: 'admin', password: 'password' });
    const params = { headers: { 'Content-Type': 'application/json' } };
    const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);
    authLatency.add(res.timings.duration);
    if (res.status === 401) loginFailures.add(1);
    check(res, {
      'login returns 201 or 401': (r) => r.status === 201 || r.status === 401,
    }) || errorRate.add(1);
    sleep(2);
  });

  group('Report Listing', () => {
    const res = http.get(`${BASE_URL}/api/defect-reports`, {
      headers: { 'Content-Type': 'application/json' },
    });
    reportListLatency.add(res.timings.duration);
    check(res, {
      'report list returns 200': (r) => r.status === 200,
    }) || errorRate.add(1);
    sleep(1);
  });

  group('Metrics Dashboard', () => {
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, {
      'metrics status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
    sleep(1);
  });
}
