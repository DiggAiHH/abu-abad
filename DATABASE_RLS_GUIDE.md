# 🗄️ Database Row-Level Security (RLS) Implementation Guide

## Overview
PostgreSQL Row-Level Security (RLS) provides defense-in-depth by enforcing data isolation **at the database level**, preventing unauthorized access even if application logic is bypassed (e.g., SQL injection).

---

## Why RLS is Critical for Healthcare

### GDPR Requirements
- **Art. 32**: Technical measures to ensure data protection
- **Art. 25**: Privacy by Design - access control at every layer

### Security Benefits
1. **Defense in Depth**: Even if SQL injection occurs, RLS prevents data access
2. **Multi-Tenancy**: Guarantees data isolation between patients/therapists
3. **Audit Trail**: PostgreSQL logs all RLS policy violations
4. **Zero Trust**: Application cannot bypass database-level security

---

## Implementation Steps

### Step 1: Create Database Roles

```sql
-- Create application roles
CREATE ROLE app_admin;
CREATE ROLE app_therapist;
CREATE ROLE app_patient;
CREATE ROLE app_service; -- For background jobs

-- Grant connection permissions
GRANT CONNECT ON DATABASE therapist_db TO app_admin, app_therapist, app_patient, app_service;
```

### Step 2: Enable RLS on Tables

```sql
-- Enable RLS on all sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

### Step 3: Create RLS Policies

#### Users Table
```sql
-- Users can only see their own record
CREATE POLICY user_self_access ON users
  FOR ALL
  USING (id = current_setting('app.current_user_id', true)::UUID);

-- Admins can see all users
CREATE POLICY admin_full_access ON users
  FOR ALL
  TO app_admin
  USING (true);
```

#### Patients Table
```sql
-- Patients can only see their own data
CREATE POLICY patient_self_access ON patients
  FOR ALL
  USING (
    user_id = current_setting('app.current_user_id', true)::UUID
  );

-- Therapists can see their assigned patients
CREATE POLICY therapist_patient_access ON patients
  FOR SELECT
  USING (
    therapist_id = current_setting('app.current_user_id', true)::UUID
  );

-- Therapists can update their patients' data
CREATE POLICY therapist_patient_update ON patients
  FOR UPDATE
  USING (
    therapist_id = current_setting('app.current_user_id', true)::UUID
  );
```

#### Appointments Table
```sql
-- Users can access appointments where they are involved
CREATE POLICY appointment_participant_access ON appointments
  FOR ALL
  USING (
    therapist_id = current_setting('app.current_user_id', true)::UUID
    OR patient_id = current_setting('app.current_user_id', true)::UUID
  );

-- Prevent modification of past appointments
CREATE POLICY appointment_no_past_modification ON appointments
  FOR UPDATE
  USING (
    scheduled_at > NOW() - INTERVAL '24 hours'
  );
```

#### Messages Table
```sql
-- Users can only see messages they sent or received
CREATE POLICY message_participant_access ON messages
  FOR ALL
  USING (
    sender_id = current_setting('app.current_user_id', true)::UUID
    OR recipient_id = current_setting('app.current_user_id', true)::UUID
  );

-- Users can only delete their own sent messages (within 5 minutes)
CREATE POLICY message_sender_delete ON messages
  FOR DELETE
  USING (
    sender_id = current_setting('app.current_user_id', true)::UUID
    AND created_at > NOW() - INTERVAL '5 minutes'
  );
```

#### Medical Records Table (Most Sensitive)
```sql
-- Only assigned therapist can access medical records
CREATE POLICY medical_record_therapist_access ON medical_records
  FOR ALL
  USING (
    therapist_id = current_setting('app.current_user_id', true)::UUID
  );

-- Patient can read (but not modify) their own medical records
CREATE POLICY medical_record_patient_read ON medical_records
  FOR SELECT
  USING (
    patient_id = current_setting('app.current_user_id', true)::UUID
  );

-- Require explicit consent for medical record access
CREATE POLICY medical_record_consent_required ON medical_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM patient_consents
      WHERE patient_id = medical_records.patient_id
        AND therapist_id = current_setting('app.current_user_id', true)::UUID
        AND consent_type = 'medical_records_access'
        AND valid_until > NOW()
    )
  );
```

#### Audit Logs Table
```sql
-- Users can read their own audit logs (GDPR Art. 15)
CREATE POLICY audit_log_self_access ON audit_logs
  FOR SELECT
  USING (
    user_id = current_setting('app.current_user_id', true)::UUID
  );

-- Admins can read all audit logs
CREATE POLICY audit_log_admin_access ON audit_logs
  FOR SELECT
  TO app_admin
  USING (true);

-- NO ONE can modify or delete audit logs (immutable)
-- (Default: No UPDATE/DELETE policies = Denied)
```

### Step 4: Application Integration

#### Middleware to Set User Context

```typescript
// apps/backend/src/middleware/rls.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

export async function setRLSContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return next();
  }

  const pool: Pool = (req as any).pool;

  try {
    // Set current user ID for RLS policies
    await pool.query(
      "SELECT set_config('app.current_user_id', $1, false)",
      [req.user.id]
    );

    // Set current user role
    await pool.query(
      "SELECT set_config('app.current_user_role', $1, false)",
      [req.user.role]
    );

    // Optional: Set session metadata for audit
    await pool.query(
      "SELECT set_config('app.session_id', $1, false)",
      [req.sessionID || 'unknown']
    );

    next();
  } catch (error) {
    console.error('Failed to set RLS context:', error);
    res.status(500).json({ error: 'Security context initialization failed' });
  }
}
```

#### Apply Middleware Globally

```typescript
// apps/backend/src/index.ts
import { authenticate } from './middleware/auth.js';
import { setRLSContext } from './middleware/rls.middleware.js';

