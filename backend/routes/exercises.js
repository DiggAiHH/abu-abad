const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { z } = require('zod');

// ===== VALIDATION SCHEMAS =====
const exerciseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum([
    'behavioral_activation',
    'exposure',
    'cognitive_restructuring',
    'relaxation',
    'mindfulness',
    'social_skills',
    'problem_solving',
    'emotion_regulation',
    'self_care',
    'journaling',
    'other'
  ]),
  instructions: z.string().max(5000).optional(),
  frequency: z.enum(['once', 'daily', 'weekly', 'as_needed']).optional(),
  dueDate: z.string().optional(),
  estimatedMinutes: z.number().positive().max(180).optional(),
  resources: z.array(z.string()).optional(),
  relatedDiagnosis: z.string().max(100).optional(),
});

const completionSchema = z.object({
  exerciseId: z.number().positive(),
  completed: z.boolean(),
  duration: z.number().positive().max(300).optional(),
  difficulty: z.number().min(1).max(10).optional(),
  moodBefore: z.number().min(1).max(10).optional(),
  moodAfter: z.number().min(1).max(10).optional(),
  notes: z.string().max(2000).optional(),
  barriers: z.array(z.string()).optional(),
});

// ===== EXERCISE TEMPLATES =====
const EXERCISE_TEMPLATES = {
  behavioral_activation: [
    {
      title: 'Aktivitätsplanung',
      description: 'Planen und durchführen einer positiven Aktivität',
      instructions: '1. Wählen Sie eine Aktivität, die Ihnen früher Freude bereitet hat\n2. Planen Sie einen konkreten Zeitpunkt\n3. Führen Sie die Aktivität durch, auch wenn die Motivation gering ist\n4. Dokumentieren Sie Ihre Stimmung vorher/nachher',
      estimatedMinutes: 30,
    },
    {
      title: 'Aufgaben in kleine Schritte teilen',
      description: 'Große Aufgaben in bewältigbare Teilschritte zerlegen',
      instructions: '1. Wählen Sie eine Aufgabe, die Sie vermeiden\n2. Teilen Sie sie in 3-5 kleine Schritte\n3. Beginnen Sie mit dem ersten Schritt\n4. Loben Sie sich nach jedem Schritt',
      estimatedMinutes: 15,
    },
  ],
  exposure: [
    {
      title: 'Angst-Hierarchie erstellen',
      description: 'Liste von angstauslösenden Situationen nach Schweregrad',
      instructions: '1. Listen Sie 10 Situationen auf, die Angst auslösen\n2. Bewerten Sie jede von 0-100 (SUDS)\n3. Ordnen Sie sie vom leichtesten zum schwersten\n4. Diese Liste verwenden wir für schrittweise Exposition',
      estimatedMinutes: 20,
    },
    {
      title: 'In-vivo Exposition',
      description: 'Konfrontation mit einer angstauslösenden Situation',
      instructions: '1. Wählen Sie eine Situation aus Ihrer Hierarchie\n2. Bleiben Sie in der Situation bis die Angst nachlässt\n3. Dokumentieren Sie Ihre SUDS-Werte alle 5 Minuten\n4. Vermeiden Sie Sicherheitsverhalten',
      estimatedMinutes: 45,
    },
  ],
  cognitive_restructuring: [
    {
      title: 'Gedankenprotokoll',
      description: 'Negative Gedanken identifizieren und hinterfragen',
      instructions: '1. Beschreiben Sie die Situation\n2. Notieren Sie Ihre automatischen Gedanken\n3. Identifizieren Sie kognitive Verzerrungen\n4. Formulieren Sie alternative, hilfreichere Gedanken\n5. Bewerten Sie die Glaubwürdigkeit (0-100%)',
      estimatedMinutes: 20,
    },
    {
      title: 'Beweissuche',
      description: 'Für und gegen einen negativen Gedanken argumentieren',
      instructions: '1. Schreiben Sie einen belastenden Gedanken auf\n2. Listen Sie alle Beweise auf, die dafür sprechen\n3. Listen Sie alle Beweise auf, die dagegen sprechen\n4. Formulieren Sie einen ausgewogeneren Gedanken',
      estimatedMinutes: 15,
    },
  ],
  relaxation: [
    {
      title: 'Progressive Muskelentspannung',
      description: 'Systematische Anspannung und Entspannung der Muskelgruppen',
      instructions: '1. Setzen oder legen Sie sich bequem hin\n2. Spannen Sie eine Muskelgruppe 5-7 Sekunden an\n3. Entspannen Sie abrupt und spüren Sie 15-20 Sekunden nach\n4. Arbeiten Sie durch alle Muskelgruppen (Füße bis Gesicht)',
      estimatedMinutes: 20,
    },
    {
      title: 'Atemübung 4-7-8',
      description: 'Beruhigende Atemtechnik',
      instructions: '1. Atmen Sie durch die Nase ein (4 Sekunden)\n2. Halten Sie den Atem (7 Sekunden)\n3. Atmen Sie langsam durch den Mund aus (8 Sekunden)\n4. Wiederholen Sie 4-8 Mal',
      estimatedMinutes: 5,
    },
  ],
  mindfulness: [
    {
      title: 'Body Scan',
      description: 'Achtsame Körperwahrnehmung',
      instructions: '1. Legen Sie sich hin und schließen Sie die Augen\n2. Richten Sie Ihre Aufmerksamkeit auf Ihre Füße\n3. Wandern Sie langsam durch den ganzen Körper\n4. Beobachten Sie Empfindungen ohne zu urteilen',
      estimatedMinutes: 15,
    },
    {
      title: '5-4-3-2-1 Übung',
      description: 'Erdung durch die Sinne',
      instructions: '1. Benennen Sie 5 Dinge, die Sie sehen\n2. Benennen Sie 4 Dinge, die Sie hören\n3. Benennen Sie 3 Dinge, die Sie fühlen/spüren\n4. Benennen Sie 2 Dinge, die Sie riechen\n5. Benennen Sie 1 Ding, das Sie schmecken',
      estimatedMinutes: 5,
    },
    {
      title: 'Achtsames Gehen',
      description: 'Gehmeditation für den Alltag',
      instructions: '1. Gehen Sie langsam und bewusst\n2. Spüren Sie jeden Schritt: Ferse, Ballen, Zehen\n3. Bemerken Sie Ihre Umgebung\n4. Wenn Gedanken kommen, kehren Sie zum Gehen zurück',
      estimatedMinutes: 10,
    },
  ],
  emotion_regulation: [
    {
      title: 'Gefühlsprotokoll',
      description: 'Emotionen erkennen und benennen',
      instructions: '1. Notieren Sie die Situation\n2. Welches Gefühl hatten Sie? (Benennen Sie es genau)\n3. Körperliche Empfindungen?\n4. Welcher Gedanke war damit verbunden?\n5. Was hat das Gefühl ausgelöst?',
      estimatedMinutes: 10,
    },
    {
      title: 'TIPP-Skill',
      description: 'Schnelle Regulation bei starken Emotionen',
      instructions: 'T - Temperatur: Kaltes Wasser ins Gesicht\nI - Intensive Bewegung: 5 Min. joggen/springen\nP - Paced Breathing: Langsamer ausatmen als einatmen\nP - Paired Muscle Relaxation: Anspannen und lösen',
      estimatedMinutes: 15,
    },
  ],
  self_care: [
    {
      title: 'Morgenroutine',
      description: 'Positiver Start in den Tag',
      instructions: '1. Aufstehen zur gleichen Zeit\n2. Kurze Bewegung oder Dehnung\n3. Gesundes Frühstück\n4. Einen positiven Gedanken für den Tag formulieren',
      estimatedMinutes: 30,
    },
    {
      title: 'Schlafhygiene',
      description: 'Besserer Schlaf durch Routine',
      instructions: '1. Bildschirme 1h vor dem Schlaf ausschalten\n2. Schlafzimmer kühl und dunkel halten\n3. Zur gleichen Zeit ins Bett gehen\n4. Entspannende Aktivität vor dem Schlafen',
      estimatedMinutes: 20,
    },
  ],
  journaling: [
    {
      title: 'Dankbarkeitstagebuch',
      description: 'Täglich 3 positive Dinge notieren',
      instructions: '1. Schreiben Sie 3 Dinge auf, für die Sie heute dankbar sind\n2. Beschreiben Sie warum Sie dankbar sind\n3. Spüren Sie das Gefühl der Dankbarkeit',
      estimatedMinutes: 5,
    },
    {
      title: 'Erfolgsjournal',
      description: 'Kleine und große Erfolge dokumentieren',
      instructions: '1. Was haben Sie heute geschafft?\n2. Auch kleine Dinge zählen (aufgestanden, geduscht, etc.)\n3. Loben Sie sich selbst für jeden Erfolg',
      estimatedMinutes: 5,
    },
  ],
};

