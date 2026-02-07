# 🧪 Testing Strategy Improvements

## Overview
Enhanced testing patterns for Production-Ready Healthcare Platform with focus on contract testing, resilience testing, and chaos engineering.

---

## 1. Contract Testing (API Stability)

### Why Contract Testing?
- **Consumer-Driven**: Frontend defines API expectations
- **Early Detection**: Breaking changes caught before deployment
- **Documentation**: Living API documentation
- **Parallel Development**: Frontend/Backend teams work independently

### Implementation with Pact

#### Installation
```bash
npm install --save-dev @pact-foundation/pact --workspace=frontend
npm install --save-dev @pact-foundation/pact --workspace=backend
```

#### Frontend Contract Definition
```typescript
// apps/frontend/tests/contracts/appointment-contract.spec.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';

const provider = new PactV3({
  consumer: 'frontend',
  provider: 'backend',
  dir: './pacts'
});

describe('Appointments API Contract', () => {
  test('get appointments for patient', async () => {
    await provider
      .given('patient has 3 appointments')
      .uponReceiving('a request for patient appointments')
      .withRequest({
        method: 'GET',
        path: '/api/appointments',
        headers: { Authorization: 'Bearer valid-token' },
        query: { patientId: 'patient-123' }
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: MatchersV3.eachLike({
          id: MatchersV3.uuid(),
          date: MatchersV3.iso8601DateTime(),
          status: MatchersV3.string('confirmed'),
          therapistId: MatchersV3.uuid(),
          patientId: 'patient-123'
        }, { min: 3 })
      });

    // Execute actual API call
    const response = await axios.get('/api/appointments?patientId=patient-123', {
      headers: { Authorization: 'Bearer valid-token' }
    });

    expect(response.status).toBe(200);
    expect(response.data.length).toBeGreaterThanOrEqual(3);
  });

  test('create appointment', async () => {
    await provider
      .given('therapist has available slots')
      .uponReceiving('a request to create appointment')
      .withRequest({
        method: 'POST',
        path: '/api/appointments',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token'
        },
        body: {
          therapistId: MatchersV3.uuid(),
          date: MatchersV3.iso8601DateTime(),
          duration: 60,
          type: 'initial_consultation'
        }
      })
      .willRespondWith({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: MatchersV3.uuid(),
          therapistId: MatchersV3.uuid(),
          date: MatchersV3.iso8601DateTime(),
          status: 'pending'
        }
      });

    const response = await axios.post('/api/appointments', {
      therapistId: 'therapist-456',
      date: '2024-03-15T10:00:00Z',
      duration: 60,
      type: 'initial_consultation'
    });

    expect(response.status).toBe(201);
  });
});
```

#### Backend Contract Verification
```typescript
// apps/backend/tests/contracts/verify-contracts.spec.ts
import { Verifier } from '@pact-foundation/pact';
import path from 'path';

describe('Pact Verification', () => {
  test('validates frontend contracts', async () => {
    const opts = {
      provider: 'backend',
      providerBaseUrl: 'http://localhost:4000',
      
      // Pact files from frontend
      pactUrls: [
        path.resolve(__dirname, '../../../frontend/pacts/frontend-backend.json')
      ],
      
      // Provider states setup
      stateHandlers: {
        'patient has 3 appointments': async () => {
          // Setup test data
          await createTestPatientWithAppointments('patient-123', 3);
        },
        'therapist has available slots': async () => {
          await createTestTherapist('therapist-456');
        }
      },
      
      // Request filters (add auth tokens)
      requestFilter: (req, res, next) => {
        req.headers['Authorization'] = 'Bearer test-token';
        next();
      }
    };

    const verifier = new Verifier(opts);
    await verifier.verifyProvider();
  });
});
```

#### CI/CD Integration
```yaml
# .github/workflows/contract-tests.yml
name: Contract Tests

on: [push, pull_request]

jobs:
  frontend-pacts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      
      - name: Generate Pact files
        run: |
          npm ci --workspace=frontend
          npm run test:contracts --workspace=frontend
      
      - name: Publish Pacts to Broker
        run: |
          npx pact-broker publish \
            ./apps/frontend/pacts \
            --consumer-app-version=${{ github.sha }} \
            --broker-base-url=${{ secrets.PACT_BROKER_URL }} \
            --broker-token=${{ secrets.PACT_BROKER_TOKEN }}

  backend-verification:
    runs-on: ubuntu-latest
    needs: frontend-pacts
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      
      - name: Start backend
        run: npm run dev:backend &
        
      - name: Verify Pacts
        run: npm run test:pacts --workspace=backend
```

