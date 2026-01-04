const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { pool } = require('../utils/db');
const { authenticateToken, requireTherapist } = require('../middleware/auth');
const crypto = require('crypto');

// ===== ENCRYPTION HELPERS =====
const ENCRYPTION_KEY = process.env.NOTES_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text) return null;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

// ===== VALIDATION SCHEMAS =====

const TherapyNoteSchema = z.object({
  appointmentId: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  sessionDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Ungültiges Datumsformat',
  }),
  sessionNumber: z.number().int().positive().optional(),
  sessionDuration: z.number().min(5).max(180).optional(), // Minuten
  
  // SOAP Format
  subjective: z.string().max(5000).optional(), // Patientenbericht
  objective: z.string().max(5000).optional(),  // Beobachtungen
  assessment: z.string().max(5000).optional(), // Einschätzung/Diagnose
  plan: z.string().max(5000).optional(),       // Weiteres Vorgehen
  
  // Additional Clinical Fields
  diagnosis: z.array(z.string()).optional(),
  interventions: z.array(z.string()).optional(),
  homework: z.string().max(2000).optional(),
  riskAssessment: z.enum(['none', 'low', 'moderate', 'high', 'acute']).optional(),
  suicidalIdeation: z.boolean().optional(),
  mentalStatus: z.object({
    appearance: z.string().optional(),
    behavior: z.string().optional(),
    speech: z.string().optional(),
    mood: z.string().optional(),
    affect: z.string().optional(),
    thought: z.string().optional(),
    perception: z.string().optional(),
    cognition: z.string().optional(),
    insight: z.string().optional(),
    judgment: z.string().optional(),
  }).optional(),
  
  // Progress
  progressRating: z.number().min(1).max(5).optional(),
  goalsAddressed: z.array(z.string()).optional(),
  
  // Next Session
  nextSessionPlanned: z.string().optional(),
  followUpRequired: z.boolean().optional(),
});

// ===== ROUTES =====

/**
 * POST /api/therapy-notes
 * Erstellt eine neue Therapienotiz (Therapeut only)
 */
