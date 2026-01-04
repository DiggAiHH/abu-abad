-- Migration: Termin-Erinnerungen System
-- Datum: 2025-12-30

-- Tabelle für Erinnerungs-Einstellungen
CREATE TABLE IF NOT EXISTS reminder_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    push_enabled BOOLEAN DEFAULT true,
    reminder_times JSONB DEFAULT '[1440, 60, 15]', -- Minuten vor Termin
    daily_summary_enabled BOOLEAN DEFAULT false,
    daily_summary_time TIME DEFAULT '08:00',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle für geplante Erinnerungen
CREATE TABLE IF NOT EXISTS scheduled_reminders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'sms', 'push')),
    scheduled_for TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'sent', 'failed', 'cancelled')
    ),
    message TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, appointment_id, type, scheduled_for)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reminder_preferences_user ON reminder_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_user ON scheduled_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_pending ON scheduled_reminders(status, scheduled_for) 
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_appointment ON scheduled_reminders(appointment_id);

-- Kommentare
COMMENT ON TABLE reminder_preferences IS 'Benutzer-Einstellungen für Termin-Erinnerungen';
COMMENT ON TABLE scheduled_reminders IS 'Geplante und gesendete Erinnerungen';
COMMENT ON COLUMN reminder_preferences.reminder_times IS 'Array von Minuten vor dem Termin als JSON';
COMMENT ON COLUMN scheduled_reminders.type IS 'Art der Erinnerung: email, sms, push';