---

## 2. WebRTC Resilience Testing

### Network Condition Simulation

```typescript
// tests/webrtc/resilience.spec.ts
import { test, expect, chromium } from '@playwright/test';

test.describe('WebRTC Resilience', () => {
  test('handles 50% packet loss', async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    
    // Simulate network conditions
    await context.route('**/*', route => {
      if (Math.random() < 0.5) {
        // Drop 50% of packets
        route.abort();
      } else {
        route.continue();
      }
    });

    const page = await context.newPage();
    await page.goto('/video-call/123');
    
    // Should show reconnection UI
    await expect(page.getByText('Verbindung wird wiederhergestellt')).toBeVisible();
    
    // Should eventually reconnect
    await expect(page.getByText('Verbunden')).toBeVisible({ timeout: 30000 });
  });

  test('handles network partition (complete disconnect)', async ({ page }) => {
    await page.goto('/video-call/123');
    
    // Wait for connection
    await expect(page.getByText('Verbunden')).toBeVisible();
    
    // Simulate network partition
    await page.context().setOffline(true);
    
    // Should detect disconnection
    await expect(page.getByText('Verbindung verloren')).toBeVisible();
    
    // Restore network
    await page.context().setOffline(false);
    
    // Should auto-reconnect
    await expect(page.getByText('Verbunden')).toBeVisible({ timeout: 30000 });
  });

  test('handles ICE connection failure', async ({ page }) => {
    await page.goto('/video-call/123');
    
    // Inject failure
    await page.evaluate(() => {
      const peer = (window as any).peer;
      peer._pc?.close(); // Force connection close
    });
    
    // Should attempt reconnection
    await expect(page.getByText('Wiederverbinden...')).toBeVisible();
  });

  test('quality degrades gracefully under bandwidth constraints', async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    
    // Simulate 3G network (750kbps, 100ms latency)
    await context.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Latency
      route.continue();
    });

    const page = await context.newPage();
    await page.goto('/video-call/123');
    
    // Check video quality indicator
    const quality = await page.locator('[data-testid="video-quality"]').textContent();
    expect(['low', 'medium']).toContain(quality);
  });

  test('handles TURN server failover', async ({ page }) => {
    // Mock TURN server failure
    await page.route('**/turn-server-1/**', route => route.abort());
    
    await page.goto('/video-call/123');
    
    // Should fallback to TURN server 2
    await expect(page.getByText('Verbunden')).toBeVisible();
    
    const turnServer = await page.evaluate(() => {
      return (window as any).peer?._pc?.iceServers?.[0]?.urls;
    });
    expect(turnServer).toContain('turn-server-2');
  });
});
```

### Chaos Monkey Testing

```typescript
// tests/chaos/chaos-monkey.spec.ts
import { test } from '@playwright/test';

class ChaosMonkey {
  private interventions = [
    this.networkLatency,
    this.cpuThrottle,
    this.memoryPressure,
    this.serviceRestart
  ];

  async run(page: Page, durationMs: number) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < durationMs) {
      // Random intervention every 5-15 seconds
      const waitTime = Math.random() * 10000 + 5000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      const intervention = this.interventions[
        Math.floor(Math.random() * this.interventions.length)
      ];
      await intervention.call(this, page);
    }
  }

  private async networkLatency(page: Page) {
    console.log('Chaos: Adding 2s network latency');
    await page.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.continue();
    });
  }

  private async cpuThrottle(page: Page) {
    console.log('Chaos: CPU throttling to 4x slower');
    await (page as any)._client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }

  private async memoryPressure(page: Page) {
    console.log('Chaos: Creating memory pressure');
    await page.evaluate(() => {
      const bigArray = new Array(10000000).fill('memory-pressure');
      (window as any).leakyMemory = bigArray;
    });
  }

  private async serviceRestart(page: Page) {
    console.log('Chaos: Simulating service restart');
    await page.evaluate(() => {
      // Close WebSocket connections
      (window as any).peer?.destroy();
    });
  }
}

test('application survives chaos monkey', async ({ page }) => {
  await page.goto('/dashboard');
  
  const monkey = new ChaosMonkey();
  
  // Run chaos for 2 minutes
  await monkey.run(page, 120000);
  
  // App should still be functional
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
```

---

## 3. Performance Testing

### Load Testing with k6