const CATEGORY_LABELS = {
  behavioral_activation: 'Verhaltensaktivierung',
  exposure: 'Exposition',
  cognitive_restructuring: 'Kognitive Umstrukturierung',
  relaxation: 'Entspannung',
  mindfulness: 'Achtsamkeit',
  social_skills: 'Soziale Fertigkeiten',
  problem_solving: 'Problemlösung',
  emotion_regulation: 'Emotionsregulation',
  self_care: 'Selbstfürsorge',
  journaling: 'Journaling',
  other: 'Sonstige',
};

// ===== ROUTES =====

// GET /api/exercises/templates - Übungsvorlagen abrufen
router.get('/templates', authenticateToken, (req, res) => {
  const { category } = req.query;
  
  let result = {};
  
  if (category && EXERCISE_TEMPLATES[category]) {
    result[category] = EXERCISE_TEMPLATES[category];
  } else {
    result = EXERCISE_TEMPLATES;
  }
  
  res.json({
    templates: result,
    categories: Object.entries(CATEGORY_LABELS).map(([id, name]) => ({ id, name })),
  });
});

// GET /api/exercises - Eigene Übungen abrufen (Patient)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, category } = req.query;
    
    let query = `
      SELECT e.*, 
        (SELECT COUNT(*) FROM exercise_completions ec WHERE ec.exercise_id = e.id AND ec.completed = true) as completion_count,
        (SELECT MAX(completed_at) FROM exercise_completions ec WHERE ec.exercise_id = e.id) as last_completed
      FROM patient_exercises e
      WHERE e.patient_id = $1
    `;
    const params = [req.user.id];
    let paramIndex = 2;
    
    if (status === 'active') {
      query += ` AND e.status = 'active'`;
    } else if (status === 'completed') {
      query += ` AND e.status = 'completed'`;
    }
    
    if (category) {
      query += ` AND e.category = $${paramIndex++}`;
      params.push(category);
    }
    
    query += ` ORDER BY e.created_at DESC`;
    
    const result = await db.query(query, params);
    
    res.json(result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      categoryLabel: CATEGORY_LABELS[row.category],
      instructions: row.instructions,
      frequency: row.frequency,
      dueDate: row.due_date,
      estimatedMinutes: row.estimated_minutes,
      resources: row.resources,
      relatedDiagnosis: row.related_diagnosis,
      status: row.status,
      assignedBy: row.assigned_by,
      completionCount: parseInt(row.completion_count) || 0,
      lastCompleted: row.last_completed,
      createdAt: row.created_at,
    })));
  } catch (error) {
    console.error('Fehler beim Abrufen der Übungen:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/exercises/completions - Completion-Verlauf
router.get('/completions', authenticateToken, async (req, res) => {
  try {
    const { days = 30, exerciseId } = req.query;
    
    let query = `
      SELECT ec.*, e.title, e.category
      FROM exercise_completions ec
      JOIN patient_exercises e ON ec.exercise_id = e.id
      WHERE e.patient_id = $1 AND ec.completed_at >= NOW() - INTERVAL '${parseInt(days)} days'
    `;
    const params = [req.user.id];
    
    if (exerciseId) {
      query += ` AND ec.exercise_id = $2`;
      params.push(exerciseId);
    }
    
    query += ` ORDER BY ec.completed_at DESC`;
    
    const result = await db.query(query, params);
    
    res.json(result.rows.map(row => ({
      id: row.id,
      exerciseId: row.exercise_id,
      exerciseTitle: row.title,
      category: row.category,
      completed: row.completed,
      duration: row.duration,
      difficulty: row.difficulty,
      moodBefore: row.mood_before,
      moodAfter: row.mood_after,
      notes: row.notes,
      barriers: row.barriers,
      completedAt: row.completed_at,
    })));
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/exercises/complete - Übung als erledigt markieren
router.post('/complete', authenticateToken, async (req, res) => {
  try {
    const data = completionSchema.parse(req.body);
    
    // Prüfen ob Übung dem User gehört
    const check = await db.query(
      'SELECT id FROM patient_exercises WHERE id = $1 AND patient_id = $2',
      [data.exerciseId, req.user.id]
    );
    
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Übung nicht gefunden' });
    }
    
    const result = await db.query(
      `INSERT INTO exercise_completions 
       (exercise_id, completed, duration, difficulty, mood_before, mood_after, notes, barriers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.exerciseId,
        data.completed,
        data.duration || null,
        data.difficulty || null,
        data.moodBefore || null,
        data.moodAfter || null,
        data.notes || null,
        JSON.stringify(data.barriers || []),
      ]
    );
    
    res.status(201).json({
      id: result.rows[0].id,
      completed: result.rows[0].completed,
      completedAt: result.rows[0].completed_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Ungültige Daten', details: error.errors });
    }
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/exercises/stats - Übungs-Statistiken
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Gesamt-Statistiken
    const statsResult = await db.query(
      `SELECT 
         COUNT(DISTINCT e.id) as total_exercises,
         COUNT(ec.id) FILTER (WHERE ec.completed = true) as total_completions,
         AVG(ec.mood_after - ec.mood_before) FILTER (WHERE ec.mood_before IS NOT NULL AND ec.mood_after IS NOT NULL) as avg_mood_change
       FROM patient_exercises e
       LEFT JOIN exercise_completions ec ON ec.exercise_id = e.id AND ec.completed_at >= NOW() - INTERVAL '${parseInt(days)} days'
       WHERE e.patient_id = $1`,
      [req.user.id]
    );
    
    // Nach Kategorie
    const categoryResult = await db.query(
      `SELECT 
         e.category,
         COUNT(ec.id) FILTER (WHERE ec.completed = true) as completions
       FROM patient_exercises e
       LEFT JOIN exercise_completions ec ON ec.exercise_id = e.id AND ec.completed_at >= NOW() - INTERVAL '${parseInt(days)} days'
       WHERE e.patient_id = $1
       GROUP BY e.category`,
      [req.user.id]
    );
    
    // Wöchentliche Aktivität
    const weeklyResult = await db.query(
      `SELECT 
         DATE_TRUNC('week', ec.completed_at) as week,
         COUNT(*) as completions
       FROM exercise_completions ec
       JOIN patient_exercises e ON ec.exercise_id = e.id
       WHERE e.patient_id = $1 
         AND ec.completed = true
         AND ec.completed_at >= NOW() - INTERVAL '${parseInt(days)} days'
       GROUP BY week
       ORDER BY week DESC`,
      [req.user.id]
    );
    
    const stats = statsResult.rows[0];
    
    res.json({
      totalExercises: parseInt(stats.total_exercises) || 0,
      totalCompletions: parseInt(stats.total_completions) || 0,
      avgMoodChange: stats.avg_mood_change ? parseFloat(stats.avg_mood_change).toFixed(1) : null,
      byCategory: categoryResult.rows.map(row => ({
        category: row.category,
        categoryLabel: CATEGORY_LABELS[row.category],
        completions: parseInt(row.completions) || 0,
      })),
      weeklyActivity: weeklyResult.rows.map(row => ({
        week: row.week,
        completions: parseInt(row.completions),
      })),
      period: `${days} Tage`,
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ===== THERAPIST ROUTES =====

// GET /api/exercises/patient/:patientId - Patient's Übungen (Therapeut)
router.get('/patient/:patientId', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const result = await db.query(
      `SELECT e.*, 
        (SELECT COUNT(*) FROM exercise_completions ec WHERE ec.exercise_id = e.id AND ec.completed = true) as completion_count,
        (SELECT MAX(completed_at) FROM exercise_completions ec WHERE ec.exercise_id = e.id) as last_completed
       FROM patient_exercises e
       WHERE e.patient_id = $1
       ORDER BY e.created_at DESC`,
      [patientId]
    );
    
    res.json(result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      categoryLabel: CATEGORY_LABELS[row.category],
      instructions: row.instructions,
      frequency: row.frequency,
      dueDate: row.due_date,
      estimatedMinutes: row.estimated_minutes,
      status: row.status,
      completionCount: parseInt(row.completion_count) || 0,
      lastCompleted: row.last_completed,
      createdAt: row.created_at,
    })));
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/exercises/assign - Übung zuweisen (Therapeut)
router.post('/assign', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { patientId, ...exerciseData } = req.body;
    const data = exerciseSchema.parse(exerciseData);
    
    if (!patientId) {
      return res.status(400).json({ error: 'patientId erforderlich' });
    }
    
    const result = await db.query(
      `INSERT INTO patient_exercises 
       (patient_id, title, description, category, instructions, frequency, 
        due_date, estimated_minutes, resources, related_diagnosis, assigned_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
       RETURNING *`,
      [
        patientId,
        data.title,
        data.description || null,
        data.category,
        data.instructions || null,
        data.frequency || 'once',
        data.dueDate || null,
        data.estimatedMinutes || null,
        JSON.stringify(data.resources || []),
        data.relatedDiagnosis || null,
        req.user.id,
      ]
    );
    
    res.status(201).json({
      id: result.rows[0].id,
      title: result.rows[0].title,
      category: result.rows[0].category,
      createdAt: result.rows[0].created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Ungültige Daten', details: error.errors });
    }
    console.error('Fehler beim Zuweisen:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// DELETE /api/exercises/:id - Übung löschen (Therapeut)
router.delete('/:id', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM patient_exercises WHERE id = $1 AND assigned_by = $2 RETURNING id',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Übung nicht gefunden oder nicht berechtigt' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// PUT /api/exercises/:id/status - Status ändern (Therapeut)
router.put('/:id/status', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Ungültiger Status' });
    }
    
    await db.query(
      'UPDATE patient_exercises SET status = $1 WHERE id = $2 AND assigned_by = $3',
      [status, id, req.user.id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
