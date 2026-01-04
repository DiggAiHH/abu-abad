-- Migration: 010_waiting_room.sql
-- Virtuelles Wartezimmer für Videositzungen
-- Pre-Session Fragebogen und Warteschlange

-- Haupttabelle für Wartezimmer-Sitzungen
CREATE TABLE IF NOT EXISTS waiting_room (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(64) NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN (
        'waiting',
        'admitted',
        'in_session',
        'completed',
        'left',
        'cancelled'
    )),
    pre_session_data JSONB,
    pre_session_completed BOOLEAN DEFAULT false,
    therapist_ready BOOLEAN DEFAULT false,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    admitted_at TIMESTAMP,
    left_at TIMESTAMP,
    ended_at TIMESTAMP,
    session_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(appointment_id)
);

-- Tabelle für Wartezimmer-Events (Logging)
CREATE TABLE IF NOT EXISTS waiting_room_events (
    id SERIAL PRIMARY KEY,
    waiting_room_id INTEGER REFERENCES waiting_room(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_waiting_room_appointment ON waiting_room(appointment_id);
CREATE INDEX IF NOT EXISTS idx_waiting_room_patient ON waiting_room(patient_id);
CREATE INDEX IF NOT EXISTS idx_waiting_room_therapist ON waiting_room(therapist_id);
CREATE INDEX IF NOT EXISTS idx_waiting_room_status ON waiting_room(status);
CREATE INDEX IF NOT EXISTS idx_waiting_room_joined ON waiting_room(joined_at);
CREATE INDEX IF NOT EXISTS idx_waiting_room_events_wr ON waiting_room_events(waiting_room_id);

-- Kommentare
COMMENT ON TABLE waiting_room IS 'Virtuelles Wartezimmer vor Videositzungen';
COMMENT ON COLUMN waiting_room.session_token IS 'Einmaliger Token für sichere Verbindung';
COMMENT ON COLUMN waiting_room.pre_session_data IS 'Vor-Sitzungs-Fragebogen Antworten';
COMMENT ON COLUMN waiting_room.therapist_ready IS 'Therapeut hat Patient aufgerufen';
COMMENT ON TABLE waiting_room_events IS 'Audit-Log für Wartezimmer-Aktivitäten';
