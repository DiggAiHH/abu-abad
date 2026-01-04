-- Migration: 009_treatment_reports.sql
-- Behandlungsberichte für Therapeuten
-- ISO 13485 konform mit Audit-Trail

-- Tabelle für Behandlungsberichte
CREATE TABLE IF NOT EXISTS treatment_reports (
    id SERIAL PRIMARY KEY,
    therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
        'treatment_summary',
        'progress_report',
        'referral_letter',
        'discharge_report',
        'medical_certificate',
        'insurance_report'
    )),
    title VARCHAR(200) NOT NULL,
    date_from DATE,
    date_to DATE,
    content JSONB DEFAULT '{}',
    recipient_info JSONB DEFAULT '{}',
    generated_html TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'finalized', 'sent')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle für Berichts-Versionen (Audit-Trail)
CREATE TABLE IF NOT EXISTS report_versions (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES treatment_reports(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    generated_html TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Tabelle für geteilte Berichte
CREATE TABLE IF NOT EXISTS report_shares (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES treatment_reports(id) ON DELETE CASCADE,
    share_token VARCHAR(64) UNIQUE NOT NULL,
    recipient_email VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    accessed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_treatment_reports_therapist ON treatment_reports(therapist_id);
CREATE INDEX IF NOT EXISTS idx_treatment_reports_patient ON treatment_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_reports_type ON treatment_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_treatment_reports_status ON treatment_reports(status);
CREATE INDEX IF NOT EXISTS idx_report_versions_report ON report_versions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_shares_token ON report_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_report_shares_expires ON report_shares(expires_at);

-- Kommentare
COMMENT ON TABLE treatment_reports IS 'Behandlungsberichte und ärztliche Dokumente';
COMMENT ON COLUMN treatment_reports.report_type IS 'Art des Berichts';
COMMENT ON COLUMN treatment_reports.content IS 'Konfiguration der Berichtsinhalte';
COMMENT ON COLUMN treatment_reports.recipient_info IS 'Empfängerinformationen';
COMMENT ON COLUMN treatment_reports.generated_html IS 'Generiertes HTML für PDF-Export';
COMMENT ON TABLE report_versions IS 'Versionierung für Audit-Trail';
COMMENT ON TABLE report_shares IS 'Sichere Links zum Teilen von Berichten';
