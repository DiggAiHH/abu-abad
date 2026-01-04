-- ══════════════════════════════════════════════════════════════
-- MIGRATION 003: PATIENT MATERIALS & QUESTIONNAIRES
-- ══════════════════════════════════════════════════════════════
-- DSGVO Art. 9: Besondere Kategorien personenbezogener Daten
-- Verschlüsselte Speicherung von Gesundheitsdaten
-- ══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ══════════════════════════════════════════════════════════════
-- TABLE 1: PATIENT_MATERIALS (Notizen, Aufnahmen, Skizzen)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS patient_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    
    -- Material Type
    material_type VARCHAR(50) NOT NULL CHECK (material_type IN ('note', 'audio', 'video', 'sketch', 'document')),
    
    -- Encrypted Content
    title VARCHAR(255) NOT NULL,
    content_encrypted TEXT, -- Für Notizen (AES-256 encrypted)
    file_path_encrypted TEXT, -- Für Dateien (verschlüsselter Pfad)
    file_size_bytes INTEGER,
    mime_type VARCHAR(100),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- DSGVO Compliance
    encryption_key_version INTEGER DEFAULT 1,
    gdpr_consent_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    CONSTRAINT patient_materials_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES users(id)
);

CREATE INDEX idx_patient_materials_patient ON patient_materials(patient_id);
CREATE INDEX idx_patient_materials_appointment ON patient_materials(appointment_id);
CREATE INDEX idx_patient_materials_created ON patient_materials(created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- TABLE 2: QUESTIONNAIRES (Fragebogen-Templates vom Arzt)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS questionnaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Questionnaire Info
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- JSON Schema für dynamische Formular-Felder
    -- Format: [{"type": "text", "label": "Ihre Symptome", "required": true}, ...]
    schema_json JSONB NOT NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_template BOOLEAN DEFAULT false, -- Wiederverwendbare Vorlagen
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- DSGVO
    data_retention_days INTEGER DEFAULT 90, -- Automatische Löschung nach X Tagen
    
    CONSTRAINT questionnaires_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES users(id)
);

CREATE INDEX idx_questionnaires_therapist ON questionnaires(therapist_id);
CREATE INDEX idx_questionnaires_active ON questionnaires(is_active);

-- ══════════════════════════════════════════════════════════════
-- TABLE 3: QUESTIONNAIRE_ASSIGNMENTS (Arzt weist Patient Fragebogen zu)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS questionnaire_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
    
    -- Deadline
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Notification
    reminder_sent BOOLEAN DEFAULT false,
    
    CONSTRAINT questionnaire_assignments_questionnaire_id_fkey FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id),
    CONSTRAINT questionnaire_assignments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES users(id)
);

CREATE INDEX idx_questionnaire_assignments_patient ON questionnaire_assignments(patient_id);
CREATE INDEX idx_questionnaire_assignments_status ON questionnaire_assignments(status);

-- ══════════════════════════════════════════════════════════════
-- TABLE 4: QUESTIONNAIRE_RESPONSES (Antworten vom Patient - verschlüsselt)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES questionnaire_assignments(id) ON DELETE CASCADE,
    
    -- Encrypted Responses
    -- Format: {"field_1": "encrypted_answer", "field_2": "encrypted_answer", ...}
    responses_encrypted JSONB NOT NULL,
    
    -- Metadata
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- DSGVO Compliance
    encryption_key_version INTEGER DEFAULT 1,
    anonymization_applied BOOLEAN DEFAULT false,
    
    CONSTRAINT questionnaire_responses_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES questionnaire_assignments(id)
);

CREATE INDEX idx_questionnaire_responses_assignment ON questionnaire_responses(assignment_id);

-- ══════════════════════════════════════════════════════════════
-- TABLE 5: DOCUMENT_REQUESTS (Arzt fordert Scans/Dokumente an)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS document_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    
    -- Request Info
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Document Types (z.B. "Anamnese", "Labor-Befund", "MRT-Scan")
    requested_document_types TEXT[] NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'reviewed', 'rejected')),
    
    -- Response
    uploaded_material_id UUID REFERENCES patient_materials(id) ON DELETE SET NULL,
    therapist_notes_encrypted TEXT, -- Notizen des Arztes nach Review
    
    -- Deadline
    due_date TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT document_requests_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES users(id),
    CONSTRAINT document_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES users(id)
);

CREATE INDEX idx_document_requests_therapist ON document_requests(therapist_id);
CREATE INDEX idx_document_requests_patient ON document_requests(patient_id);
CREATE INDEX idx_document_requests_status ON document_requests(status);

-- ══════════════════════════════════════════════════════════════
-- AUTO-UPDATE TRIGGER FÜR updated_at
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patient_materials_updated_at
    BEFORE UPDATE ON patient_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questionnaires_updated_at
    BEFORE UPDATE ON questionnaires
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_requests_updated_at
    BEFORE UPDATE ON document_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- DSGVO-COMPLIANCE: AUTO-DELETE OLD DATA
-- ══════════════════════════════════════════════════════════════
-- Automatische Löschung alter Fragebogen-Antworten nach Ablauf der Retention Period
CREATE OR REPLACE FUNCTION cleanup_expired_questionnaire_data()
RETURNS void AS $$
BEGIN
    DELETE FROM questionnaire_responses qr
    USING questionnaire_assignments qa, questionnaires q
    WHERE qr.assignment_id = qa.id
      AND qa.questionnaire_id = q.id
      AND qr.submitted_at < CURRENT_TIMESTAMP - (q.data_retention_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════
-- SAMPLE DATA (Development Only - Comment out in Production)
-- ══════════════════════════════════════════════════════════════
-- Beispiel-Fragebogen: Anamnese
-- INSERT INTO questionnaires (therapist_id, title, description, schema_json) VALUES
-- ((SELECT id FROM users WHERE role = 'therapist' LIMIT 1),
--  'Anamnese-Fragebogen',
--  'Bitte füllen Sie diesen Fragebogen vor Ihrem ersten Termin aus',
--  '[
--    {"type": "text", "name": "chief_complaint", "label": "Hauptbeschwerde", "required": true},
--    {"type": "textarea", "name": "history", "label": "Krankengeschichte", "required": false},
--    {"type": "radio", "name": "pain_level", "label": "Schmerzlevel (1-10)", "options": ["1","2","3","4","5","6","7","8","9","10"], "required": true},
--    {"type": "checkbox", "name": "medications", "label": "Aktuelle Medikamente", "options": ["Aspirin", "Ibuprofen", "Andere"], "required": false}
--  ]'::jsonb
-- );

-- ══════════════════════════════════════════════════════════════
-- ROLLBACK (if needed)
-- ══════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS document_requests CASCADE;
-- DROP TABLE IF EXISTS questionnaire_responses CASCADE;
-- DROP TABLE IF EXISTS questionnaire_assignments CASCADE;
-- DROP TABLE IF EXISTS questionnaires CASCADE;
-- DROP TABLE IF EXISTS patient_materials CASCADE;
-- DROP FUNCTION IF EXISTS cleanup_expired_questionnaire_data();
