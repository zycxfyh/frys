import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Test configuration
export const options = {
  stages: [
    // Ramp up to 100 users over 2 minutes
    { duration: '2m', target: 100 },
    // Stay at 100 users for 5 minutes
    { duration: '5m', target: 100 },
    // Ramp up to 500 users over 3 minutes
    { duration: '3m', target: 500 },
    // Stay at 500 users for 10 minutes
    { duration: '10m', target: 500 },
    // Ramp down to 0 users over 2 minutes
    { duration: '2m', target: 0 },
  ],

  thresholds: {
    // 95% of requests should be below 500ms
    http_req_duration: ['p(95)<500'],
    // Error rate should be below 1%
    http_req_failed: ['rate<0.01'],
    // Custom metrics
    errors: ['rate<0.05'],
    response_time: ['p(95)<300'],
  },

  // Load test settings
  noConnectionReuse: false,
  userAgent: 'Frys-Load-Test/1.0',
};

// Base URL for the application
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Test scenarios
export default function () {
  // Scenario 1: API Health Check
  const healthResponse = http.get(`${BASE_URL}/health`);
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);

  // Scenario 2: Workflow API
  const workflowsResponse = http.get(`${BASE_URL}/api/v1/workflows`);
  check(workflowsResponse, {
    'workflows API status is 200': (r) => r.status === 200,
    'workflows API response time < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);

  // Scenario 3: Create Workflow Instance
  const createWorkflowPayload = JSON.stringify({
    definitionId: 'test-workflow',
    context: {
      userId: `user_${__VU}`,
      timestamp: new Date().toISOString(),
    },
  });

  const createResponse = http.post(
    `${BASE_URL}/api/v1/workflows/instances`,
    createWorkflowPayload,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  check(createResponse, {
    'create workflow status is 201': (r) => r.status === 201,
    'create workflow response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  // Record custom metrics
  responseTime.add(createResponse.timings.duration);

  // Scenario 4: AI Inference (if available)
  if (__ENV.TEST_AI === 'true') {
    const aiPayload = JSON.stringify({
      model: 'test-model',
      prompt: 'Hello, world!',
      max_tokens: 100,
    });

    const aiResponse = http.post(
      `${BASE_URL}/api/v1/ai/inference`,
      aiPayload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    check(aiResponse, {
      'AI inference status is 200': (r) => r.status === 200,
      'AI inference response time < 2000ms': (r) => r.timings.duration < 2000,
    }) || errorRate.add(1);
  }

  // Scenario 5: Metrics Endpoint
  const metricsResponse = http.get(`${BASE_URL}/metrics`);
  check(metricsResponse, {
    'metrics endpoint status is 200': (r) => r.status === 200,
    'metrics response time < 50ms': (r) => r.timings.duration < 50,
  }) || errorRate.add(1);

  // Random sleep between 1-5 seconds to simulate real user behavior
  sleep(Math.random() * 4 + 1);
}

// Setup function - runs before the test starts
export function setup() {
  console.log('Starting Frys load test...');

  // Warm up the application
  const warmupResponse = http.get(`${BASE_URL}/health`);
  if (warmupResponse.status !== 200) {
    console.error('Application warmup failed!');
    return;
  }

  console.log('Application warmed up successfully');
  return {};
}

// Teardown function - runs after the test completes
export function teardown(data) {
  console.log('Load test completed');
  console.log('Test data:', data);
}

// Handle summary - custom summary output
export function handleSummary(data) {
  const summary = {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2),
    'metrics.json': JSON.stringify(data.metrics, null, 2),
  };

  // Save detailed report
  if (__ENV.REPORT_PATH) {
    summary[`${__ENV.REPORT_PATH}/detailed-report.json`] = JSON.stringify(data, null, 2);
  }

  return summary;
}

function textSummary(data, options) {
  return `
📊 Frys Load Test Summary
==========================

Test Duration: ${data.metrics.iteration_duration.values.avg}ms avg iteration
Total Requests: ${data.metrics.http_reqs.values.count}
Failed Requests: ${data.metrics.http_req_failed.values.rate * 100}%

🚀 Performance Metrics:
- Response Time (avg): ${Math.round(data.metrics.http_req_duration.values.avg)}ms
- Response Time (95th): ${Math.round(data.metrics.http_req_duration.values['p(95)']}ms
- Response Time (99th): ${Math.round(data.metrics.http_req_duration.values['p(99)']}ms

📈 Throughput:
- Requests per Second: ${Math.round(data.metrics.http_reqs.values.rate)}

⚠️  Error Rates:
- HTTP Errors: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
- Custom Errors: ${(data.metrics.errors?.values.rate * 100 || 0).toFixed(2)}%

🔍 Threshold Results:
${Object.entries(data.metrics)
  .filter(([key]) => key.includes('threshold'))
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

Test completed at: ${new Date().toISOString()}
`;
}
