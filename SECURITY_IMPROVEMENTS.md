# 🔒 Security Improvements Guide

## Critical Priority Actions for Production

This guide outlines security enhancements implemented and **critical actions required** before production deployment.

---

## ⚠️ Priority 1: CRITICAL (Must Fix Before Production)

### 1.1 Migrate to External Key Management System

**Current State:** ❌ Encryption keys in environment variables  
**Required State:** ✅ Keys managed by AWS KMS, Azure Key Vault, or HashiCorp Vault

#### Why Critical?
- **GDPR Art. 32**: State-of-the-art security requires professional key management
- **CRA (Cyber Resilience Act)**: No hardcoded or static keys in production
- **Key Rotation**: Current setup makes key rotation extremely difficult
- **Audit Trail**: No visibility into who accessed encryption keys

#### Implementation Steps

**Option A: AWS KMS (Recommended for AWS deployments)**

```bash
# 1. Install AWS SDK
npm install @aws-sdk/client-kms --workspace=backend

# 2. Create KMS key in AWS Console
aws kms create-key --description "Therapist Platform Patient Data Encryption"

# 3. Configure environment
cat >> .env << EOF
KMS_TYPE=aws
AWS_KMS_KEY_ID=arn:aws:kms:eu-central-1:123456789:key/abc-def-123
AWS_REGION=eu-central-1
EOF

# 4. Uncomment AWSKMS implementation in kms.service.ts
```

**Option B: HashiCorp Vault (Self-hosted or Vault Cloud)**

```bash
# 1. Setup Vault
vault secrets enable -path=secret kv-v2

# 2. Store master key
vault kv put secret/encryption-keys \
  master_key=$(openssl rand -base64 32) \
  version=v1

# 3. Configure environment
cat >> .env << EOF
KMS_TYPE=vault
VAULT_ADDR=https://vault.example.com
VAULT_TOKEN=s.xxxxxxxxxxxxxx
VAULT_KEY_PATH=secret/data/encryption-keys
EOF
```

**Option C: Azure Key Vault**

```bash
# 1. Create Key Vault
az keyvault create --name therapist-platform-kv \
  --resource-group production-rg \
  --location westeurope

# 2. Create encryption key
az keyvault key create --vault-name therapist-platform-kv \
  --name patient-data-encryption \
  --protection software

# 3. Configure environment
cat >> .env << EOF
KMS_TYPE=azure
AZURE_KEY_VAULT_URL=https://therapist-platform-kv.vault.azure.net/
AZURE_KEY_NAME=patient-data-encryption
EOF
```

#### Migration Plan for Existing Data

```typescript
// Re-encrypt existing data with new KMS
import { getEncryptionService } from './services/encryption.service.js';
import { getDatabaseService } from './services/database.service.js';

async function migrateEncryption() {
  const db = getDatabaseService();
  const encService = getEncryptionService();
  
  // Get all encrypted records
  const records = await db.query(
    'SELECT id, encrypted_field FROM patients'
  );
  
  for (const record of records) {
    // Re-encrypt with KMS
    const rotated = await encService.rotateKey(record.encrypted_field, {
      userId: record.id,
      dataType: 'medical_notes'
    });
    
    await db.query(
      'UPDATE patients SET encrypted_field = $1 WHERE id = $2',
      [rotated, record.id]
    );
  }
}
```

---

### 1.2 Implement Database Row-Level Security (RLS)

**Current State:** ❌ Application-level access control only  
**Required State:** ✅ Database-enforced data isolation

#### Why Critical?
- **Defense in Depth**: SQL injection bypasses application logic
- **GDPR Art. 32**: Technical measures to ensure data protection
- **Multi-Tenancy**: Prevents accidental data leakage between patients

#### Implementation

```sql
-- Enable RLS on all sensitive tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own data
CREATE POLICY user_isolation_policy ON patients
  FOR ALL
  USING (
    id = current_setting('app.current_user_id')::UUID 
    OR therapist_id = current_setting('app.current_user_id')::UUID
  );

CREATE POLICY appointment_access ON appointments
  FOR ALL
  USING (
    therapist_id = current_setting('app.current_user_id')::UUID 
    OR patient_id = current_setting('app.current_user_id')::UUID
  );

CREATE POLICY message_access ON messages
  FOR ALL
  USING (
    sender_id = current_setting('app.current_user_id')::UUID 
    OR recipient_id = current_setting('app.current_user_id')::UUID
  );

-- Admin bypass policy (for system operations)
CREATE POLICY admin_full_access ON patients
  FOR ALL
  TO admin_role
  USING (true);
```

