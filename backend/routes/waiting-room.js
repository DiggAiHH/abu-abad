const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { z } = require('zod');
const crypto = require('crypto');

// ===== VALIDATION SCHEMAS =====
const waitingRoomSchema = z.object({
  appointmentId: z.number().positive(),
});

const preSessionSchema = z.object({
  currentMood: z.number().min(1).max(10),
  anxietyLevel: z.number().min(0).max(10).optional(),
  sleepQuality: z.number().min(1).max(5).optional(),
  mainConcerns: z.string().max(2000).optional(),
  questionsForTherapist: z.string().max(2000).optional(),
  medicationTaken: z.boolean().optional(),
  significantEvents: z.string().max(2000).optional(),
});

// ===== MOOD DESCRIPTIONS (German) =====
const MOOD_LABELS = {
  1: 'Sehr schlecht',
  2: 'Schlecht',
  3: 'Eher schlecht',
  4: 'Unterdurchschnittlich',
  5: 'Neutral',
  6: 'Etwas besser',
  7: 'Gut',
  8: 'Sehr gut',
  9: 'Ausgezeichnet',
  10: 'Hervorragend',
};

const SLEEP_LABELS = {
  1: 'Sehr schlecht geschlafen',
  2: 'Schlecht geschlafen',
  3: 'Durchschnittlich',
  4: 'Gut geschlafen',
  5: 'Sehr gut geschlafen',
};

// ===== ROUTES =====

