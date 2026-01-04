-- ===== SYMPTOM DIARY TABLE =====
-- Tabelle für das Symptom-Tagebuch der Patienten

CREATE TABLE IF NOT EXISTS symptom_diary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  
  -- Haupt-Indikatoren (1-10 Skala)
  mood_score INTEGER NOT NULL CHECK (mood_score >= 1 AND mood_score <= 10),
  anxiety_level INTEGER CHECK (anxiety_level >= 0 AND anxiety_level <= 10),
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
  stress_level INTEGER CHECK (stress_level >= 0 AND stress_level <= 10),
  
  -- Schlaf-Tracking
  sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
  sleep_hours DECIMAL(4,2) CHECK (sleep_hours >= 0 AND sleep_hours <= 24),
  
  -- JSON-Arrays für flexible Daten
  symptoms JSONB DEFAULT '[]'::jsonb,
  triggers JSONB DEFAULT '[]'::jsonb,
  activities JSONB DEFAULT '[]'::jsonb,
  medications JSONB DEFAULT '[]'::jsonb,
  
  -- Freitext-Notizen (verschlüsselt in Produktion)
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraint: Nur ein Eintrag pro Patient pro Tag
  UNIQUE(patient_id, entry_date)
);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_symptom_diary_patient_id ON symptom_diary(patient_id);
CREATE INDEX IF NOT EXISTS idx_symptom_diary_entry_date ON symptom_diary(entry_date);
CREATE INDEX IF NOT EXISTS idx_symptom_diary_patient_date ON symptom_diary(patient_id, entry_date DESC);

-- Kommentare für Dokumentation
COMMENT ON TABLE symptom_diary IS 'Symptom-Tagebuch für Patienten mit täglichen Einträgen';
COMMENT ON COLUMN symptom_diary.mood_score IS 'Stimmung: 1 (sehr schlecht) bis 10 (sehr gut)';
COMMENT ON COLUMN symptom_diary.anxiety_level IS 'Angstlevel: 0 (keine) bis 10 (extrem)';
COMMENT ON COLUMN symptom_diary.sleep_quality IS 'Schlafqualität: 1 (sehr schlecht) bis 5 (sehr gut)';
COMMENT ON COLUMN symptom_diary.symptoms IS 'Array von Symptomen (z.B. ["Kopfschmerzen", "Müdigkeit"])';
COMMENT ON COLUMN symptom_diary.triggers IS 'Array von Triggern (z.B. ["Arbeitsstress", "Konflikt"])';
COMMENT ON COLUMN symptom_diary.medications IS 'Array von Medikamenten-Objekten mit Name, Dosierung, eingenommen';
