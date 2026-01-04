/**
 * DB Seeding (Development/Test)
 * Legt deterministische Test-Accounts an (siehe TEST_CREDENTIALS.md).
 */

import bcrypt from 'bcrypt';
import { initDatabase, query } from './init.js';
import { encrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

type UserRole = 'therapist' | 'patient';

async function ensureUser(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  licenseNumber?: string;
  specialization?: string;
  hourlyRate?: number;
}): Promise<{ id: string; created: boolean }> {
  const existing = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [params.email]);
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, created: false };
  }

  const passwordHash = await bcrypt.hash(params.password, 12);

  const result = await query<{ id: string }>(
    `INSERT INTO users (
      email,
      password_hash,
      role,
      first_name_encrypted,
      last_name_encrypted,
      phone_encrypted,
      license_number,
      specialization,
      hourly_rate,
      gdpr_consent_at
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6,
      $7, $8, $9,
      CURRENT_TIMESTAMP
    )
    RETURNING id`,
    [
      params.email,
      passwordHash,
      params.role,
      encrypt(params.firstName),
      encrypt(params.lastName),
      params.phone ? encrypt(params.phone) : null,
      params.licenseNumber ?? null,
      params.specialization ?? null,
      params.hourlyRate ?? null
    ]
  );

  return { id: result.rows[0].id, created: true };
}

async function main(): Promise<void> {
  try {
    await initDatabase();

    const therapist = await ensureUser({
      email: 'therapeut@test.de',
      password: 'Test123!',
      firstName: 'Dr. Anna',
      lastName: 'Schmidt',
      role: 'therapist',
      phone: '+49123456789',
      specialization: 'Neurologie',
      licenseNumber: 'DE-12345',
      hourlyRate: 120
    });

    const patient = await ensureUser({
      email: 'patient@test.de',
      password: 'Test123!',
      firstName: 'Max',
      lastName: 'Mustermann',
      role: 'patient',
      phone: '+49987654321'
    });

    logger.info('✓ DB seed: Test-User bereit', {
      therapist: { id: therapist.id, created: therapist.created },
      patient: { id: patient.id, created: patient.created }
    });

    process.exit(0);
  } catch (error) {
    logger.error('❌ DB seed fehlgeschlagen:', error);
    process.exit(1);
  }
}

main();
