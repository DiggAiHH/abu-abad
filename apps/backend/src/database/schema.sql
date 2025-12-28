-- PostgreSQL 15 Schema für Therapeuten-Plattform
-- Quelle: PostgreSQL 15 Documentation - https://www.postgresql.org/docs/15/ (Abruf: 2025-12-28)
-- DSGVO-Konform: Art. 25 (Privacy by Design), Art. 32 (Datensicherheit)

-- UUID Extension aktivieren
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =============================================================================
-- BENUTZER-TABELLE (users)
-- DSGVO Art. 6 (Rechtsgrundlage), Art. 13 (Informationspflicht)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('therapist', 'patient')),
  
  -- Persönliche Daten (verschlüsselt in Anwendungsschicht)
  -- DSGVO Art. 32 (1) a - Pseudonymisierung und Verschlüsselung
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
  -- Art. 7 - Nachweis der Einwilligung
  gdpr_consent_at TIMESTAMP WITH TIME ZONE,
  -- Art. 17 - Recht auf Löschung (automatische Löschung nach Ablauf)
  data_retention_until TIMESTAMP WITH TIME ZONE
);

-- Performance-Index für Login
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = TRUE;

-- =============================================================================
-- TERMINE-TABELLE (appointments)
-- DSGVO Art. 9 (Gesundheitsdaten - besondere Kategorien)
-- =============================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Termindetails
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 50,
  
  -- Status: available, booked, completed, cancelled
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  appointment_type VARCHAR(50) DEFAULT 'video', -- video, audio, in-person
  
  -- Notizen (verschlüsselt) - DSGVO Art. 9 (Gesundheitsdaten)
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

CREATE INDEX IF NOT EXISTS idx_appointments_therapist ON appointments(therapist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- =============================================================================
-- ZAHLUNGEN-TABELLE (payments)
-- PCI DSS Compliance: Keine Kartendaten speichern!
-- Quelle: PCI Security Standards Council - https://www.pcisecuritystandards.org/ (Abruf: 2025-12-28)
-- =============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Stripe-Daten (nur Referenzen, keine Kartendaten!)
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

CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_therapist ON payments(therapist_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON payments(stripe_payment_intent_id);

-- =============================================================================
-- NACHRICHTEN-TABELLE (messages)
-- DSGVO Art. 32 - End-to-End-Verschlüsselung
-- =============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Verschlüsselter Inhalt (AES-256-GCM)
  content_encrypted TEXT NOT NULL,
  
  -- Metadaten
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- =============================================================================
-- REFRESH TOKENS (refresh_tokens)
-- Quelle: RFC 6749 - OAuth 2.0 - https://tools.ietf.org/html/rfc6749 (Abruf: 2025-12-28)
-- =============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- =============================================================================
-- AUDIT LOG (audit_logs)
-- DSGVO Art. 30 - Verzeichnis von Verarbeitungstätigkeiten
-- DSGVO Art. 32 (1) d - Verfahren zur Überprüfung der Wirksamkeit
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- =============================================================================
-- TRIGGER für automatisches updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger anwenden
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VIEWS für DSGVO-Compliance
-- =============================================================================

-- View: Benutzer mit auslaufendem Consent (30 Tage Warnung)
CREATE OR REPLACE VIEW users_consent_expiring AS
SELECT 
  id,
  email,
  role,
  gdpr_consent_at,
  data_retention_until,
  (data_retention_until - CURRENT_TIMESTAMP) AS days_until_deletion
FROM users
WHERE data_retention_until IS NOT NULL
  AND data_retention_until <= (CURRENT_TIMESTAMP + INTERVAL '30 days')
  AND data_retention_until > CURRENT_TIMESTAMP
ORDER BY data_retention_until ASC;

-- View: Audit-Log für spezifische Benutzer (DSGVO Art. 15 - Auskunftsrecht)
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
  u.id AS user_id,
  u.email,
  u.role,
  COUNT(DISTINCT a.id) AS total_appointments,
  COUNT(DISTINCT p.id) AS total_payments,
  COUNT(DISTINCT m.id) AS total_messages_sent,
  COUNT(DISTINCT al.id) AS total_audit_entries,
  MAX(u.last_login_at) AS last_login,
  u.created_at AS account_created
FROM users u
LEFT JOIN appointments a ON (u.id = a.therapist_id OR u.id = a.patient_id)
LEFT JOIN payments p ON (u.id = p.patient_id OR u.id = p.therapist_id)
LEFT JOIN messages m ON u.id = m.sender_id
LEFT JOIN audit_logs al ON u.id = al.user_id
GROUP BY u.id, u.email, u.role, u.last_login_at, u.created_at;

-- =============================================================================
-- INITIAL DATA (optional - nur für Development)
-- =============================================================================

-- Kommentar: In Production via Migrations einfügen
-- INSERT INTO users (email, password_hash, role, ...) VALUES (...);
