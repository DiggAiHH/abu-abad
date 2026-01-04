-- Migration: Übungen & Hausaufgaben System
-- Datum: 2025-12-30

-- Tabelle für Patienten-Übungen
CREATE TABLE IF NOT EXISTS patient_exercises (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (
        category IN ('behavioral_activation', 'exposure', 'cognitive_restructuring', 
                     'relaxation', 'mindfulness', 'social_skills', 'problem_solving',
                     'emotion_regulation', 'self_care', 'journaling', 'other')
    ),
    instructions TEXT,
    frequency VARCHAR(20) DEFAULT 'once' CHECK (
        frequency IN ('once', 'daily', 'weekly', 'as_needed')
    ),
    due_date DATE,
    estimated_minutes INTEGER,
    resources JSONB DEFAULT '[]',
    related_diagnosis VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (
        status IN ('active', 'completed', 'cancelled')
    ),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle für Übungs-Completions
CREATE TABLE IF NOT EXISTS exercise_completions (
    id SERIAL PRIMARY KEY,
    exercise_id INTEGER NOT NULL REFERENCES patient_exercises(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT true,
    duration INTEGER, -- Minuten
    difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 10),
    mood_before INTEGER CHECK (mood_before >= 1 AND mood_before <= 10),
    mood_after INTEGER CHECK (mood_after >= 1 AND mood_after <= 10),
    notes TEXT,
    barriers JSONB DEFAULT '[]',
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_exercises_patient ON patient_exercises(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_exercises_status ON patient_exercises(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_patient_exercises_category ON patient_exercises(patient_id, category);
CREATE INDEX IF NOT EXISTS idx_patient_exercises_assigned ON patient_exercises(assigned_by);
CREATE INDEX IF NOT EXISTS idx_exercise_completions_exercise ON exercise_completions(exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_completions_date ON exercise_completions(completed_at);

-- Kommentare
COMMENT ON TABLE patient_exercises IS 'Therapeutische Übungen und Hausaufgaben für Patienten';
COMMENT ON TABLE exercise_completions IS 'Protokoll der durchgeführten Übungen mit Stimmungswerten';
COMMENT ON COLUMN patient_exercises.category IS 'Kategorie der Übung (Verhaltensaktivierung, Exposition, etc.)';
COMMENT ON COLUMN exercise_completions.barriers IS 'Array von Hindernissen bei der Durchführung';
