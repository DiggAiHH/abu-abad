const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { pool } = require('../utils/db');
const { authenticateToken, requirePatient, requireTherapist } = require('../middleware/auth');

// ===== STANDARDISIERTE PSYCHOLOGISCHE TESTS =====

const SCREENING_TEMPLATES = {
  'PHQ-9': {
    name: 'PHQ-9 (Patient Health Questionnaire)',
    description: 'Screening-Instrument für Depression',
    category: 'Depression',
    questions: [
      { id: 1, text: 'Wenig Interesse oder Freude an Ihren Tätigkeiten' },
      { id: 2, text: 'Niedergeschlagenheit, Schwermut oder Hoffnungslosigkeit' },
      { id: 3, text: 'Schwierigkeiten beim Ein- oder Durchschlafen oder vermehrtes Schlafen' },
      { id: 4, text: 'Müdigkeit oder Gefühl, keine Energie zu haben' },
      { id: 5, text: 'Verminderter Appetit oder übermäßiges Bedürfnis zu essen' },
      { id: 6, text: 'Schlechte Meinung von sich selbst; Gefühl, ein Versager zu sein oder die Familie enttäuscht zu haben' },
      { id: 7, text: 'Schwierigkeiten, sich auf etwas zu konzentrieren, z.B. beim Zeitung lesen oder Fernsehen' },
      { id: 8, text: 'Waren Ihre Bewegungen oder Ihre Sprache so verlangsamt, dass es auch anderen auffallen würde? Oder waren Sie im Gegenteil zappelig oder ruhelos?' },
      { id: 9, text: 'Gedanken, dass Sie lieber tot wären oder sich selbst Leid zufügen möchten' },
    ],
    options: [
      { value: 0, label: 'Überhaupt nicht' },
      { value: 1, label: 'An einzelnen Tagen' },
      { value: 2, label: 'An mehr als der Hälfte der Tage' },
      { value: 3, label: 'Beinahe jeden Tag' },
    ],
    scoring: {
      ranges: [
        { min: 0, max: 4, label: 'Minimal', severity: 'none' },
        { min: 5, max: 9, label: 'Leicht', severity: 'mild' },
        { min: 10, max: 14, label: 'Mittelgradig', severity: 'moderate' },
        { min: 15, max: 19, label: 'Mäßig schwer', severity: 'moderately-severe' },
        { min: 20, max: 27, label: 'Schwer', severity: 'severe' },
      ],
      maxScore: 27,
      criticalQuestion: 9, // Suizidalität
    },
  },
  
  'GAD-7': {
    name: 'GAD-7 (Generalized Anxiety Disorder)',
    description: 'Screening-Instrument für Angststörungen',
    category: 'Angst',
    questions: [
      { id: 1, text: 'Nervosität, Ängstlichkeit oder Anspannung' },
      { id: 2, text: 'Nicht in der Lage sein, Sorgen zu stoppen oder zu kontrollieren' },
      { id: 3, text: 'Übermäßige Sorgen bezüglich verschiedener Angelegenheiten' },
      { id: 4, text: 'Schwierigkeiten zu entspannen' },
      { id: 5, text: 'Rastlosigkeit, sodass Stillsitzen schwerfällt' },
      { id: 6, text: 'Schnelle Verärgerung oder Reizbarkeit' },
      { id: 7, text: 'Gefühl der Angst, so als würde etwas Schlimmes passieren' },
    ],
    options: [
      { value: 0, label: 'Überhaupt nicht' },
      { value: 1, label: 'An einzelnen Tagen' },
      { value: 2, label: 'An mehr als der Hälfte der Tage' },
      { value: 3, label: 'Beinahe jeden Tag' },
    ],
    scoring: {
      ranges: [
        { min: 0, max: 4, label: 'Minimal', severity: 'none' },
        { min: 5, max: 9, label: 'Leicht', severity: 'mild' },
        { min: 10, max: 14, label: 'Mittelgradig', severity: 'moderate' },
        { min: 15, max: 21, label: 'Schwer', severity: 'severe' },
      ],
      maxScore: 21,
    },
  },
  
  'PHQ-4': {
    name: 'PHQ-4 (Ultra-Kurzscreening)',
    description: 'Kurzscreening für Angst und Depression',
    category: 'Screening',
    questions: [
      { id: 1, text: 'Wenig Interesse oder Freude an Ihren Tätigkeiten', subscale: 'depression' },
      { id: 2, text: 'Niedergeschlagenheit, Schwermut oder Hoffnungslosigkeit', subscale: 'depression' },
      { id: 3, text: 'Nervosität, Ängstlichkeit oder Anspannung', subscale: 'anxiety' },
      { id: 4, text: 'Nicht in der Lage sein, Sorgen zu stoppen oder zu kontrollieren', subscale: 'anxiety' },
    ],
    options: [
      { value: 0, label: 'Überhaupt nicht' },
      { value: 1, label: 'An einzelnen Tagen' },
      { value: 2, label: 'An mehr als der Hälfte der Tage' },
      { value: 3, label: 'Beinahe jeden Tag' },
    ],
    scoring: {
      ranges: [
        { min: 0, max: 2, label: 'Normal', severity: 'none' },
        { min: 3, max: 5, label: 'Leicht', severity: 'mild' },
        { min: 6, max: 8, label: 'Mittelgradig', severity: 'moderate' },
        { min: 9, max: 12, label: 'Schwer', severity: 'severe' },
      ],
      maxScore: 12,
    },
  },

  'ISI': {
    name: 'ISI (Insomnia Severity Index)',
    description: 'Screening für Schlafstörungen',
    category: 'Schlaf',
    questions: [
      { id: 1, text: 'Schwierigkeiten einzuschlafen' },
      { id: 2, text: 'Schwierigkeiten durchzuschlafen' },
      { id: 3, text: 'Probleme mit zu frühem Aufwachen' },
      { id: 4, text: 'Wie zufrieden/unzufrieden sind Sie mit Ihrem aktuellen Schlafmuster?' },
      { id: 5, text: 'Wie stark beeinträchtigen Ihre Schlafprobleme Ihr tägliches Funktionieren?' },
      { id: 6, text: 'Wie bemerkbar sind Ihre Schlafprobleme für andere?' },
      { id: 7, text: 'Wie besorgt/beunruhigt sind Sie wegen Ihrer Schlafprobleme?' },
    ],
    options: [
      { value: 0, label: 'Keine/Nicht' },
      { value: 1, label: 'Leicht' },
      { value: 2, label: 'Mäßig' },
      { value: 3, label: 'Schwer' },
      { value: 4, label: 'Sehr schwer' },
    ],
    scoring: {
      ranges: [
        { min: 0, max: 7, label: 'Keine klinische Insomnie', severity: 'none' },
        { min: 8, max: 14, label: 'Unterschwellige Insomnie', severity: 'mild' },
        { min: 15, max: 21, label: 'Mittelschwere Insomnie', severity: 'moderate' },
        { min: 22, max: 28, label: 'Schwere Insomnie', severity: 'severe' },
      ],
      maxScore: 28,
    },
  },
};