#### Application Integration

```typescript
// Middleware to set user context
import { Request, Response, NextFunction } from 'express';

export async function setDatabaseContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.user) {
    // Set user context for RLS
    await req.pool.query(
      'SELECT set_config($1, $2, true)',
      ['app.current_user_id', req.user.id]
    );
    
    // Set role context
    await req.pool.query(
      'SELECT set_config($1, $2, true)',
      ['app.current_user_role', req.user.role]
    );
  }
  next();
}

// Apply to all routes
app.use('/api', authenticate, setDatabaseContext, routes);
```

---

### 1.3 Implement Stripe Webhook Signature Verification

**Current State:** ⚠️ Webhooks may not verify signatures  
**Required State:** ✅ All webhooks cryptographically verified

#### Why Critical?
- **Payment Fraud**: Unverified webhooks can be spoofed
- **PCI-DSS**: Webhook verification is required
- **Idempotency**: Prevent duplicate payment processing

#### Implementation

```typescript
// apps/backend/src/routes/payment.routes.ts
import Stripe from 'stripe';
import express from 'express';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// IMPORTANT: Use raw body for signature verification
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'] as string;
    
    try {
      // 1. Verify webhook signature
      const event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
      
      // 2. Idempotency check (prevent duplicate processing)
      const processed = await redis.get(`stripe:event:${event.id}`);
      if (processed) {
        return res.json({ received: true, idempotent: true });
      }
      
      // 3. Process event
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutComplete(event.data.object);
          break;
        case 'payment_intent.succeeded':
          await handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await handlePaymentFailure(event.data.object);
          break;
      }
      
      // 4. Mark as processed (24h TTL)
      await redis.setex(`stripe:event:${event.id}`, 86400, 'processed');
      
      res.json({ received: true });
      
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);
```

---

## 🟡 Priority 2: HIGH (Fix Within 1 Month)

### 2.1 Add Rate Limiting per User/IP

**Current Enhancement:** Add granular rate limiting

```typescript
// apps/backend/src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis.js';

// Global rate limit (per IP)
export const globalLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:global:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP'
});

// Auth endpoints (stricter)
export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:auth:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 5, // Only 5 login attempts per 15min
  skipSuccessfulRequests: true,
  message: 'Too many login attempts. Please try again later.'
});

// Per-user rate limit (after authentication)
export const userLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:user:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per user
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Rate limit exceeded'
});

// Apply to routes
app.use('/api/auth', authLimiter);
app.use('/api', authenticate, userLimiter);
```

---

### 2.2 Add Security Headers Enhancement

```typescript
// apps/backend/src/middleware/security.ts
import helmet from 'helmet';

export const securityHeaders = helmet({
  // Content Security Policy (für API: minimal)
  contentSecurityPolicy: false,
  
  // Strict Transport Security (HTTPS only)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // Prevent MIME type sniffing
  noSniff: true,
  
  // Disable X-Powered-By header
  hidePoweredBy: true,
  
  // Frame options (prevent clickjacking)
  frameguard: { action: 'deny' },
  
  // XSS Protection
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});
```

---

### 2.3 Implement CSRF Protection for State-Changing Operations

```typescript
// apps/backend/src/middleware/csrf.ts
import csrf from 'csurf';
import cookieParser from 'cookie-parser';

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Apply to state-changing routes
app.post('/api/appointments', csrfProtection, createAppointment);
app.put('/api/patients/:id', csrfProtection, updatePatient);
app.delete('/api/appointments/:id', csrfProtection, cancelAppointment);

// Frontend: Include CSRF token in requests
// GET /api/csrf-token -> returns { csrfToken: 'xxx' }
// POST /api/appointments -> headers: { 'X-CSRF-Token': token }
```

---

## 🟢 Priority 3: MEDIUM (Best Practices)

### 3.1 Add Input Sanitization

