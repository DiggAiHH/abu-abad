-- ══════════════════════════════════════════════════════════════
-- SCHEMA EXTENSION: Patient Pre-Session Materials & Questionnaires
-- ══════════════════════════════════════════════════════════════
-- DSGVO Art. 9 (Gesundheitsdaten), Art. 25 (Privacy by Design)
-- ══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- PATIENT PRE-SESSION MATERIALS (Patienten-Vorbereitungsmaterial)
-- =============================================================================
CREATE TABLE IF NOT EXISTS patient_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  
  -- Material-Typ: note, sketch, audio, video, document
  material_type VARCHAR(20) NOT NULL CHECK (material_type IN ('note', 'sketch', 'audio', 'video', 'document')),
  
  -- DSGVO-konform: Verschlüsselter Inhalt
  -- Notizen: Direkter verschlüsselter Text
  content_encrypted TEXT,
  
  -- Dateien: Verschlüsselte Pfad-Referenz (lokales Filesystem)
  -- SECURITY: Niemals absolute Pfade, nur Hash-basierte IDs
  file_path_encrypted TEXT,
  file_name_encrypted TEXT,
  file_size_bytes INTEGER,
  file_mime_type VARCHAR(100),
  
  -- Verschlüsselungs-Metadaten
  encryption_algorithm VARCHAR(20) DEFAULT 'AES-256-GCM',
  encryption_key_id VARCHAR(50), -- Key-ID für Key-Rotation
  
  -- Berechtigungen
  shared_with_therapist BOOLEAN DEFAULT FALSE,
  shared_at TIMESTAMP WITH TIME ZONE,
  
  -- DSGVO Art. 17: Automatische Löschung
  auto_delete_after TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Audit Trail (DSGVO Art. 30 - Verzeichnis von Verarbeitungstätigkeiten)
  accessed_by UUID REFERENCES users(id),
  accessed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_patient_materials_patient ON patient_materials(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_materials_appointment ON patient_materials(appointment_id);
CREATE INDEX IF NOT EXISTS idx_patient_materials_type ON patient_materials(material_type);

-- =============================================================================
-- QUESTIONNAIRE TEMPLATES (Fragebogen-Vorlagen von Ärzten)
-- =============================================================================
CREATE TABLE IF NOT EXISTS questionnaire_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Template-Metadaten
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- anamnese, pre-session, follow-up, diagnostic
  
  -- JSON-Schema für dynamische Formulare
  -- Format: { fields: [{ type: "text|radio|checkbox|select|textarea", label: "...", options: [...], required: boolean }] }
  form_schema JSONB NOT NULL,
  
  -- DSGVO-Anonymisierung: KI-generierte Hinweise
  -- Lokales NLP-Modell schlägt alternative Formulierungen vor (keine personenbezogenen Daten)
  ai_suggestions JSONB,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_template BOOLEAN DEFAULT TRUE, -- TRUE = wiederverwendbar, FALSE = einmalig
  
  -- Nutzungsstatistiken (anonymisiert)
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_therapist ON questionnaire_templates(therapist_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_category ON questionnaire_templates(category);
CREATE INDEX IF NOT EXISTS idx_questionnaire_active ON questionnaire_templates(is_active) WHERE is_active = TRUE;

-- =============================================================================
-- QUESTIONNAIRE REQUESTS (Arzt fordert Fragebogen von Patient an)
-- =============================================================================
CREATE TABLE IF NOT EXISTS questionnaire_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  questionnaire_template_id UUID NOT NULL REFERENCES questionnaire_templates(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Request-Details
  title VARCHAR(255) NOT NULL,
  instructions TEXT, -- Anweisungen für den Patienten
  deadline TIMESTAMP WITH TIME ZONE, -- Optional: Frist zur Beantwortung
  
  -- Status: pending, in_progress, completed, expired, cancelled
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  
  -- Priorität: low, normal, high, urgent
  priority VARCHAR(10) DEFAULT 'normal',
  
  -- Benachrichtigungen
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_requests_patient ON questionnaire_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_requests_therapist ON questionnaire_requests(therapist_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_requests_status ON questionnaire_requests(status);
CREATE INDEX IF NOT EXISTS idx_questionnaire_requests_deadline ON questionnaire_requests(deadline) WHERE deadline IS NOT NULL;

-- =============================================================================
-- QUESTIONNAIRE RESPONSES (Patienten-Antworten)
-- =============================================================================
CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES questionnaire_requests(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- DSGVO Art. 9: Verschlüsselte Gesundheitsdaten
  -- JSON-Format: { field_id: { answer: "...", type: "text|radio|...", answered_at: "ISO-8601" } }
  responses_encrypted TEXT NOT NULL,
  
  -- Verschlüsselungs-Metadaten
  encryption_algorithm VARCHAR(20) DEFAULT 'AES-256-GCM',
  encryption_key_id VARCHAR(50),
  
  -- Status: draft, submitted
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  
  -- Fortschritt (für Entwürfe)
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit Trail (DSGVO Art. 30)
  viewed_by_therapist_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_request ON questionnaire_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_patient ON questionnaire_responses(patient_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_status ON questionnaire_responses(status);

-- =============================================================================
-- DOCUMENT REQUESTS (Arzt fordert Dokumente/Scans vom Patienten an)
-- =============================================================================
CREATE TABLE IF NOT EXISTS document_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Request-Details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Dokumenten-Typ: medical_scan, lab_results, prescription, referral, insurance, other
  document_type VARCHAR(50) NOT NULL,
  
  -- Status: pending, uploaded, reviewed, rejected
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  
  -- Deadline
  deadline TIMESTAMP WITH TIME ZONE,
  
  -- Ablehnungsgrund (falls rejected)
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  uploaded_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Verknüpfung zu hochgeladenen Dateien
  uploaded_file_id UUID REFERENCES patient_materials(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_document_requests_patient ON document_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_therapist ON document_requests(therapist_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_status ON document_requests(status);

-- =============================================================================
-- TRIGGER: Auto-Update Timestamps
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für alle neuen Tabellen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_patient_materials_updated_at') THEN
        CREATE TRIGGER update_patient_materials_updated_at
                BEFORE UPDATE ON patient_materials
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_questionnaire_templates_updated_at') THEN
        CREATE TRIGGER update_questionnaire_templates_updated_at
                BEFORE UPDATE ON questionnaire_templates
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_questionnaire_responses_updated_at') THEN
        CREATE TRIGGER update_questionnaire_responses_updated_at
                BEFORE UPDATE ON questionnaire_responses
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

-- =============================================================================
-- ROW-LEVEL SECURITY (RLS) - DSGVO Art. 25 (Privacy by Design)
-- =============================================================================
-- Default: RLS ist opt-in, um bestehende App-Queries nicht unbeabsichtigt zu brechen.
-- Aktivierung z.B. pro Connection: SET app.enable_rls = 'true';
DO $$
BEGIN
    IF COALESCE(current_setting('app.enable_rls', true), 'false') = 'true' THEN
        ALTER TABLE patient_materials ENABLE ROW LEVEL SECURITY;
        ALTER TABLE questionnaire_templates ENABLE ROW LEVEL SECURITY;
        ALTER TABLE questionnaire_requests ENABLE ROW LEVEL SECURITY;
        ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;
        ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;
    END IF;
END$$;

-- Policy: Patienten sehen nur ihre eigenen Materialien
DO $$
BEGIN
    IF COALESCE(current_setting('app.enable_rls', true), 'false') <> 'true' THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patient_materials' AND policyname = 'patient_materials_patient_policy'
    ) THEN
        CREATE POLICY patient_materials_patient_policy ON patient_materials
                FOR ALL
                USING (patient_id = current_setting('app.current_user_id')::UUID);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patient_materials' AND policyname = 'patient_materials_therapist_policy'
    ) THEN
        CREATE POLICY patient_materials_therapist_policy ON patient_materials
                FOR SELECT
                USING (
                        shared_with_therapist = TRUE
                        AND appointment_id IN (
                                SELECT id FROM appointments WHERE therapist_id = current_setting('app.current_user_id')::UUID
                        )
                );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'questionnaire_templates' AND policyname = 'questionnaire_templates_policy'
    ) THEN
        CREATE POLICY questionnaire_templates_policy ON questionnaire_templates
                FOR ALL
                USING (therapist_id = current_setting('app.current_user_id')::UUID);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'questionnaire_requests' AND policyname = 'questionnaire_requests_patient_policy'
    ) THEN
        CREATE POLICY questionnaire_requests_patient_policy ON questionnaire_requests
                FOR SELECT
                USING (patient_id = current_setting('app.current_user_id')::UUID);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'questionnaire_requests' AND policyname = 'questionnaire_requests_therapist_policy'
    ) THEN
        CREATE POLICY questionnaire_requests_therapist_policy ON questionnaire_requests
                FOR ALL
                USING (therapist_id = current_setting('app.current_user_id')::UUID);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'questionnaire_responses' AND policyname = 'questionnaire_responses_patient_policy'
    ) THEN
        CREATE POLICY questionnaire_responses_patient_policy ON questionnaire_responses
                FOR ALL
                USING (patient_id = current_setting('app.current_user_id')::UUID);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'questionnaire_responses' AND policyname = 'questionnaire_responses_therapist_policy'
    ) THEN
        CREATE POLICY questionnaire_responses_therapist_policy ON questionnaire_responses
                FOR SELECT
                USING (
                        request_id IN (
                                SELECT id FROM questionnaire_requests WHERE therapist_id = current_setting('app.current_user_id')::UUID
                        )
                );
    END IF;
END$$;

-- =============================================================================
-- COMMENTS (Dokumentation für das Team)
-- =============================================================================
COMMENT ON TABLE patient_materials IS 'DSGVO Art. 9 - Verschlüsselte Gesundheitsdaten (Notizen, Skizzen, Aufnahmen)';
COMMENT ON TABLE questionnaire_templates IS 'Dynamische Fragebogen-Vorlagen mit JSON-Schema für flexible Formulare';
COMMENT ON TABLE questionnaire_requests IS 'Arzt-Anforderungen für Fragebögen (Anamnese, Pre-Session Prep)';
COMMENT ON TABLE questionnaire_responses IS 'Verschlüsselte Patienten-Antworten auf Fragebögen';
COMMENT ON TABLE document_requests IS 'Arzt-Anforderungen für Dokumente/Scans (Laborbefunde, Überweisungen)';

COMMENT ON COLUMN patient_materials.content_encrypted IS 'AES-256-GCM verschlüsselter Inhalt (Notizen)';
COMMENT ON COLUMN patient_materials.file_path_encrypted IS 'Verschlüsselter Dateipfad (Hash-basiert, kein absolute path)';
COMMENT ON COLUMN questionnaire_templates.form_schema IS 'JSON-Schema: {fields: [{type, label, options, required, validation}]}';
COMMENT ON COLUMN questionnaire_responses.responses_encrypted IS 'Verschlüsselte Antworten als JSON: {field_id: {answer, type, answered_at}}';
