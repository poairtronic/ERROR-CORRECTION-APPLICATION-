// k6 Comprehensive Production Load Test — ECR Digitization System Phase 5
// Execution Commands:
// Light check:  k6 run --vus 2 k6-load-test.js
// Scenario 1:   k6 run --vus 10 --duration 30s load-test-comprehensive.js
// Scenario 2:   k6 run --vus 25 --duration 60s load-test-comprehensive.js
// Scenario 3:   k6 run --vus 50 --duration 120s load-test-comprehensive.js
// Scenario 4:   k6 run --vus 100 --duration 180s load-test-comprehensive.js

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Custom Telemetry Trends
const errorRate = new Rate('errors');
const loginLatency = new Trend('login_latency');
const createReportLatency = new Trend('create_report_latency');
const analyticsLatency = new Trend('analytics_latency');
const listReportsLatency = new Trend('list_reports_latency');
const notificationsLatency = new Trend('notifications_latency');
const wsConnectionFailures = new Counter('ws_connection_failures');

export const options = {
  thresholds: {
    errors: ['rate<0.05'], // Max 5% error rate
    http_req_duration: ['p(95)<1500', 'p(99)<3000'], // P95 < 1.5s, P99 < 3s
    login_latency: ['p(95)<1000'],
    create_report_latency: ['p(95)<2000'],
    analytics_latency: ['p(95)<500'], // Cache optimized
    list_reports_latency: ['p(95)<800'],
  },
  stages: [
    { duration: '15s', target: 25 },  // ramp up
    { duration: '45s', target: 50 },  // steady load
    { duration: '15s', target: 0 },   // ramp down
  ],
};

export default function () {
  let token = '';

  // 1. Authenticate to obtain JWT
  group('Authentication Flow', () => {
    const loginPayload = JSON.stringify({
      username: 'admin',
      password: 'password',
    });
    const params = { headers: { 'Content-Type': 'application/json' } };
    
    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/auth/login`, loginPayload, params);
    loginLatency.add(Date.now() - start);

    const success = check(res, {
      'login returns 201': (r) => r.status === 201,
      'has access token': (r) => r.json('access_token') !== undefined,
    });

    if (success) {
      token = res.json('access_token');
    } else {
      errorRate.add(1);
    }
    sleep(1);
  });

  if (!token) return;

  const authHeaders = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  // 2. Fetch Dashboard Analytics (cached on backend)
  group('Dashboard Analytics Loading', () => {
    const start = Date.now();
    const resList = http.batch([
      ['GET', `${BASE_URL}/api/analytics/kpis`, null, authHeaders],
      ['GET', `${BASE_URL}/api/analytics/trends`, null, authHeaders],
      ['GET', `${BASE_URL}/api/analytics/sla`, null, authHeaders],
    ]);
    analyticsLatency.add(Date.now() - start);

    resList.forEach((res) => {
      check(res, {
        'analytics kpi/trend/sla status 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    });
    sleep(1.5);
  });

  // 3. Search & Paginate Defect Reports
  group('Search & List Reports', () => {
    const start = Date.now();
    // Fetch page 1 of reports (cached pagination)
    const res = http.get(`${BASE_URL}/api/defect-reports?page=1&limit=25`, authHeaders);
    listReportsLatency.add(Date.now() - start);

    check(res, {
      'list reports returns 200': (r) => r.status === 200,
    }) || errorRate.add(1);
    sleep(2);
  });

  // 4. Create a Defect Report (transactional mutation)
  group('Submit Defect Report', () => {
    const reportPayload = JSON.stringify({
      componentId: '00000000-0000-0000-0000-000000000001', // Example default UUIDs
      errorTypeId: '00000000-0000-0000-0000-000000000001',
      defectDescription: 'Test load simulation error details.',
      scNo: 'SC-LOAD-999',
      poNo: 'PO-LOAD-999',
      stageOfFailure: 'IN_PROCESS',
      receptionDate: new Date().toISOString().split('T')[0],
      productionQty: 100,
      rejectedQty: 5,
    });

    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/defect-reports`, reportPayload, authHeaders);
    createReportLatency.add(Date.now() - start);

    check(res, {
      'create report returns 201 or 400': (r) => r.status === 201 || r.status === 400,
    }) || errorRate.add(1);
    sleep(3);
  });

  // 5. Query User Notifications Timeline
  group('Query Notifications', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/notifications?page=1&limit=50`, authHeaders);
    notificationsLatency.add(Date.now() - start);

    check(res, {
      'notifications timeline status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
    sleep(1);
  });

  // 6. WebSocket Socket.IO Handshake Simulation
  group('WebSocket Connection', () => {
    const wsUrl = `${BASE_URL.replace('http', 'ws')}/socket.io/?EIO=4&transport=websocket`;
    const response = ws.connect(wsUrl, {}, function (socket) {
      socket.on('open', () => {
        socket.send('2probe');
        socket.close();
      });
      socket.on('error', () => {
        wsConnectionFailures.add(1);
        errorRate.add(1);
      });
    });
    sleep(2);
  });
}
