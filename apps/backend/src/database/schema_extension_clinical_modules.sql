-- ══════════════════════════════════════════════════════════════
-- SCHEMA EXTENSION: Symptom Diary, Medications, Therapy Notes, Billing
-- ══════════════════════════════════════════════════════════════
-- Ziel: Minimaler Backend-Support für bestehende Frontend-Module
-- DSGVO: Freitextfelder optional verschlüsselt (Art. 9/32)
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- SYMPTOM DIARY (patient symptom/mood diary)
-- =============================================================================
CREATE TABLE IF NOT EXISTS symptom_diary_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,

  mood_score INTEGER NOT NULL CHECK (mood_score >= 0 AND mood_score <= 10),
  anxiety_level INTEGER CHECK (anxiety_level >= 0 AND anxiety_level <= 10),
  sleep_quality INTEGER CHECK (sleep_quality >= 0 AND sleep_quality <= 5),
  sleep_hours NUMERIC(4,1) CHECK (sleep_hours >= 0 AND sleep_hours <= 24),
  energy_level INTEGER CHECK (energy_level >= 0 AND energy_level <= 10),
  stress_level INTEGER CHECK (stress_level >= 0 AND stress_level <= 10),

  symptoms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  triggers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  activities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- Array von { name, dosage?, taken }
  medications JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- optionaler Freitext (verschlüsselt in App-Schicht)
  notes_encrypted TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uniq_symptom_diary_patient_date UNIQUE (patient_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_symptom_diary_patient_date ON symptom_diary_entries(patient_id, entry_date DESC);

-- =============================================================================
-- MEDICATIONS (patient medication tracker)
-- =============================================================================
CREATE TABLE IF NOT EXISTS patient_medications (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  generic_name TEXT,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  frequency_details TEXT,
  timing TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  prescribed_by TEXT,
  start_date DATE,
  end_date DATE,
  reason TEXT,
  category TEXT,
  notes TEXT,
  side_effects TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patient_medications_patient ON patient_medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_medications_active ON patient_medications(patient_id, is_active);

CREATE TABLE IF NOT EXISTS medication_intake_log (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id BIGINT NOT NULL REFERENCES patient_medications(id) ON DELETE CASCADE,

  taken BOOLEAN NOT NULL,
  scheduled_time TEXT,
  actual_time TEXT,
  skipped_reason TEXT,
  side_effects_noted TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes TEXT,

  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_med_intake_patient_time ON medication_intake_log(patient_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_intake_med ON medication_intake_log(medication_id, logged_at DESC);

-- =============================================================================
-- THERAPY NOTES (therapist SOAP notes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS therapy_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,

  session_date DATE NOT NULL,
  session_number INTEGER,
  session_duration INTEGER,

  subjective_encrypted TEXT,
  objective_encrypted TEXT,
  assessment_encrypted TEXT,
  plan_encrypted TEXT,
  homework_encrypted TEXT,

  diagnosis TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  interventions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  risk_assessment TEXT NOT NULL DEFAULT 'none' CHECK (risk_assessment IN ('none','low','moderate','high','acute')),
  suicidal_ideation BOOLEAN NOT NULL DEFAULT FALSE,

  mental_status JSONB NOT NULL DEFAULT '{}'::jsonb,

  progress_rating INTEGER CHECK (progress_rating >= 1 AND progress_rating <= 5),
  goals_addressed TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  next_session_planned DATE,
  follow_up_required BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_therapy_notes_tp_date ON therapy_notes(therapist_id, patient_id, session_date DESC);

-- =============================================================================
-- BILLING (invoices + settings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS billing_settings (
  therapist_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  practice_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  zip_code TEXT,
  city TEXT,
  tax_id TEXT,
  bank_name TEXT,
  iban TEXT,
  bic TEXT,
  invoice_footer TEXT,
  next_invoice_number INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,

  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,

  total NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uniq_invoice_number_per_therapist UNIQUE (therapist_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_therapist_date ON invoices(therapist_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_patient_date ON invoices(patient_id, invoice_date DESC);

-- =============================================================================
-- updated_at trigger (reuse existing function if present)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_symptom_diary_entries_updated_at') THEN
    CREATE TRIGGER update_symptom_diary_entries_updated_at BEFORE UPDATE ON symptom_diary_entries
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_patient_medications_updated_at') THEN
    CREATE TRIGGER update_patient_medications_updated_at BEFORE UPDATE ON patient_medications
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_therapy_notes_updated_at') THEN
    CREATE TRIGGER update_therapy_notes_updated_at BEFORE UPDATE ON therapy_notes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_billing_settings_updated_at') THEN
    CREATE TRIGGER update_billing_settings_updated_at BEFORE UPDATE ON billing_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_invoices_updated_at') THEN
    CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;
