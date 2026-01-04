const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { z } = require('zod');

// ===== VALIDATION SCHEMAS =====
const reminderPreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  reminderTimes: z.array(z.number().min(0).max(10080)).optional(), // Minutes before appointment
  dailySummaryEnabled: z.boolean().optional(),
  dailySummaryTime: z.string().optional(), // "08:00"
});

const reminderSchema = z.object({
  appointmentId: z.number().positive(),
  type: z.enum(['email', 'sms', 'push']),
  scheduledFor: z.string(), // ISO timestamp
  message: z.string().max(500).optional(),
});

// ===== DEFAULT REMINDER TIMES =====
const DEFAULT_REMINDER_TIMES = [
  { minutes: 1440, label: '1 Tag vorher' },
  { minutes: 60, label: '1 Stunde vorher' },
  { minutes: 15, label: '15 Minuten vorher' },
];

// ===== ROUTES =====

// GET /api/reminders/preferences - Erinnerungs-Einstellungen abrufen
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM reminder_preferences WHERE user_id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      // Standard-Einstellungen zurückgeben
      return res.json({
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        reminderTimes: [1440, 60, 15], // 1 Tag, 1 Stunde, 15 Min vorher
        dailySummaryEnabled: false,
        dailySummaryTime: '08:00',
      });
    }
    
    const row = result.rows[0];
    res.json({
      emailEnabled: row.email_enabled,
      smsEnabled: row.sms_enabled,
      pushEnabled: row.push_enabled,
      reminderTimes: row.reminder_times || [1440, 60, 15],
      dailySummaryEnabled: row.daily_summary_enabled,
      dailySummaryTime: row.daily_summary_time,
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Einstellungen:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// PUT /api/reminders/preferences - Erinnerungs-Einstellungen aktualisieren
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const data = reminderPreferencesSchema.parse(req.body);
    
    await db.query(
      `INSERT INTO reminder_preferences 
       (user_id, email_enabled, sms_enabled, push_enabled, reminder_times, 
        daily_summary_enabled, daily_summary_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         email_enabled = EXCLUDED.email_enabled,
         sms_enabled = EXCLUDED.sms_enabled,
         push_enabled = EXCLUDED.push_enabled,
         reminder_times = EXCLUDED.reminder_times,
         daily_summary_enabled = EXCLUDED.daily_summary_enabled,
         daily_summary_time = EXCLUDED.daily_summary_time,
         updated_at = NOW()`,
      [
        req.user.id,
        data.emailEnabled ?? true,
        data.smsEnabled ?? false,
        data.pushEnabled ?? true,
        JSON.stringify(data.reminderTimes || [1440, 60, 15]),
        data.dailySummaryEnabled ?? false,
        data.dailySummaryTime || '08:00',
      ]
    );
    
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Ungültige Daten', details: error.errors });
    }
    console.error('Fehler beim Speichern:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/reminders/upcoming - Anstehende Erinnerungen
router.get('/upcoming', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, a.start_time, a.end_time, a.notes as appointment_notes,
              u.name as other_party_name
       FROM scheduled_reminders r
       JOIN appointments a ON r.appointment_id = a.id
       LEFT JOIN users u ON (
         CASE WHEN a.patient_id = $1 THEN a.therapist_id ELSE a.patient_id END = u.id
       )
       WHERE r.user_id = $1 
         AND r.status = 'pending'
         AND r.scheduled_for > NOW()
       ORDER BY r.scheduled_for ASC
       LIMIT 20`,
      [req.user.id]
    );
    
    res.json(result.rows.map(row => ({
      id: row.id,
      appointmentId: row.appointment_id,
      type: row.type,
      scheduledFor: row.scheduled_for,
      message: row.message,
      status: row.status,
      appointmentTime: row.start_time,
      otherPartyName: row.other_party_name,
    })));
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/reminders/history - Gesendete Erinnerungen
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await db.query(
      `SELECT r.*, a.start_time
       FROM scheduled_reminders r
       JOIN appointments a ON r.appointment_id = a.id
       WHERE r.user_id = $1 
         AND r.status IN ('sent', 'failed')
         AND r.sent_at >= NOW() - INTERVAL '${parseInt(days)} days'
       ORDER BY r.sent_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    
    res.json(result.rows.map(row => ({
      id: row.id,
      appointmentId: row.appointment_id,
      type: row.type,
      scheduledFor: row.scheduled_for,
      sentAt: row.sent_at,
      status: row.status,
      message: row.message,
      appointmentTime: row.start_time,
    })));
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/reminders/schedule - Erinnerung manuell planen
router.post('/schedule', authenticateToken, async (req, res) => {
  try {
    const data = reminderSchema.parse(req.body);
    
    // Prüfen ob Termin dem User gehört
    const appointmentCheck = await db.query(
      'SELECT id FROM appointments WHERE id = $1 AND (patient_id = $2 OR therapist_id = $2)',
      [data.appointmentId, req.user.id]
    );
    
    if (appointmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden' });
    }
    
    const result = await db.query(
      `INSERT INTO scheduled_reminders 
       (user_id, appointment_id, type, scheduled_for, message, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [
        req.user.id,
        data.appointmentId,
        data.type,
        data.scheduledFor,
        data.message || null,
      ]
    );
    
    res.status(201).json({
      id: result.rows[0].id,
      scheduled: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Ungültige Daten', details: error.errors });
    }
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// DELETE /api/reminders/:id - Erinnerung stornieren
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `UPDATE scheduled_reminders 
       SET status = 'cancelled'
       WHERE id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING id`,
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Erinnerung nicht gefunden oder bereits gesendet' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/reminders/auto-schedule/:appointmentId - Automatische Erinnerungen erstellen
router.post('/auto-schedule/:appointmentId', authenticateToken, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    // Termin holen
    const appointmentResult = await db.query(
      'SELECT id, start_time FROM appointments WHERE id = $1 AND (patient_id = $2 OR therapist_id = $2)',
      [appointmentId, req.user.id]
    );
    
    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden' });
    }
    
    const appointment = appointmentResult.rows[0];
    const appointmentTime = new Date(appointment.start_time);
    
    // Benutzer-Einstellungen holen
    const prefsResult = await db.query(
      'SELECT * FROM reminder_preferences WHERE user_id = $1',
      [req.user.id]
    );
    
    const prefs = prefsResult.rows[0] || {
      email_enabled: true,
      push_enabled: true,
      reminder_times: [1440, 60, 15],
    };
    
    const reminderTimes = typeof prefs.reminder_times === 'string' 
      ? JSON.parse(prefs.reminder_times) 
      : prefs.reminder_times || [1440, 60, 15];
    
    // Erinnerungen erstellen
    const reminders = [];
    
    for (const minutesBefore of reminderTimes) {
      const scheduledFor = new Date(appointmentTime.getTime() - minutesBefore * 60000);
      
      // Nur zukünftige Erinnerungen
      if (scheduledFor > new Date()) {
        if (prefs.email_enabled) {
          reminders.push({
            type: 'email',
            scheduledFor,
          });
        }
        if (prefs.push_enabled) {
          reminders.push({
            type: 'push',
            scheduledFor,
          });
        }
      }
    }
    
    // In DB einfügen
    for (const reminder of reminders) {
      await db.query(
        `INSERT INTO scheduled_reminders 
         (user_id, appointment_id, type, scheduled_for, status)
         VALUES ($1, $2, $3, $4, 'pending')
         ON CONFLICT DO NOTHING`,
        [req.user.id, appointmentId, reminder.type, reminder.scheduledFor]
      );
    }
    
    res.json({
      scheduled: reminders.length,
      message: `${reminders.length} Erinnerungen geplant`,
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/reminders/available-times - Verfügbare Erinnerungszeiten
router.get('/available-times', authenticateToken, (req, res) => {
  res.json({
    times: [
      { minutes: 10080, label: '1 Woche vorher' },
      { minutes: 4320, label: '3 Tage vorher' },
      { minutes: 1440, label: '1 Tag vorher' },
      { minutes: 720, label: '12 Stunden vorher' },
      { minutes: 120, label: '2 Stunden vorher' },
      { minutes: 60, label: '1 Stunde vorher' },
      { minutes: 30, label: '30 Minuten vorher' },
      { minutes: 15, label: '15 Minuten vorher' },
      { minutes: 5, label: '5 Minuten vorher' },
    ],
    defaults: DEFAULT_REMINDER_TIMES,
  });
});

// ===== WORKER ENDPOINT (für Cron-Jobs) =====
// Diese Endpunkte würden normalerweise von einem Worker-Prozess aufgerufen

// POST /api/reminders/process - Fällige Erinnerungen verarbeiten (Internal/Worker)
router.post('/process', async (req, res) => {
  // Normalerweise durch API-Key geschützt
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.WORKER_API_KEY && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // Fällige Erinnerungen abrufen
    const result = await db.query(
      `SELECT r.*, u.email, u.name as user_name, a.start_time, a.notes as appointment_notes,
              t.name as therapist_name, p.name as patient_name
       FROM scheduled_reminders r
       JOIN users u ON r.user_id = u.id
       JOIN appointments a ON r.appointment_id = a.id
       JOIN users t ON a.therapist_id = t.id
       JOIN users p ON a.patient_id = p.id
       WHERE r.status = 'pending'
         AND r.scheduled_for <= NOW()
       LIMIT 100`
    );
    
    const processed = [];
    const failed = [];
    
    for (const reminder of result.rows) {
      try {
        // Hier würde die tatsächliche Versendung stattfinden
        // Email: nodemailer, SendGrid, etc.
        // SMS: Twilio, MessageBird, etc.
        // Push: Firebase, OneSignal, etc.
        
        // Für Demo: Nur Status aktualisieren
        await db.query(
          `UPDATE scheduled_reminders 
           SET status = 'sent', sent_at = NOW()
           WHERE id = $1`,
          [reminder.id]
        );
        
        processed.push(reminder.id);
        
        console.log(`[REMINDER] Sent ${reminder.type} to ${reminder.email} for appointment at ${reminder.start_time}`);
      } catch (sendError) {
        await db.query(
          `UPDATE scheduled_reminders 
           SET status = 'failed', error_message = $1
           WHERE id = $2`,
          [sendError.message, reminder.id]
        );
        failed.push(reminder.id);
      }
    }
    
    res.json({
      processed: processed.length,
      failed: failed.length,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Fehler beim Verarbeiten:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
