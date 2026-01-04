-- Migration: 011_billing.sql
-- Abrechnungssystem für Therapeuten (GOÄ/EBM)

-- Tabelle für Rechnungseinstellungen (Therapeut)
CREATE TABLE IF NOT EXISTS billing_settings (
    id SERIAL PRIMARY KEY,
    therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    practice_name VARCHAR(200),
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    zip_code VARCHAR(20),
    city VARCHAR(100),
    tax_id VARCHAR(50),
    bank_name VARCHAR(100),
    iban VARCHAR(50),
    bic VARCHAR(20),
    invoice_footer TEXT,
    next_invoice_number INTEGER DEFAULT 1000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(therapist_id)
);

-- Tabelle für Rechnungen
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    due_date DATE NOT NULL,
    items JSONB DEFAULT '[]', -- Array of { description, code, factor, price }
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    notes TEXT,
    generated_html TEXT,
    sent_at TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(therapist_id, invoice_number)
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_invoices_therapist ON invoices(therapist_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);

-- Kommentare
COMMENT ON TABLE billing_settings IS 'Rechnungseinstellungen und Stammdaten des Therapeuten';
COMMENT ON TABLE invoices IS 'Rechnungen an Patienten';
COMMENT ON COLUMN invoices.items IS 'Rechnungspositionen (Leistungen)';
