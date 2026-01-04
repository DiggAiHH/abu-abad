-- ===== SCREENING RESULTS TABLE =====
-- Ergebnisse standardisierter psychologischer Tests

CREATE TABLE IF NOT EXISTS screening_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Screening-Typ
  screening_type VARCHAR(20) NOT NULL 
    CHECK (screening_type IN ('PHQ-9', 'GAD-7', 'PHQ-4', 'ISI', 'BDI-II', 'PCL-5')),
  
  -- Antworten als JSON Array
  answers JSONB NOT NULL,
  
  -- Ergebnis
  total_score INTEGER NOT NULL,
  severity VARCHAR(30) NOT NULL,
  result_data JSONB, -- Zusätzliche Auswertungsdaten
  
  -- Zuweisung durch Therapeuten (optional)
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===== SCREENING ASSIGNMENTS TABLE =====
-- Zugewiesene Screenings vom Therapeuten an Patienten

CREATE TABLE IF NOT EXISTS screening_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  screening_type VARCHAR(20) NOT NULL,
  due_date DATE,
  message TEXT,
  
  -- Status
  completed_at TIMESTAMP WITH TIME ZONE,
  result_id UUID REFERENCES screening_results(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_screening_results_patient ON screening_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_screening_results_type ON screening_results(screening_type);
CREATE INDEX IF NOT EXISTS idx_screening_results_date ON screening_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screening_assignments_patient ON screening_assignments(patient_id);
CREATE INDEX IF NOT EXISTS idx_screening_assignments_pending 
  ON screening_assignments(patient_id, completed_at) WHERE completed_at IS NULL;

-- Kommentare
COMMENT ON TABLE screening_results IS 'Ergebnisse standardisierter Screenings (PHQ-9, GAD-7, etc.)';
COMMENT ON TABLE screening_assignments IS 'Vom Therapeuten zugewiesene Screenings';
COMMENT ON COLUMN screening_results.severity IS 'none, mild, moderate, moderately-severe, severe';
