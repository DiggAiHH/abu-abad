-- ===== THERAPY NOTES TABLE =====
-- Therapie-Sitzungsnotizen im SOAP-Format

CREATE TABLE IF NOT EXISTS therapy_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Session Metadata
  session_date DATE NOT NULL,
  session_number INTEGER,
  session_duration INTEGER, -- in Minuten
  
  -- SOAP Format (verschlüsselt)
  subjective_encrypted TEXT,   -- Patientenbericht
  objective_encrypted TEXT,    -- Therapeutenbeobachtungen
  assessment_encrypted TEXT,   -- Diagnose/Einschätzung
  plan_encrypted TEXT,         -- Behandlungsplan
  
  -- Klinische Daten
  diagnosis JSONB DEFAULT '[]'::jsonb,         -- ICD-10 Codes
  interventions JSONB DEFAULT '[]'::jsonb,     -- Angewandte Interventionen
  homework TEXT,                                -- Hausaufgaben
  
  -- Risikobewertung
  risk_assessment VARCHAR(20) DEFAULT 'none' 
    CHECK (risk_assessment IN ('none', 'low', 'moderate', 'high', 'acute')),
  suicidal_ideation BOOLEAN DEFAULT FALSE,
  
  -- Mental Status Examination
  mental_status JSONB DEFAULT '{}'::jsonb,
  
  -- Fortschritt
  progress_rating INTEGER CHECK (progress_rating >= 1 AND progress_rating <= 5),
  goals_addressed JSONB DEFAULT '[]'::jsonb,
  
  -- Nächste Schritte
  next_session_planned DATE,
  follow_up_required BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_therapy_notes_therapist ON therapy_notes(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapy_notes_patient ON therapy_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_therapy_notes_date ON therapy_notes(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_therapy_notes_risk ON therapy_notes(risk_assessment) 
  WHERE risk_assessment IN ('high', 'acute');
CREATE INDEX IF NOT EXISTS idx_therapy_notes_therapist_patient 
  ON therapy_notes(therapist_id, patient_id, session_date DESC);

-- Kommentare
COMMENT ON TABLE therapy_notes IS 'Verschlüsselte Therapie-Sitzungsnotizen im SOAP-Format';
COMMENT ON COLUMN therapy_notes.subjective_encrypted IS 'Verschlüsselter Patientenbericht (S in SOAP)';
COMMENT ON COLUMN therapy_notes.objective_encrypted IS 'Verschlüsselte Therapeuten-Beobachtungen (O in SOAP)';
COMMENT ON COLUMN therapy_notes.assessment_encrypted IS 'Verschlüsselte Diagnose/Einschätzung (A in SOAP)';
COMMENT ON COLUMN therapy_notes.plan_encrypted IS 'Verschlüsselter Behandlungsplan (P in SOAP)';
COMMENT ON COLUMN therapy_notes.risk_assessment IS 'Suizid-/Selbstverletzungsrisiko: none, low, moderate, high, acute';