// ===== VALIDATION =====
const ScreeningResponseSchema = z.object({
  screeningType: z.enum(['PHQ-9', 'GAD-7', 'PHQ-4', 'ISI']),
  answers: z.array(z.object({
    questionId: z.number(),
    value: z.number().min(0).max(4),
  })),
  assignedBy: z.string().uuid().optional(),
});

// ===== HELPER FUNCTIONS =====
function calculateScore(screeningType, answers) {
  const template = SCREENING_TEMPLATES[screeningType];
  if (!template) return null;
  
  const totalScore = answers.reduce((sum, a) => sum + a.value, 0);
  const severity = template.scoring.ranges.find(
    (r) => totalScore >= r.min && totalScore <= r.max
  );
  
  const result = {
    totalScore,
    maxScore: template.scoring.maxScore,
    percentage: Math.round((totalScore / template.scoring.maxScore) * 100),
    severity: severity?.severity || 'unknown',
    severityLabel: severity?.label || 'Unbekannt',
  };
  
  // PHQ-9: Spezielle Prüfung auf Frage 9 (Suizidalität)
  if (screeningType === 'PHQ-9') {
    const q9 = answers.find((a) => a.questionId === 9);
    if (q9 && q9.value > 0) {
      result.suicidalIdeation = true;
      result.criticalAlert = 'Patient hat suizidale Gedanken angegeben. Sofortige Abklärung empfohlen.';
    }
  }
  
  return result;
}

// ===== ROUTES =====

/**
 * GET /api/screenings/templates
 * Liefert alle verfügbaren Screening-Templates
 */
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const templates = Object.entries(SCREENING_TEMPLATES).map(([key, value]) => ({
      id: key,
      name: value.name,
      description: value.description,
      category: value.category,
      questionCount: value.questions.length,
      maxScore: value.scoring.maxScore,
    }));
    
    res.json(templates);
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/screenings/template/:type
 * Liefert ein spezifisches Template zum Ausfüllen
 */