router.post('/', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const validated = TherapyNoteSchema.parse(req.body);
    const therapistId = req.user.id;

    // Prüfen ob Patient existiert und Behandlungsbeziehung besteht
    const relationCheck = await pool.query(
      `SELECT id FROM appointments 
       WHERE therapist_id = $1 AND patient_id = $2 
       AND status IN ('booked', 'completed') LIMIT 1`,
      [therapistId, validated.patientId]
    );

    if (relationCheck.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Keine Behandlungsbeziehung zu diesem Patienten' 
      });
    }

    // Sensitive Felder verschlüsseln
    const encryptedSubjective = encrypt(validated.subjective);
    const encryptedObjective = encrypt(validated.objective);
    const encryptedAssessment = encrypt(validated.assessment);
    const encryptedPlan = encrypt(validated.plan);

    const result = await pool.query(
      `INSERT INTO therapy_notes (
        therapist_id, patient_id, appointment_id, session_date,
        session_number, session_duration,
        subjective_encrypted, objective_encrypted, 
        assessment_encrypted, plan_encrypted,
        diagnosis, interventions, homework,
        risk_assessment, suicidal_ideation, mental_status,
        progress_rating, goals_addressed,
        next_session_planned, follow_up_required
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING id, session_date, session_number, created_at`,
      [
        therapistId,
        validated.patientId,
        validated.appointmentId || null,
        validated.sessionDate,
        validated.sessionNumber || null,
        validated.sessionDuration || null,
        encryptedSubjective,
        encryptedObjective,
        encryptedAssessment,
        encryptedPlan,
        JSON.stringify(validated.diagnosis || []),
        JSON.stringify(validated.interventions || []),
        validated.homework || null,
        validated.riskAssessment || 'none',
        validated.suicidalIdeation || false,
        JSON.stringify(validated.mentalStatus || {}),
        validated.progressRating || null,
        JSON.stringify(validated.goalsAddressed || []),
        validated.nextSessionPlanned || null,
        validated.followUpRequired || false,
      ]
    );

    res.status(201).json({
      message: 'Therapienotiz erstellt',
      note: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    }
    console.error('Fehler beim Erstellen der Notiz:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/therapy-notes/patient/:patientId
 * Holt alle Notizen für einen Patienten (Therapeut only)
 */
router.get('/patient/:patientId', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const { patientId } = req.params;
    const therapistId = req.user.id;

    const result = await pool.query(
      `SELECT tn.*, u.first_name, u.last_name
       FROM therapy_notes tn
       JOIN users u ON tn.patient_id = u.id
       WHERE tn.therapist_id = $1 AND tn.patient_id = $2
       ORDER BY tn.session_date DESC`,
      [therapistId, patientId]
    );

    // Entschlüsseln
    const notes = result.rows.map((row) => ({
      ...row,
      subjective: decrypt(row.subjective_encrypted),
      objective: decrypt(row.objective_encrypted),
      assessment: decrypt(row.assessment_encrypted),
      plan: decrypt(row.plan_encrypted),
      diagnosis: JSON.parse(row.diagnosis || '[]'),
      interventions: JSON.parse(row.interventions || '[]'),
      mentalStatus: JSON.parse(row.mental_status || '{}'),
      goalsAddressed: JSON.parse(row.goals_addressed || '[]'),
      // Entferne verschlüsselte Felder
      subjective_encrypted: undefined,
      objective_encrypted: undefined,
      assessment_encrypted: undefined,
      plan_encrypted: undefined,
    }));

    res.json(notes);
  } catch (error) {
    console.error('Fehler beim Laden der Notizen:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/therapy-notes/:id
 * Holt eine einzelne Notiz
 */
router.get('/:id', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const { id } = req.params;
    const therapistId = req.user.id;

    const result = await pool.query(
      `SELECT tn.*, u.first_name, u.last_name
       FROM therapy_notes tn
       JOIN users u ON tn.patient_id = u.id
       WHERE tn.id = $1 AND tn.therapist_id = $2`,
      [id, therapistId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notiz nicht gefunden' });
    }

    const row = result.rows[0];
    const note = {
      ...row,
      subjective: decrypt(row.subjective_encrypted),
      objective: decrypt(row.objective_encrypted),
      assessment: decrypt(row.assessment_encrypted),
      plan: decrypt(row.plan_encrypted),
      diagnosis: JSON.parse(row.diagnosis || '[]'),
      interventions: JSON.parse(row.interventions || '[]'),
      mentalStatus: JSON.parse(row.mental_status || '{}'),
      goalsAddressed: JSON.parse(row.goals_addressed || '[]'),
      subjective_encrypted: undefined,
      objective_encrypted: undefined,
      assessment_encrypted: undefined,
      plan_encrypted: undefined,
    };

    res.json(note);
  } catch (error) {
    console.error('Fehler beim Laden der Notiz:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * PUT /api/therapy-notes/:id
 * Aktualisiert eine Notiz
 */
router.put('/:id', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const { id } = req.params;
    const therapistId = req.user.id;
    const validated = TherapyNoteSchema.partial().parse(req.body);

    // Check ownership
    const existing = await pool.query(
      `SELECT id FROM therapy_notes WHERE id = $1 AND therapist_id = $2`,
      [id, therapistId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Notiz nicht gefunden' });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 0;

    // Encrypted fields
    if (validated.subjective !== undefined) {
      paramCount++;
      updateFields.push(`subjective_encrypted = $${paramCount}`);
      values.push(encrypt(validated.subjective));
    }
    if (validated.objective !== undefined) {
      paramCount++;
      updateFields.push(`objective_encrypted = $${paramCount}`);
      values.push(encrypt(validated.objective));
    }
    if (validated.assessment !== undefined) {
      paramCount++;
      updateFields.push(`assessment_encrypted = $${paramCount}`);
      values.push(encrypt(validated.assessment));
    }
    if (validated.plan !== undefined) {
      paramCount++;
      updateFields.push(`plan_encrypted = $${paramCount}`);
      values.push(encrypt(validated.plan));
    }

    // Regular fields
    const simpleFields = {
      sessionDuration: 'session_duration',
      homework: 'homework',
      riskAssessment: 'risk_assessment',
      suicidalIdeation: 'suicidal_ideation',
      progressRating: 'progress_rating',
      nextSessionPlanned: 'next_session_planned',
      followUpRequired: 'follow_up_required',
    };

    for (const [jsField, dbField] of Object.entries(simpleFields)) {
      if (validated[jsField] !== undefined) {
        paramCount++;
        updateFields.push(`${dbField} = $${paramCount}`);
        values.push(validated[jsField]);
      }
    }

    // JSON fields
    const jsonFields = {
      diagnosis: 'diagnosis',
      interventions: 'interventions',
      mentalStatus: 'mental_status',
      goalsAddressed: 'goals_addressed',
    };

    for (const [jsField, dbField] of Object.entries(jsonFields)) {
      if (validated[jsField] !== undefined) {
        paramCount++;
        updateFields.push(`${dbField} = $${paramCount}`);
        values.push(JSON.stringify(validated[jsField]));
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

    await pool.query(
      `UPDATE therapy_notes SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    res.json({ message: 'Notiz aktualisiert' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    }
    console.error('Fehler beim Aktualisieren:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * DELETE /api/therapy-notes/:id
 * Löscht eine Notiz (mit Audit-Log)
 */
router.delete('/:id', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const { id } = req.params;
    const therapistId = req.user.id;

    const result = await pool.query(
      `DELETE FROM therapy_notes WHERE id = $1 AND therapist_id = $2 RETURNING id, patient_id`,
      [id, therapistId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notiz nicht gefunden' });
    }

    // Audit Log
    console.log(`[AUDIT] Therapy note ${id} deleted by therapist ${therapistId} for patient ${result.rows[0].patient_id}`);

    res.json({ message: 'Notiz gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/therapy-notes/search
 * Durchsucht Notizen (nur Metadaten, nicht verschlüsselte Inhalte)
 */
router.get('/search', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const therapistId = req.user.id;
    const { riskLevel, startDate, endDate, patientName } = req.query;

    let query = `
      SELECT tn.id, tn.session_date, tn.risk_assessment, tn.progress_rating,
             u.first_name, u.last_name
      FROM therapy_notes tn
      JOIN users u ON tn.patient_id = u.id
      WHERE tn.therapist_id = $1
    `;
    const params = [therapistId];
    let paramCount = 1;

    if (riskLevel) {
      paramCount++;
      query += ` AND tn.risk_assessment = $${paramCount}`;
      params.push(riskLevel);
    }

    if (startDate) {
      paramCount++;
      query += ` AND tn.session_date >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND tn.session_date <= $${paramCount}`;
      params.push(endDate);
    }

    if (patientName) {
      paramCount++;
      query += ` AND (u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount})`;
      params.push(`%${patientName}%`);
    }

    query += ' ORDER BY tn.session_date DESC LIMIT 100';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Fehler bei der Suche:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
