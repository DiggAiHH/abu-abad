-- ===== PATIENT DIAGNOSES TABLE =====
-- Patientendiagnosen mit ICD-10/11 Codes

CREATE TABLE IF NOT EXISTS patient_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- ICD-10/11 Code
  icd_code VARCHAR(20) NOT NULL,
  icd_name VARCHAR(300) NOT NULL,
  
  -- Diagnose-Typ
  diagnosis_type VARCHAR(20) NOT NULL DEFAULT 'suspected'
    CHECK (diagnosis_type IN ('confirmed', 'suspected', 'differential', 'history')),
  
  -- Schweregrad
  severity VARCHAR(20) CHECK (severity IN ('mild', 'moderate', 'severe')),
  
  -- Beschreibung
  notes TEXT,
  
  -- Zeitraum
  start_date DATE,
  end_date DATE, -- NULL = aktuell noch aktiv
  
  -- Primärdiagnose Flag
  is_primary BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_diagnoses_patient ON patient_diagnoses(patient_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_therapist ON patient_diagnoses(therapist_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_icd_code ON patient_diagnoses(icd_code);
CREATE INDEX IF NOT EXISTS idx_diagnoses_type ON patient_diagnoses(diagnosis_type);
CREATE INDEX IF NOT EXISTS idx_diagnoses_primary ON patient_diagnoses(patient_id, is_primary) 
  WHERE is_primary = TRUE;

-- Kommentare
COMMENT ON TABLE patient_diagnoses IS 'ICD-10/11 Diagnosen pro Patient';
COMMENT ON COLUMN patient_diagnoses.diagnosis_type IS 'confirmed = gesichert, suspected = Verdacht, differential = Differenzialdiagnose, history = historisch';
COMMENT ON COLUMN patient_diagnoses.is_primary IS 'Hauptdiagnose des Patienten';