// POST /api/waiting-room/join - Patient betritt Wartezimmer
router.post('/join', authenticateToken, authorizeRole('patient'), async (req, res) => {
  try {
    const data = waitingRoomSchema.parse(req.body);
    
    // Termin validieren
    const apptResult = await db.query(
      `SELECT a.*, t.name as therapist_name
       FROM appointments a
       JOIN users t ON a.therapist_id = t.id
       WHERE a.id = $1 AND a.patient_id = $2 AND a.status IN ('confirmed', 'scheduled')`,
      [data.appointmentId, req.user.id]
    );
    
    if (apptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden oder nicht autorisiert' });
    }
    
    const appointment = apptResult.rows[0];
    
    // Prüfen ob Termin bald startet (max 30 Min vorher)
    const appointmentTime = new Date(appointment.start_time);
    const now = new Date();
    const minutesUntilStart = (appointmentTime - now) / 60000;
    
    if (minutesUntilStart > 30) {
      return res.status(400).json({ 
        error: 'Sie können frühestens 30 Minuten vor Beginn eintreten',
        minutesUntilStart: Math.floor(minutesUntilStart),
      });
    }
    
    // Session-Token generieren
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Wartezimmer-Eintrag erstellen/aktualisieren
    await db.query(
      `INSERT INTO waiting_room 
       (appointment_id, patient_id, therapist_id, session_token, status, joined_at)
       VALUES ($1, $2, $3, $4, 'waiting', NOW())
       ON CONFLICT (appointment_id) DO UPDATE SET
         session_token = $4,
         status = 'waiting',
         joined_at = NOW(),
         left_at = NULL`,
      [data.appointmentId, req.user.id, appointment.therapist_id, sessionToken]
    );
    
    res.json({
      success: true,
      sessionToken,
      appointment: {
        id: appointment.id,
        startTime: appointment.start_time,
        therapistName: appointment.therapist_name,
        roomId: appointment.room_id,
      },
      moodLabels: MOOD_LABELS,
      sleepLabels: SLEEP_LABELS,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Ungültige Daten', details: error.errors });
    }
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/waiting-room/pre-session - Vor-Sitzungs-Fragebogen
router.post('/pre-session', authenticateToken, authorizeRole('patient'), async (req, res) => {
  try {
    const { appointmentId, ...responses } = req.body;
    const data = preSessionSchema.parse(responses);
    
    // Wartezimmer-Eintrag finden
    const waitingResult = await db.query(
      `SELECT * FROM waiting_room 
       WHERE appointment_id = $1 AND patient_id = $2 AND status = 'waiting'`,
      [appointmentId, req.user.id]
    );
    
    if (waitingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wartezimmer-Sitzung nicht gefunden' });
    }
    
    // Fragebogen speichern
    await db.query(
      `UPDATE waiting_room SET
         pre_session_data = $1,
         pre_session_completed = true,
         updated_at = NOW()
       WHERE appointment_id = $2 AND patient_id = $3`,
      [JSON.stringify(data), appointmentId, req.user.id]
    );
    
    res.json({ success: true, message: 'Fragebogen gespeichert' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Ungültige Daten', details: error.errors });
    }
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/waiting-room/status - Status der Wartezimmer-Sitzung
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { appointmentId } = req.query;
    
    const result = await db.query(
      `SELECT w.*, a.start_time, a.room_id,
              CASE WHEN w.patient_id = $2 THEN true ELSE false END as is_patient
       FROM waiting_room w
       JOIN appointments a ON w.appointment_id = a.id
       WHERE w.appointment_id = $1
         AND (w.patient_id = $2 OR w.therapist_id = $2)`,
      [appointmentId, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sitzung nicht gefunden' });
    }
    
    const session = result.rows[0];
    
    res.json({
      appointmentId: session.appointment_id,
      status: session.status,
      joinedAt: session.joined_at,
      therapistReady: session.therapist_ready,
      preSessionCompleted: session.pre_session_completed,
      startTime: session.start_time,
      roomId: session.room_id,
      isPatient: session.is_patient,
      preSessionData: session.is_patient ? null : session.pre_session_data,
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/waiting-room/queue - Warteschlange für Therapeuten
router.get('/queue', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT w.*, a.start_time, p.name as patient_name
       FROM waiting_room w
       JOIN appointments a ON w.appointment_id = a.id
       JOIN users p ON w.patient_id = p.id
       WHERE w.therapist_id = $1 AND w.status = 'waiting'
       ORDER BY a.start_time ASC`,
      [req.user.id]
    );
    
    res.json({
      queue: result.rows.map(r => ({
        appointmentId: r.appointment_id,
        patientName: r.patient_name,
        startTime: r.start_time,
        joinedAt: r.joined_at,
        preSessionCompleted: r.pre_session_completed,
        preSessionData: r.pre_session_data,
        waitingMinutes: Math.floor((new Date() - new Date(r.joined_at)) / 60000),
      })),
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/waiting-room/admit - Patient in Sitzung aufnehmen
router.post('/admit', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { appointmentId } = req.body;
    
    // Wartezimmer-Status aktualisieren
    const result = await db.query(
      `UPDATE waiting_room SET
         status = 'admitted',
         therapist_ready = true,
         admitted_at = NOW(),
         updated_at = NOW()
       WHERE appointment_id = $1 AND therapist_id = $2 AND status = 'waiting'
       RETURNING *`,
      [appointmentId, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wartender Patient nicht gefunden' });
    }
    
    // Termin auf 'in_progress' setzen
    await db.query(
      `UPDATE appointments SET status = 'in_progress' WHERE id = $1`,
      [appointmentId]
    );
    
    res.json({ 
      success: true, 
      message: 'Patient aufgenommen',
      roomId: result.rows[0].session_token, // Als Room-ID verwenden
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/waiting-room/leave - Wartezimmer verlassen
router.post('/leave', authenticateToken, async (req, res) => {
  try {
    const { appointmentId } = req.body;
    
    await db.query(
      `UPDATE waiting_room SET
         status = 'left',
         left_at = NOW(),
         updated_at = NOW()
       WHERE appointment_id = $1 AND (patient_id = $2 OR therapist_id = $2)`,
      [appointmentId, req.user.id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/waiting-room/end-session - Sitzung beenden
router.post('/end-session', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { appointmentId, notes } = req.body;
    
    // Wartezimmer-Sitzung als beendet markieren
    await db.query(
      `UPDATE waiting_room SET
         status = 'completed',
         session_notes = $1,
         ended_at = NOW(),
         updated_at = NOW()
       WHERE appointment_id = $2 AND therapist_id = $3`,
      [notes || null, appointmentId, req.user.id]
    );
    
    // Termin als abgeschlossen markieren
    await db.query(
      `UPDATE appointments SET status = 'completed' WHERE id = $1`,
      [appointmentId]
    );
    
    res.json({ success: true, message: 'Sitzung beendet' });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/waiting-room/pre-session/:appointmentId - Pre-Session Daten für Therapeut
router.get('/pre-session/:appointmentId', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    const result = await db.query(
      `SELECT w.pre_session_data, w.joined_at, p.name as patient_name
       FROM waiting_room w
       JOIN users p ON w.patient_id = p.id
       WHERE w.appointment_id = $1 AND w.therapist_id = $2`,
      [appointmentId, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Daten nicht gefunden' });
    }
    
    const row = result.rows[0];
    const preSessionData = typeof row.pre_session_data === 'string' 
      ? JSON.parse(row.pre_session_data) 
      : row.pre_session_data;
    
    res.json({
      patientName: row.patient_name,
      joinedAt: row.joined_at,
      data: preSessionData ? {
        currentMood: preSessionData.currentMood,
        moodLabel: MOOD_LABELS[preSessionData.currentMood],
        anxietyLevel: preSessionData.anxietyLevel,
        sleepQuality: preSessionData.sleepQuality,
        sleepLabel: SLEEP_LABELS[preSessionData.sleepQuality],
        mainConcerns: preSessionData.mainConcerns,
        questionsForTherapist: preSessionData.questionsForTherapist,
        medicationTaken: preSessionData.medicationTaken,
        significantEvents: preSessionData.significantEvents,
      } : null,
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