```typescript
// tests/load/appointments-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% failure rate
  },
};

export default function () {
  // Login
  const loginRes = http.post('http://localhost:4000/api/auth/login', {
    email: 'test@example.com',
    password: 'password123'
  });
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });
  
  const token = loginRes.json('token');
  
  // Get appointments
  const appointmentsRes = http.get('http://localhost:4000/api/appointments', {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  check(appointmentsRes, {
    'appointments loaded': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}
```

Run with:
```bash
k6 run tests/load/appointments-load.js
```

---

## 4. Security Testing

### SQL Injection Testing

```typescript
// tests/security/sql-injection.spec.ts
import { test, expect } from '@playwright/test';

test.describe('SQL Injection Protection', () => {
  const injectionPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE patients--",
    "1' UNION SELECT password FROM users--",
    "admin'--",
    "' OR 1=1--"
  ];

  for (const payload of injectionPayloads) {
    test(`blocks SQL injection: ${payload}`, async ({ request }) => {
      const response = await request.get('/api/patients', {
        params: { search: payload }
      });
      
      // Should not return 500 error (means query executed)
      expect(response.status()).not.toBe(500);
      
      // Should return 400 (validation error) or empty results
      expect([200, 400]).toContain(response.status());
    });
  }
});
```

### XSS Testing

```typescript
// tests/security/xss.spec.ts
test('prevents XSS in patient notes', async ({ page }) => {
  await page.goto('/patients/123');
  
  const xssPayload = '<script>alert("XSS")</script>';
  
  await page.fill('[data-testid="notes"]', xssPayload);
  await page.click('[data-testid="save"]');
  
  // Reload page
  await page.reload();
  
  // Should be escaped, not executed
  const notes = await page.textContent('[data-testid="notes-display"]');
  expect(notes).toContain('&lt;script&gt;');
  
  // Dialog should not appear
  page.on('dialog', () => {
    throw new Error('XSS alert triggered!');
  });
});
```

---

## 5. Test Organization

### Recommended Structure

```
tests/
├── e2e/                    # Existing E2E tests
│   ├── auth.spec.ts
│   ├── appointments.spec.ts
│   └── payments.spec.ts
├── contracts/              # New: Contract tests
│   ├── appointments-contract.spec.ts
│   ├── messages-contract.spec.ts
│   └── verify-contracts.spec.ts
├── webrtc/                 # New: WebRTC resilience
│   ├── resilience.spec.ts
│   └── quality.spec.ts
├── chaos/                  # New: Chaos engineering
│   └── chaos-monkey.spec.ts
├── load/                   # New: Performance tests
│   ├── appointments-load.js
│   └── video-call-load.js
├── security/               # Existing security tests
│   ├── injection-and-validation.spec.ts
│   ├── sql-injection.spec.ts
│   └── xss.spec.ts
└── unit/                   # Unit tests
    ├── encryption.test.ts
    ├── audit.test.ts
    └── database.test.ts
```

### Test Commands

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:e2e",
    "test:unit": "vitest",
    "test:e2e": "playwright test tests/e2e",
    "test:contracts": "playwright test tests/contracts",
    "test:webrtc": "playwright test tests/webrtc",
    "test:chaos": "playwright test tests/chaos",
    "test:security": "playwright test tests/security",
    "test:load": "k6 run tests/load/*.js",
    "test:all": "npm run test:unit && npm run test:e2e && npm run test:contracts && npm run test:security"
  }
}
```

---

## 6. CI/CD Integration

```yaml
# .github/workflows/comprehensive-tests.yml
name: Comprehensive Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:unit

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e

  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:contracts
      
  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:security
      
  load-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/setup-k6-action@v1
      - run: npm run test:load
```

---

## Summary

### Test Coverage Goals

| Type | Current | Target | Priority |
|------|---------|--------|----------|
| Unit Tests | 85% | 90% | High |
| E2E Tests | 106 tests | 150 tests | Medium |
| Contract Tests | 0 | 20+ | High |
| Security Tests | 12 tests | 30+ | Critical |
| Load Tests | 0 | 5 scenarios | Medium |
| Chaos Tests | 0 | 10+ | Low |

### Benefits

✅ **Earlier Bug Detection**: Contract tests catch breaking changes before deployment  
✅ **Confidence in Resilience**: Chaos testing proves system handles failures  
✅ **Performance Baseline**: Load tests ensure scalability  
✅ **Security Assurance**: Automated security tests prevent vulnerabilities  
✅ **Documentation**: Tests serve as living API documentation