```typescript
// apps/backend/src/middleware/sanitize.ts
import { body, validationResult } from 'express-validator';

export const sanitizePatientInput = [
  body('name').trim().escape().isLength({ min: 2, max: 100 }),
  body('email').normalizeEmail().isEmail(),
  body('phone').trim().matches(/^[0-9+\-\s()]+$/),
  body('notes').trim().isLength({ max: 5000 }),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
```

---

### 3.2 Add Content Security Policy for Frontend

```typescript
// apps/frontend/index.html
<meta http-equiv="Content-Security-Policy" 
  content="
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' https://api.stripe.com;
    frame-src https://js.stripe.com;
    font-src 'self';
  "
>
```

---

### 3.3 Implement Secrets Scanning in CI/CD

```yaml
# .github/workflows/security.yml
name: Security Scan

on: [push, pull_request]

jobs:
  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: TruffleHog Secrets Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
          extra_args: --debug --only-verified
          
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      
      - name: Run npm audit
        run: npm audit --audit-level=moderate
        
      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

---

## Compliance Checklist

### GDPR Compliance

- [x] Art. 25: Privacy by Design (DTOs, data minimization)
- [x] Art. 30: Audit logging with retention
- [x] Art. 32: Encryption at rest and in transit
- [ ] Art. 32: External KMS (production requirement)
- [ ] Art. 32: Database RLS policies
- [x] Art. 15: Data export functionality
- [x] Art. 17: Account deletion

### CRA (Cyber Resilience Act) Compliance

- [ ] No hardcoded secrets (use KMS)
- [x] Secure by default configuration
- [x] Automatic security updates (Dependabot)
- [ ] SBOM (Software Bill of Materials) generation
- [x] Vulnerability disclosure policy
- [ ] Incident response plan

### PCI-DSS Compliance (Stripe Payments)

- [x] No credit card data stored
- [ ] Webhook signature verification
- [x] TLS 1.2+ for all connections
- [x] Access logging (audit trail)
- [ ] Quarterly security scans

---

## Security Monitoring

### Recommended Tools

1. **Sentry** (Error Monitoring)
   ```typescript
   import * as Sentry from '@sentry/node';
   
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 0.1,
   });
   ```

2. **Datadog** (APM & Logging)
   ```typescript
   import tracer from 'dd-trace';
   
   tracer.init({
     service: 'therapist-platform-api',
     env: process.env.NODE_ENV,
   });
   ```

3. **AWS GuardDuty** (Threat Detection)
   - Enable in AWS Console
   - Monitors for suspicious activity
   - Integrates with CloudWatch

4. **Snyk** (Dependency Scanning)
   ```bash
   npm install -g snyk
   snyk auth
   snyk test
   snyk monitor
   ```

---

## Incident Response Plan

### Security Incident Procedures

1. **Detection**
   - Monitor audit logs for suspicious patterns
   - Alert on failed auth attempts (>10 in 5 min)
   - Monitor for SQL injection attempts

2. **Containment**
   - Immediately rotate compromised keys
   - Block suspicious IP addresses
   - Disable compromised user accounts

3. **Investigation**
   - Query audit logs: `SELECT * FROM audit_logs WHERE action = 'security.suspicious_activity'`
   - Check database for unauthorized access
   - Review application logs

4. **Recovery**
   - Restore from last known good backup
   - Re-encrypt affected data with new keys
   - Notify affected users (GDPR Art. 33)

5. **Post-Mortem**
   - Document incident timeline
   - Update security policies
   - Patch vulnerabilities

---

## Key Takeaways

### ⚠️ Critical Actions (Do This First)
1. Migrate to AWS KMS / Vault for encryption keys
2. Implement database RLS policies
3. Verify Stripe webhook signatures

### 🎯 Success Metrics
- Zero hardcoded secrets in codebase
- 100% webhook signature verification
- <100ms p95 database query latency
- 99.9% uptime via health checks

### 📚 Resources
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework
- GDPR Official Text: https://eur-lex.europa.eu/eli/reg/2016/679
- BSI IT-Grundschutz: https://www.bsi.bund.de/EN/Topics/ITGrundschutz/

---

**Last Updated:** 2026-02-06  
**Review Schedule:** Quarterly
