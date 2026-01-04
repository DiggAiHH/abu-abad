-- ===== CRISIS PLANS TABLE =====
-- Notfall-/Krisenplan für Patienten

CREATE TABLE IF NOT EXISTS crisis_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Verschlüsselte Plandaten (JSON)
  plan_data_encrypted TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===== CRISIS PLAN SHARES TABLE =====
-- Geteilte Krisenpläne mit Therapeuten

CREATE TABLE IF NOT EXISTS crisis_plan_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crisis_plan_id UUID NOT NULL REFERENCES crisis_plans(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(crisis_plan_id, therapist_id)
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_crisis_plans_patient ON crisis_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_crisis_plan_shares_therapist ON crisis_plan_shares(therapist_id);

-- Kommentare
COMMENT ON TABLE crisis_plans IS 'Verschlüsselte Krisenpläne mit Notfallkontakten und Bewältigungsstrategien';
COMMENT ON COLUMN crisis_plans.plan_data_encrypted IS 'AES-256 verschlüsseltes JSON mit Warnsignalen, Kontakten, Strategien';