router.get('/template/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    const template = SCREENING_TEMPLATES[type];
    
    if (!template) {
      return res.status(404).json({ error: 'Screening-Typ nicht gefunden' });
    }
    
    res.json({
      type,
      ...template,
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * POST /api/screenings
 * Patient füllt ein Screening aus
 */
router.post('/', authenticateToken, requirePatient, async (req, res) => {
  try {
    const validated = ScreeningResponseSchema.parse(req.body);
    const patientId = req.user.id;
    
    const template = SCREENING_TEMPLATES[validated.screeningType];
    if (!template) {
      return res.status(400).json({ error: 'Ungültiger Screening-Typ' });
    }
    
    // Validiere dass alle Fragen beantwortet wurden
    if (validated.answers.length !== template.questions.length) {
      return res.status(400).json({ 
        error: 'Bitte beantworten Sie alle Fragen',
        expected: template.questions.length,
        received: validated.answers.length,
      });
    }
    
    // Score berechnen
    const result = calculateScore(validated.screeningType, validated.answers);
    
    // Speichern
    const dbResult = await pool.query(
      `INSERT INTO screening_results (
        patient_id, screening_type, answers, 
        total_score, severity, result_data,
        assigned_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        patientId,
        validated.screeningType,
        JSON.stringify(validated.answers),
        result.totalScore,
        result.severity,
        JSON.stringify(result),
        validated.assignedBy || null,
      ]
    );
    
    // Wenn kritischer Alert (Suizidalität), ggf. Notification an Therapeuten
    if (result.criticalAlert) {
      console.warn(`[CRITICAL ALERT] Patient ${patientId}: ${result.criticalAlert}`);
      // Hier könnte eine E-Mail oder Push-Notification an den Therapeuten gesendet werden
    }
    
    res.status(201).json({
      message: 'Screening abgeschlossen',
      result: {
        id: dbResult.rows[0].id,
        ...result,
        completedAt: dbResult.rows[0].created_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    }
    console.error('Fehler beim Speichern:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/screenings/my-results
 * Patient sieht eigene Ergebnisse
 */
router.get('/my-results', authenticateToken, requirePatient, async (req, res) => {
  try {
    const patientId = req.user.id;
    const { type, limit = 20 } = req.query;
    
    let query = `
      SELECT * FROM screening_results 
      WHERE patient_id = $1
    `;
    const params = [patientId];
    let paramCount = 1;
    
    if (type) {
      paramCount++;
      query += ` AND screening_type = $${paramCount}`;
      params.push(type);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit, 10));
    
    const result = await pool.query(query, params);
    
    const results = result.rows.map((row) => ({
      ...row,
      answers: JSON.parse(row.answers || '[]'),
      result_data: JSON.parse(row.result_data || '{}'),
    }));
    
    res.json(results);
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/screenings/patient/:patientId
 * Therapeut sieht Ergebnisse eines Patienten
 */
router.get('/patient/:patientId', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const { patientId } = req.params;
    const therapistId = req.user.id;
    
    // Behandlungsbeziehung prüfen
    const relationCheck = await pool.query(
      `SELECT id FROM appointments 
       WHERE therapist_id = $1 AND patient_id = $2 
       AND status IN ('booked', 'completed') LIMIT 1`,
      [therapistId, patientId]
    );
    
    if (relationCheck.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Keine Behandlungsbeziehung zu diesem Patienten' 
      });
    }
    
    const result = await pool.query(
      `SELECT sr.*, u.first_name, u.last_name
       FROM screening_results sr
       JOIN users u ON sr.patient_id = u.id
       WHERE sr.patient_id = $1
       ORDER BY sr.created_at DESC`,
      [patientId]
    );
    
    const results = result.rows.map((row) => ({
      ...row,
      answers: JSON.parse(row.answers || '[]'),
      result_data: JSON.parse(row.result_data || '{}'),
    }));
    
    res.json(results);
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * POST /api/screenings/assign
 * Therapeut weist einem Patienten ein Screening zu
 */
router.post('/assign', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const { patientId, screeningType, dueDate, message } = req.body;
    const therapistId = req.user.id;
    
    if (!SCREENING_TEMPLATES[screeningType]) {
      return res.status(400).json({ error: 'Ungültiger Screening-Typ' });
    }
    
    const result = await pool.query(
      `INSERT INTO screening_assignments (
        patient_id, therapist_id, screening_type, due_date, message
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [patientId, therapistId, screeningType, dueDate || null, message || null]
    );
    
    res.status(201).json({
      message: 'Screening zugewiesen',
      assignment: result.rows[0],
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/screenings/pending
 * Patient sieht ausstehende zugewiesene Screenings
 */
router.get('/pending', authenticateToken, requirePatient, async (req, res) => {
  try {
    const patientId = req.user.id;
    
    const result = await pool.query(
      `SELECT sa.*, u.first_name as therapist_first, u.last_name as therapist_last
       FROM screening_assignments sa
       JOIN users u ON sa.therapist_id = u.id
       WHERE sa.patient_id = $1 AND sa.completed_at IS NULL
       ORDER BY sa.due_date ASC NULLS LAST, sa.created_at ASC`,
      [patientId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/screenings/trends/:patientId
 * Zeigt Verlauf eines Screening-Typs über Zeit
 */
router.get('/trends/:patientId', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { type } = req.query;
    
    if (!type) {
      return res.status(400).json({ error: 'screening_type Parameter erforderlich' });
    }
    
    const result = await pool.query(
      `SELECT 
        DATE(created_at) as date,
        total_score,
        severity,
        result_data
       FROM screening_results
       WHERE patient_id = $1 AND screening_type = $2
       ORDER BY created_at ASC`,
      [patientId, type]
    );
    
    const trends = result.rows.map((row) => ({
      date: row.date,
      score: row.total_score,
      severity: row.severity,
      data: JSON.parse(row.result_data || '{}'),
    }));
    
    res.json({
      screeningType: type,
      template: SCREENING_TEMPLATES[type],
      dataPoints: trends,
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