// Apply RLS context after authentication
app.use('/api', authenticate, setRLSContext, routes);
```

### Step 5: Testing RLS Policies

```sql
-- Test as patient
SET app.current_user_id = 'patient-uuid-123';
SET app.current_user_role = 'patient';

-- Should only see own appointments
SELECT * FROM appointments;

-- Try to access another patient's appointment (should fail)
SELECT * FROM appointments WHERE patient_id = 'other-patient-uuid';

-- Reset
RESET app.current_user_id;
RESET app.current_user_role;
```

#### Automated Testing

```typescript
// apps/backend/tests/rls.test.ts
import { describe, test, expect } from 'vitest';
import { getDatabaseService } from '../src/services/database.service.js';

describe('Row-Level Security', () => {
  const db = getDatabaseService();

  test('patient can only see own appointments', async () => {
    // Set context as patient-123
    await db.query("SELECT set_config('app.current_user_id', $1, false)", ['patient-123']);

    // Query appointments
    const appointments = await db.query('SELECT * FROM appointments');

    // All appointments should belong to patient-123
    appointments.forEach(apt => {
      expect(apt.patient_id).toBe('patient-123');
    });
  });

  test('therapist can see assigned patients', async () => {
    // Set context as therapist-456
    await db.query("SELECT set_config('app.current_user_id', $1, false)", ['therapist-456']);

    const patients = await db.query('SELECT * FROM patients');

    // All patients should be assigned to therapist-456
    patients.forEach(patient => {
      expect(patient.therapist_id).toBe('therapist-456');
    });
  });

  test('user cannot access other users medical records', async () => {
    await db.query("SELECT set_config('app.current_user_id', $1, false)", ['patient-123']);

    // Try to access another patient's records
    const records = await db.query(
      'SELECT * FROM medical_records WHERE patient_id = $1',
      ['other-patient-456']
    );

    // Should return empty (RLS blocks access)
    expect(records.length).toBe(0);
  });

  test('audit logs are immutable', async () => {
    await db.query("SELECT set_config('app.current_user_id', $1, false)", ['hacker-999']);

    // Try to delete audit logs (should fail)
    await expect(
      db.query('DELETE FROM audit_logs WHERE user_id = $1', ['patient-123'])
    ).rejects.toThrow();

    // Try to update audit logs (should fail)
    await expect(
      db.query('UPDATE audit_logs SET action = $1 WHERE id = $2', ['fake_action', 'some-id'])
    ).rejects.toThrow();
  });
});
```

---

## Migration Strategy

### Phase 1: Preparation (1 day)
1. Back up database: `pg_dump therapist_db > backup.sql`
2. Test RLS policies in staging environment
3. Create rollback plan

### Phase 2: Implementation (2 hours)
1. Enable RLS on tables (requires brief downtime)
2. Create policies
3. Deploy application with RLS middleware

### Phase 3: Validation (1 day)
1. Run automated RLS tests
2. Manual security audit
3. Monitor for policy violations in logs

### Phase 4: Monitoring (Ongoing)
1. Check PostgreSQL logs for RLS violations
2. Review audit logs for unusual access patterns
3. Quarterly security review

---

## Performance Considerations

### Index Optimization for RLS

```sql
-- Add indexes for RLS policy conditions
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_therapist ON appointments(therapist_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_medical_records_therapist ON medical_records(therapist_id);
CREATE INDEX idx_medical_records_patient ON medical_records(patient_id);

-- Analyze tables after index creation
ANALYZE appointments;
ANALYZE messages;
ANALYZE medical_records;
```

### Query Performance Testing

```sql
-- Explain query plan with RLS
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM appointments
WHERE patient_id = 'patient-123';

-- Should use index scan, not sequential scan
```

---

## Troubleshooting

### Policy Not Applied

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

### Access Denied Errors

```typescript
// Debug: Check current RLS context
const context = await db.query(`
  SELECT 
    current_setting('app.current_user_id', true) as user_id,
    current_setting('app.current_user_role', true) as role
`);
console.log('RLS Context:', context.rows[0]);
```

### Bypass RLS (Admin Operations)

```sql
-- Temporarily disable RLS (superuser only)
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;

-- Perform admin operation
UPDATE appointments SET status = 'cancelled' WHERE id = 'xyz';

-- Re-enable RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
```

---

## Best Practices

### 1. Always Test in Staging First
RLS policies can break application functionality if misconfigured.

### 2. Use Explicit Policy Names
```sql
-- Good
CREATE POLICY patient_self_access ON patients ...

-- Bad
CREATE POLICY policy_1 ON patients ...
```

### 3. Grant Least Privilege
Start restrictive, then relax as needed.

### 4. Monitor Policy Violations
```sql
-- Query PostgreSQL logs for RLS violations
SELECT * FROM pg_stat_activity
WHERE query LIKE '%permission denied%';
```

### 5. Document Business Logic
```sql
COMMENT ON POLICY patient_self_access ON patients IS
  'GDPR Art. 32: Patients can only access their own data';
```

---

## Compliance Checklist

- [ ] RLS enabled on all sensitive tables
- [ ] Policies tested for each user role
- [ ] Application middleware sets user context
- [ ] Indexes optimized for policy conditions
- [ ] Audit logs are immutable (no UPDATE/DELETE policies)
- [ ] Admin bypass documented and restricted
- [ ] Monitoring alerts configured for policy violations
- [ ] Backup/recovery plan tested with RLS enabled

---

## Resources

- **PostgreSQL RLS Documentation**: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- **OWASP Database Security**: https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html
- **GDPR Art. 32 Technical Measures**: https://gdpr-info.eu/art-32-gdpr/

---

**Last Updated:** 2026-02-06  
**Review Schedule:** Quarterly
