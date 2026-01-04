-- Migration: Medikamenten-Tracking-System
-- Datum: 2025-12-30

-- Tabelle für Patienten-Medikamente
CREATE TABLE IF NOT EXISTS patient_medications (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    generic_name VARCHAR(200),
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(50) NOT NULL CHECK (
        frequency IN ('once_daily', 'twice_daily', 'three_times', 'four_times', 'as_needed', 'weekly', 'other')
    ),
    frequency_details VARCHAR(200),
    timing JSONB DEFAULT '[]',
    prescribed_by VARCHAR(200),
    start_date DATE,
    end_date DATE,
    reason VARCHAR(500),
    category VARCHAR(50) DEFAULT 'other_psychiatric' CHECK (
        category IN ('antidepressant', 'anxiolytic', 'antipsychotic', 'mood_stabilizer', 
                     'stimulant', 'sedative', 'other_psychiatric', 'other_medical')
    ),
    notes TEXT,
    side_effects JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle für Einnahme-Protokoll
CREATE TABLE IF NOT EXISTS medication_intake_log (
    id SERIAL PRIMARY KEY,
    medication_id INTEGER NOT NULL REFERENCES patient_medications(id) ON DELETE CASCADE,
    taken BOOLEAN NOT NULL,
    scheduled_time TIME,
    actual_time TIME,
    skipped_reason VARCHAR(500),
    side_effects_noted JSONB DEFAULT '[]',
    notes VARCHAR(500),
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes für Performance
CREATE INDEX IF NOT EXISTS idx_patient_medications_patient ON patient_medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_medications_active ON patient_medications(patient_id, is_active);
CREATE INDEX IF NOT EXISTS idx_patient_medications_category ON patient_medications(patient_id, category);
CREATE INDEX IF NOT EXISTS idx_medication_intake_medication ON medication_intake_log(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_intake_date ON medication_intake_log(logged_at);
CREATE INDEX IF NOT EXISTS idx_medication_intake_medication_date ON medication_intake_log(medication_id, logged_at);

-- Kommentare
COMMENT ON TABLE patient_medications IS 'Medikamente der Patienten mit Dosierung und Einnahme-Schema';
COMMENT ON TABLE medication_intake_log IS 'Protokoll der tatsächlichen Medikamenten-Einnahmen';
COMMENT ON COLUMN patient_medications.timing IS 'Array von Uhrzeiten als JSON, z.B. ["08:00", "20:00"]';
COMMENT ON COLUMN patient_medications.side_effects IS 'Array von bekannten Nebenwirkungen als JSON';
COMMENT ON COLUMN medication_intake_log.side_effects_noted IS 'Array von Nebenwirkungen bei dieser Einnahme';
