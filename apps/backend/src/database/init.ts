/**
 * Datenbankinitialisierung mit PostgreSQL
 * Implementiert Connection Pooling für Performance
 * ACID-Garantien für Gesundheitsdaten
 * ENV: Validiert durch env.ts (DATABASE_URL required)
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { logger } from '../utils/logger.js';
import env from '../config/env.js';

// Lazy Loading: Pool wird erst erstellt wenn benötigt
let _pool: Pool | null = null;
export const getPool = (): Pool => {
  if (!_pool) {
    _pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20, // Maximum Anzahl Verbindungen im Pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Error Handler für Pool (Fail-Fast)
    _pool.on('error', (err) => {
      logger.error('❌ Unerwarteter Pool-Error:', err);
      process.exit(1); // Sicherstellen dass DB-Fehler nicht unbemerkt bleiben
    });
  }
  return _pool;
};

// Compatibility: Behält alten pool export für bestehenden Code
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    return getPool()[prop as keyof Pool];
  }
});

/**
 * Testet Datenbankverbindung und erstellt Schema
 */
export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  
  try {
    // Test Query
    const result = await client.query('SELECT NOW()');
    logger.info(`Datenbank verbunden: ${result.rows[0].now}`);

    // Schema erstellen
    await createSchema(client);
    
  } catch (error) {
    logger.error('Datenbankinitialisierung fehlgeschlagen:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Erstellt alle notwendigen Tabellen
 * DSGVO-konform: Sensible Daten werden verschlüsselt gespeichert
 */
async function createSchema(client: PoolClient): Promise<void> {
  await client.query(`
    -- Benutzer-Tabelle (Therapeuten und Patienten)
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('therapist', 'patient')),
      
      -- Persönliche Daten (verschlüsselt in Anwendung)
      first_name_encrypted TEXT NOT NULL,
      last_name_encrypted TEXT NOT NULL,
      phone_encrypted TEXT,
      date_of_birth DATE,
      
      -- Adressdaten (optional, verschlüsselt)
      street_encrypted TEXT,
      city_encrypted TEXT,
      postal_code_encrypted TEXT,
      country VARCHAR(2) DEFAULT 'DE',
      
      -- Therapeuten-spezifische Felder
      license_number VARCHAR(100),
      specialization TEXT,
      bio TEXT,
      hourly_rate DECIMAL(10, 2),
      
      -- Status & Timestamps
      is_verified BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      email_verified_at TIMESTAMP WITH TIME ZONE,
      last_login_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      
      -- DSGVO-Compliance
      gdpr_consent_at TIMESTAMP WITH TIME ZONE,
      data_retention_until TIMESTAMP WITH TIME ZONE
    );

    -- Appointments-Tabelle
    CREATE TABLE IF NOT EXISTS appointments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      patient_id UUID REFERENCES users(id) ON DELETE SET NULL,
      
      -- Termindetails
      start_time TIMESTAMP WITH TIME ZONE NOT NULL,
      end_time TIMESTAMP WITH TIME ZONE NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 50,
      
      -- Status: available, booked, completed, cancelled
      status VARCHAR(20) NOT NULL DEFAULT 'available',
      appointment_type VARCHAR(50) DEFAULT 'video', -- video, audio, in-person
      
      -- Notizen (verschlüsselt)
      therapist_notes_encrypted TEXT,
      patient_notes_encrypted TEXT,
      
      -- Bezahlung
      price DECIMAL(10, 2),
      payment_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, refunded
      payment_id UUID,
      
      -- Video-Call Daten
      room_id VARCHAR(255),
      peer_therapist_id VARCHAR(255),
      peer_patient_id VARCHAR(255),
      
      -- Timestamps
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      cancelled_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      
      CONSTRAINT valid_time_range CHECK (end_time > start_time)
    );

    -- Payments-Tabelle (Stripe-Integration)
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
      patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      
      -- Stripe-Daten
      stripe_payment_intent_id VARCHAR(255) UNIQUE,
      stripe_charge_id VARCHAR(255),
      
      -- Betragsdetails
      amount DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'EUR',
      
      -- Status
      status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, succeeded, failed, refunded
      
      -- Metadaten
      description TEXT,
      metadata JSONB,
      
      -- Timestamps
      paid_at TIMESTAMP WITH TIME ZONE,
      refunded_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Messages-Tabelle (verschlüsselte Kommunikation)
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
      
      -- Verschlüsselter Inhalt (End-to-End)
      content_encrypted TEXT NOT NULL,
      
      -- Metadaten
      is_read BOOLEAN DEFAULT FALSE,
      read_at TIMESTAMP WITH TIME ZONE,
      
      -- Timestamps
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Refresh Tokens für JWT
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      revoked_at TIMESTAMP WITH TIME ZONE
    );

    -- Audit Log (DSGVO Art. 32 - Nachvollziehbarkeit)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      resource_type VARCHAR(50),
      resource_id UUID,
      ip_address INET,
      user_agent TEXT,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Indizes für Performance
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_appointments_therapist ON appointments(therapist_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
    CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_payments_therapist ON payments(therapist_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

    -- Trigger für updated_at
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Trigger anwenden
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_appointments_updated_at') THEN
        CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payments_updated_at') THEN
        CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_messages_updated_at') THEN
        CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      END IF;
    END$$;
  `);

  logger.info('✓ Datenbankschema erstellt/aktualisiert');
}

/**
 * Query-Wrapper mit Performance-Logging
 * @returns PostgreSQL QueryResult mit typed rows
 */
export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  
  if (duration > 1000) {
    logger.warn(`Langsame Query (${duration}ms): ${text}`);
  }
  
  return result;
}
