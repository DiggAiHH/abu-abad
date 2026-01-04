const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { pool } = require('../utils/db');
const { authenticateToken, requirePatient, requireTherapist } = require('../middleware/auth');

// ===== VALIDATION SCHEMAS =====

const MoodEntrySchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Ungültiges Datumsformat',
  }),
  moodScore: z.number().min(1).max(10),
  anxietyLevel: z.number().min(0).max(10).optional(),
  sleepQuality: z.number().min(1).max(5).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  energyLevel: z.number().min(1).max(10).optional(),
  stressLevel: z.number().min(0).max(10).optional(),
  symptoms: z.array(z.string()).optional(),
  triggers: z.array(z.string()).optional(),
  activities: z.array(z.string()).optional(),
  medications: z.array(z.object({
    name: z.string(),
    dosage: z.string().optional(),
    taken: z.boolean(),
  })).optional(),
  notes: z.string().max(2000).optional(),
});

// ===== PATIENT ENDPOINTS =====

/**
 * POST /api/symptom-diary
 * Erstellt einen neuen Tagebucheintrag
 */
router.post('/', authenticateToken, requirePatient, async (req, res) => {
  try {
    const validated = MoodEntrySchema.parse(req.body);
    const patientId = req.user.id;

    // Prüfen ob für dieses Datum bereits ein Eintrag existiert
    const existingEntry = await pool.query(
      `SELECT id FROM symptom_diary WHERE patient_id = $1 AND DATE(entry_date) = DATE($2)`,
      [patientId, validated.date]
    );

    if (existingEntry.rows.length > 0) {
      return res.status(409).json({
        error: 'Für dieses Datum existiert bereits ein Eintrag',
        existingId: existingEntry.rows[0].id,
      });
    }

    const result = await pool.query(
      `INSERT INTO symptom_diary (
        patient_id, entry_date, mood_score, anxiety_level,
        sleep_quality, sleep_hours, energy_level, stress_level,
        symptoms, triggers, activities, medications, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        patientId,
        validated.date,
        validated.moodScore,
        validated.anxietyLevel || null,
        validated.sleepQuality || null,
        validated.sleepHours || null,
        validated.energyLevel || null,
        validated.stressLevel || null,
        JSON.stringify(validated.symptoms || []),
        JSON.stringify(validated.triggers || []),
        JSON.stringify(validated.activities || []),
        JSON.stringify(validated.medications || []),
        validated.notes || null,
      ]
    );

    res.status(201).json({
      message: 'Tagebucheintrag erstellt',
      entry: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    }
    console.error('Fehler beim Erstellen des Eintrags:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/symptom-diary
 * Holt alle Einträge des Patienten (mit optionaler Datumsfilterung)
 */
router.get('/', authenticateToken, requirePatient, async (req, res) => {
  try {
    const patientId = req.user.id;
    const { startDate, endDate, limit = 30 } = req.query;

    let query = `
      SELECT * FROM symptom_diary 
      WHERE patient_id = $1
    `;
    const params = [patientId];
    let paramCount = 1;

    if (startDate) {
      paramCount++;
      query += ` AND entry_date >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND entry_date <= $${paramCount}`;
      params.push(endDate);
    }

    query += ` ORDER BY entry_date DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit, 10));

    const result = await pool.query(query, params);

    // Parse JSON fields
    const entries = result.rows.map((row) => ({
      ...row,
      symptoms: JSON.parse(row.symptoms || '[]'),
      triggers: JSON.parse(row.triggers || '[]'),
      activities: JSON.parse(row.activities || '[]'),
      medications: JSON.parse(row.medications || '[]'),
    }));

    res.json(entries);
  } catch (error) {
    console.error('Fehler beim Laden der Einträge:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * PUT /api/symptom-diary/:id
 * Aktualisiert einen bestehenden Eintrag
 */
router.put('/:id', authenticateToken, requirePatient, async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.user.id;
    const validated = MoodEntrySchema.partial().parse(req.body);

    // Prüfen ob Eintrag dem Patienten gehört
    const existing = await pool.query(
      `SELECT id FROM symptom_diary WHERE id = $1 AND patient_id = $2`,
      [id, patientId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 0;

    const fieldMapping = {
      moodScore: 'mood_score',
      anxietyLevel: 'anxiety_level',
      sleepQuality: 'sleep_quality',
      sleepHours: 'sleep_hours',
      energyLevel: 'energy_level',
      stressLevel: 'stress_level',
      symptoms: 'symptoms',
      triggers: 'triggers',
      activities: 'activities',
      medications: 'medications',
      notes: 'notes',
    };

    for (const [key, dbField] of Object.entries(fieldMapping)) {
      if (validated[key] !== undefined) {
        paramCount++;
        updateFields.push(`${dbField} = $${paramCount}`);
        if (['symptoms', 'triggers', 'activities', 'medications'].includes(key)) {
          values.push(JSON.stringify(validated[key]));
        } else {
          values.push(validated[key]);
        }
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Keine Felder zum Aktualisieren' });
    }

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    paramCount++;
    values.push(id);

    const result = await pool.query(
      `UPDATE symptom_diary SET ${updateFields.join(', ')} 
       WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({
      message: 'Eintrag aktualisiert',
      entry: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    }
    console.error('Fehler beim Aktualisieren:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * DELETE /api/symptom-diary/:id
 * Löscht einen Eintrag
 */
router.delete('/:id', authenticateToken, requirePatient, async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.user.id;

    const result = await pool.query(
      `DELETE FROM symptom_diary WHERE id = $1 AND patient_id = $2 RETURNING id`,
      [id, patientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    }

    res.json({ message: 'Eintrag gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/symptom-diary/stats
 * Gibt Statistiken über die Einträge zurück
 */
router.get('/stats', authenticateToken, requirePatient, async (req, res) => {
  try {
    const patientId = req.user.id;
    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT 
        AVG(mood_score) as avg_mood,
        AVG(anxiety_level) as avg_anxiety,
        AVG(sleep_quality) as avg_sleep_quality,
        AVG(sleep_hours) as avg_sleep_hours,
        AVG(energy_level) as avg_energy,
        AVG(stress_level) as avg_stress,
        COUNT(*) as total_entries,
        MIN(entry_date) as first_entry,
        MAX(entry_date) as last_entry
      FROM symptom_diary 
      WHERE patient_id = $1 
        AND entry_date >= NOW() - INTERVAL '${parseInt(days, 10)} days'`,
      [patientId]
    );

    // Trend-Berechnung (letzte 7 Tage vs. vorherige 7 Tage)
    const trendResult = await pool.query(
      `SELECT 
        AVG(CASE WHEN entry_date >= NOW() - INTERVAL '7 days' THEN mood_score END) as recent_mood,
        AVG(CASE WHEN entry_date < NOW() - INTERVAL '7 days' AND entry_date >= NOW() - INTERVAL '14 days' THEN mood_score END) as previous_mood
      FROM symptom_diary 
      WHERE patient_id = $1`,
      [patientId]
    );

    const stats = result.rows[0];
    const trend = trendResult.rows[0];

    let moodTrend = 'stable';
    if (trend.recent_mood && trend.previous_mood) {
      const diff = parseFloat(trend.recent_mood) - parseFloat(trend.previous_mood);
      if (diff > 0.5) moodTrend = 'improving';
      else if (diff < -0.5) moodTrend = 'declining';
    }

    res.json({
      averages: {
        mood: parseFloat(stats.avg_mood) || null,
        anxiety: parseFloat(stats.avg_anxiety) || null,
        sleepQuality: parseFloat(stats.avg_sleep_quality) || null,
        sleepHours: parseFloat(stats.avg_sleep_hours) || null,
        energy: parseFloat(stats.avg_energy) || null,
        stress: parseFloat(stats.avg_stress) || null,
      },
      totalEntries: parseInt(stats.total_entries, 10),
      dateRange: {
        first: stats.first_entry,
        last: stats.last_entry,
      },
      moodTrend,
    });
  } catch (error) {
    console.error('Fehler beim Laden der Statistiken:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ===== THERAPIST ENDPOINTS =====

/**
 * GET /api/symptom-diary/patient/:patientId
 * Therapeut kann Einträge eines Patienten einsehen
 */
router.get('/patient/:patientId', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { startDate, endDate, limit = 60 } = req.query;

    // Prüfen ob eine Behandlungsbeziehung besteht
    const relationship = await pool.query(
      `SELECT id FROM appointments 
       WHERE therapist_id = $1 AND patient_id = $2 
       AND status IN ('booked', 'completed')
       LIMIT 1`,
      [req.user.id, patientId]
    );

    if (relationship.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Keine Behandlungsbeziehung zu diesem Patienten' 
      });
    }

    let query = `
      SELECT sd.*, u.first_name, u.last_name 
      FROM symptom_diary sd
      JOIN users u ON sd.patient_id = u.id
      WHERE sd.patient_id = $1
    `;
    const params = [patientId];
    let paramCount = 1;

    if (startDate) {
      paramCount++;
      query += ` AND sd.entry_date >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND sd.entry_date <= $${paramCount}`;
      params.push(endDate);
    }

    query += ` ORDER BY sd.entry_date DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit, 10));

    const result = await pool.query(query, params);

    const entries = result.rows.map((row) => ({
      ...row,
      symptoms: JSON.parse(row.symptoms || '[]'),
      triggers: JSON.parse(row.triggers || '[]'),
      activities: JSON.parse(row.activities || '[]'),
      medications: JSON.parse(row.medications || '[]'),
    }));

    res.json(entries);
  } catch (error) {
    console.error('Fehler beim Laden der Patienteneinträge:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
