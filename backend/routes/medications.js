const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { z } = require('zod');

// ===== VALIDATION SCHEMAS =====
const medicationSchema = z.object({
  name: z.string().min(1).max(200),
  genericName: z.string().max(200).optional(),
  dosage: z.string().min(1).max(100), // z.B. "10 mg"
  frequency: z.enum(['once_daily', 'twice_daily', 'three_times', 'four_times', 'as_needed', 'weekly', 'other']),
  frequencyDetails: z.string().max(200).optional(), // z.B. "morgens und abends"
  timing: z.array(z.string()).optional(), // ["08:00", "20:00"]
  prescribedBy: z.string().max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reason: z.string().max(500).optional(), // Indikation
  category: z.enum([
    'antidepressant',
    'anxiolytic',
    'antipsychotic',
    'mood_stabilizer',
    'stimulant',
    'sedative',
    'other_psychiatric',
    'other_medical'
  ]).optional(),
  notes: z.string().max(1000).optional(),
  sideEffects: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});

const intakeLogSchema = z.object({
  medicationId: z.number().positive(),
  taken: z.boolean(),
  scheduledTime: z.string().optional(),
  actualTime: z.string().optional(),
  skippedReason: z.string().max(500).optional(),
  sideEffectsNoted: z.array(z.string()).optional(),
  notes: z.string().max(500).optional()
});

// ===== COMMON PSYCHIATRIC MEDICATIONS DATABASE =====
const COMMON_MEDICATIONS = [
  // Antidepressiva - SSRI
  { name: 'Sertralin', genericName: 'Sertraline', category: 'antidepressant', commonDosages: ['25 mg', '50 mg', '100 mg', '150 mg', '200 mg'] },
  { name: 'Escitalopram', genericName: 'Escitalopram', category: 'antidepressant', commonDosages: ['5 mg', '10 mg', '20 mg'] },
  { name: 'Fluoxetin', genericName: 'Fluoxetine', category: 'antidepressant', commonDosages: ['10 mg', '20 mg', '40 mg', '60 mg'] },
  { name: 'Paroxetin', genericName: 'Paroxetine', category: 'antidepressant', commonDosages: ['10 mg', '20 mg', '30 mg', '40 mg'] },
  { name: 'Citalopram', genericName: 'Citalopram', category: 'antidepressant', commonDosages: ['10 mg', '20 mg', '40 mg'] },
  
  // Antidepressiva - SNRI
  { name: 'Venlafaxin', genericName: 'Venlafaxine', category: 'antidepressant', commonDosages: ['37.5 mg', '75 mg', '150 mg', '225 mg'] },
  { name: 'Duloxetin', genericName: 'Duloxetine', category: 'antidepressant', commonDosages: ['30 mg', '60 mg', '90 mg', '120 mg'] },
  
  // Antidepressiva - Atypische
  { name: 'Mirtazapin', genericName: 'Mirtazapine', category: 'antidepressant', commonDosages: ['15 mg', '30 mg', '45 mg'] },
  { name: 'Bupropion', genericName: 'Bupropion', category: 'antidepressant', commonDosages: ['150 mg', '300 mg'] },
  { name: 'Trazodon', genericName: 'Trazodone', category: 'antidepressant', commonDosages: ['50 mg', '100 mg', '150 mg'] },
  
  // Antidepressiva - Trizyklische
  { name: 'Amitriptylin', genericName: 'Amitriptyline', category: 'antidepressant', commonDosages: ['10 mg', '25 mg', '50 mg', '75 mg'] },
  { name: 'Trimipramin', genericName: 'Trimipramine', category: 'antidepressant', commonDosages: ['25 mg', '50 mg', '100 mg'] },
  
  // Anxiolytika
  { name: 'Lorazepam', genericName: 'Lorazepam', category: 'anxiolytic', commonDosages: ['0.5 mg', '1 mg', '2 mg'] },
  { name: 'Diazepam', genericName: 'Diazepam', category: 'anxiolytic', commonDosages: ['2 mg', '5 mg', '10 mg'] },
  { name: 'Alprazolam', genericName: 'Alprazolam', category: 'anxiolytic', commonDosages: ['0.25 mg', '0.5 mg', '1 mg'] },
  { name: 'Buspiron', genericName: 'Buspirone', category: 'anxiolytic', commonDosages: ['5 mg', '10 mg', '15 mg'] },
  { name: 'Pregabalin', genericName: 'Pregabalin', category: 'anxiolytic', commonDosages: ['25 mg', '50 mg', '75 mg', '150 mg', '300 mg'] },
  { name: 'Opipramol', genericName: 'Opipramol', category: 'anxiolytic', commonDosages: ['50 mg', '100 mg'] },
  
  // Antipsychotika - Typische
  { name: 'Haloperidol', genericName: 'Haloperidol', category: 'antipsychotic', commonDosages: ['0.5 mg', '1 mg', '2 mg', '5 mg'] },
  { name: 'Flupentixol', genericName: 'Flupenthixol', category: 'antipsychotic', commonDosages: ['0.5 mg', '1 mg', '2 mg'] },
  
  // Antipsychotika - Atypische
  { name: 'Quetiapin', genericName: 'Quetiapine', category: 'antipsychotic', commonDosages: ['25 mg', '50 mg', '100 mg', '200 mg', '300 mg'] },
  { name: 'Risperidon', genericName: 'Risperidone', category: 'antipsychotic', commonDosages: ['0.5 mg', '1 mg', '2 mg', '3 mg', '4 mg'] },
  { name: 'Olanzapin', genericName: 'Olanzapine', category: 'antipsychotic', commonDosages: ['2.5 mg', '5 mg', '10 mg', '15 mg', '20 mg'] },
  { name: 'Aripiprazol', genericName: 'Aripiprazole', category: 'antipsychotic', commonDosages: ['2 mg', '5 mg', '10 mg', '15 mg', '30 mg'] },
  { name: 'Clozapin', genericName: 'Clozapine', category: 'antipsychotic', commonDosages: ['25 mg', '50 mg', '100 mg', '200 mg'] },
  
  // Stimmungsstabilisierer
  { name: 'Lithium', genericName: 'Lithium', category: 'mood_stabilizer', commonDosages: ['150 mg', '300 mg', '450 mg'] },
  { name: 'Valproinsäure', genericName: 'Valproic Acid', category: 'mood_stabilizer', commonDosages: ['150 mg', '300 mg', '500 mg'] },
  { name: 'Lamotrigin', genericName: 'Lamotrigine', category: 'mood_stabilizer', commonDosages: ['25 mg', '50 mg', '100 mg', '200 mg'] },
  { name: 'Carbamazepin', genericName: 'Carbamazepine', category: 'mood_stabilizer', commonDosages: ['200 mg', '400 mg'] },
  
  // Stimulanzien (ADHS)
  { name: 'Methylphenidat', genericName: 'Methylphenidate', category: 'stimulant', commonDosages: ['5 mg', '10 mg', '20 mg', '30 mg', '40 mg', '54 mg'] },
  { name: 'Lisdexamfetamin', genericName: 'Lisdexamfetamine', category: 'stimulant', commonDosages: ['30 mg', '50 mg', '70 mg'] },
  { name: 'Atomoxetin', genericName: 'Atomoxetine', category: 'stimulant', commonDosages: ['10 mg', '18 mg', '25 mg', '40 mg', '60 mg', '80 mg'] },
  
  // Schlafmittel
  { name: 'Zolpidem', genericName: 'Zolpidem', category: 'sedative', commonDosages: ['5 mg', '10 mg'] },
  { name: 'Zopiclon', genericName: 'Zopiclone', category: 'sedative', commonDosages: ['3.75 mg', '7.5 mg'] },
  { name: 'Melatonin', genericName: 'Melatonin', category: 'sedative', commonDosages: ['0.5 mg', '1 mg', '2 mg', '5 mg'] },
];

// ===== COMMON SIDE EFFECTS =====
const COMMON_SIDE_EFFECTS = [
  'Müdigkeit', 'Schläfrigkeit', 'Übelkeit', 'Kopfschmerzen', 'Schwindel',
  'Mundtrockenheit', 'Gewichtszunahme', 'Gewichtsverlust', 'Appetitlosigkeit',
  'Schlafstörungen', 'Unruhe', 'Zittern', 'Verstopfung', 'Durchfall',
  'Verschwommenes Sehen', 'Herzrasen', 'Schweißausbrüche', 'Sexuelle Dysfunktion',
  'Konzentrationsprobleme', 'Vergesslichkeit', 'Stimmungsschwankungen'
];

// ===== ROUTES =====

// GET /api/medications/database - Medikamenten-Datenbank abrufen
router.get('/database', authenticateToken, (req, res) => {
  const { category, search } = req.query;
  
  let results = [...COMMON_MEDICATIONS];
  
  if (category) {
    results = results.filter(m => m.category === category);
  }
  
  if (search) {
    const searchLower = search.toLowerCase();
    results = results.filter(m => 
      m.name.toLowerCase().includes(searchLower) ||
      m.genericName.toLowerCase().includes(searchLower)
    );
  }
  
  res.json({
    medications: results,
    sideEffects: COMMON_SIDE_EFFECTS,
    categories: [
      { id: 'antidepressant', name: 'Antidepressiva' },
      { id: 'anxiolytic', name: 'Anxiolytika / Angstlöser' },
      { id: 'antipsychotic', name: 'Antipsychotika' },
      { id: 'mood_stabilizer', name: 'Stimmungsstabilisierer' },
      { id: 'stimulant', name: 'Stimulanzien (ADHS)' },
      { id: 'sedative', name: 'Schlafmittel / Sedativa' },
      { id: 'other_psychiatric', name: 'Sonstige Psychiatrische' },
      { id: 'other_medical', name: 'Sonstige Medikamente' }
    ]
  });
});

// GET /api/medications - Eigene Medikamente abrufen
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { active } = req.query;
    
    let query = `
      SELECT * FROM patient_medications 
      WHERE patient_id = $1
    `;
    const params = [req.user.id];
    
    if (active === 'true') {
      query += ` AND is_active = true`;
    }
    
    query += ` ORDER BY is_active DESC, name ASC`;
    
    const result = await db.query(query, params);
    
    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      genericName: row.generic_name,
      dosage: row.dosage,
      frequency: row.frequency,
      frequencyDetails: row.frequency_details,
      timing: row.timing,
      prescribedBy: row.prescribed_by,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      category: row.category,
      notes: row.notes,
      sideEffects: row.side_effects,
      isActive: row.is_active,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Fehler beim Abrufen der Medikamente:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/medications - Neues Medikament hinzufügen
router.post('/', authenticateToken, async (req, res) => {
  try {
    const data = medicationSchema.parse(req.body);
    
    const result = await db.query(
      `INSERT INTO patient_medications 
       (patient_id, name, generic_name, dosage, frequency, frequency_details, 
        timing, prescribed_by, start_date, end_date, reason, category, notes, 
        side_effects, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        req.user.id,
        data.name,
        data.genericName || null,
        data.dosage,
        data.frequency,
        data.frequencyDetails || null,
        JSON.stringify(data.timing || []),
        data.prescribedBy || null,
        data.startDate || null,
        data.endDate || null,
        data.reason || null,
        data.category || 'other_psychiatric',
        data.notes || null,
        JSON.stringify(data.sideEffects || []),
        data.isActive !== false
      ]
    );
    
    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      name: row.name,
      dosage: row.dosage,
      frequency: row.frequency,
      isActive: row.is_active,
      createdAt: row.created_at
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Ungültige Daten', details: error.errors });
    }
    console.error('Fehler beim Hinzufügen des Medikaments:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// PUT /api/medications/:id - Medikament aktualisieren
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const data = medicationSchema.partial().parse(req.body);
    
    // Prüfen ob Medikament dem User gehört
    const check = await db.query(
      'SELECT id FROM patient_medications WHERE id = $1 AND patient_id = $2',
      [id, req.user.id]
    );
    
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Medikament nicht gefunden' });
    }
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (data.name !== undefined) { updates.push(`name = $${paramIndex++}`); values.push(data.name); }
    if (data.genericName !== undefined) { updates.push(`generic_name = $${paramIndex++}`); values.push(data.genericName); }
    if (data.dosage !== undefined) { updates.push(`dosage = $${paramIndex++}`); values.push(data.dosage); }
    if (data.frequency !== undefined) { updates.push(`frequency = $${paramIndex++}`); values.push(data.frequency); }
    if (data.frequencyDetails !== undefined) { updates.push(`frequency_details = $${paramIndex++}`); values.push(data.frequencyDetails); }
    if (data.timing !== undefined) { updates.push(`timing = $${paramIndex++}`); values.push(JSON.stringify(data.timing)); }
    if (data.prescribedBy !== undefined) { updates.push(`prescribed_by = $${paramIndex++}`); values.push(data.prescribedBy); }
    if (data.startDate !== undefined) { updates.push(`start_date = $${paramIndex++}`); values.push(data.startDate); }
    if (data.endDate !== undefined) { updates.push(`end_date = $${paramIndex++}`); values.push(data.endDate); }
    if (data.reason !== undefined) { updates.push(`reason = $${paramIndex++}`); values.push(data.reason); }
    if (data.category !== undefined) { updates.push(`category = $${paramIndex++}`); values.push(data.category); }
    if (data.notes !== undefined) { updates.push(`notes = $${paramIndex++}`); values.push(data.notes); }
    if (data.sideEffects !== undefined) { updates.push(`side_effects = $${paramIndex++}`); values.push(JSON.stringify(data.sideEffects)); }
    if (data.isActive !== undefined) { updates.push(`is_active = $${paramIndex++}`); values.push(data.isActive); }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    await db.query(
      `UPDATE patient_medications SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Ungültige Daten', details: error.errors });
    }
    console.error('Fehler beim Aktualisieren:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// DELETE /api/medications/:id - Medikament löschen
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM patient_medications WHERE id = $1 AND patient_id = $2 RETURNING id',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medikament nicht gefunden' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/medications/:id/deactivate - Medikament deaktivieren (abgesetzt)
router.post('/:id/deactivate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { endDate, reason } = req.body;
    
    const result = await db.query(
      `UPDATE patient_medications 
       SET is_active = false, end_date = $1, notes = COALESCE(notes, '') || $2, updated_at = NOW()
       WHERE id = $3 AND patient_id = $4
       RETURNING id`,
      [
        endDate || new Date().toISOString().split('T')[0],
        reason ? `\n[Abgesetzt: ${reason}]` : '',
        id,
        req.user.id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medikament nicht gefunden' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler beim Deaktivieren:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ===== INTAKE LOGGING =====

// GET /api/medications/intake - Einnahme-Protokoll abrufen
router.get('/intake', authenticateToken, async (req, res) => {
  try {
    const { date, medicationId, days = 7 } = req.query;
    
    let query = `
      SELECT il.*, pm.name as medication_name, pm.dosage
      FROM medication_intake_log il
      JOIN patient_medications pm ON il.medication_id = pm.id
      WHERE pm.patient_id = $1
    `;
    const params = [req.user.id];
    let paramIndex = 2;
    
    if (date) {
      query += ` AND DATE(il.logged_at) = $${paramIndex++}`;
      params.push(date);
    } else {
      query += ` AND il.logged_at >= NOW() - INTERVAL '${parseInt(days)} days'`;
    }
    
    if (medicationId) {
      query += ` AND il.medication_id = $${paramIndex++}`;
      params.push(medicationId);
    }
    
    query += ` ORDER BY il.logged_at DESC`;
    
    const result = await db.query(query, params);
    
    res.json(result.rows.map(row => ({
      id: row.id,
      medicationId: row.medication_id,
      medicationName: row.medication_name,
      dosage: row.dosage,
      taken: row.taken,
      scheduledTime: row.scheduled_time,
      actualTime: row.actual_time,
      skippedReason: row.skipped_reason,
      sideEffectsNoted: row.side_effects_noted,
      notes: row.notes,
      loggedAt: row.logged_at
    })));
  } catch (error) {
    console.error('Fehler beim Abrufen der Einnahmen:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/medications/intake - Einnahme protokollieren
router.post('/intake', authenticateToken, async (req, res) => {
  try {
    const data = intakeLogSchema.parse(req.body);
    
    // Prüfen ob Medikament dem User gehört
    const check = await db.query(
      'SELECT id FROM patient_medications WHERE id = $1 AND patient_id = $2',
      [data.medicationId, req.user.id]
    );
    
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Medikament nicht gefunden' });
    }
    
    const result = await db.query(
      `INSERT INTO medication_intake_log 
       (medication_id, taken, scheduled_time, actual_time, skipped_reason, side_effects_noted, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.medicationId,
        data.taken,
        data.scheduledTime || null,
        data.actualTime || null,
        data.skippedReason || null,
        JSON.stringify(data.sideEffectsNoted || []),
        data.notes || null
      ]
    );
    
    res.status(201).json({
      id: result.rows[0].id,
      taken: result.rows[0].taken,
      loggedAt: result.rows[0].logged_at
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Ungültige Daten', details: error.errors });
    }
    console.error('Fehler beim Protokollieren:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/medications/adherence - Therapietreue-Statistik
router.get('/adherence', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Gesamt-Adherence
    const adherenceResult = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE il.taken = true) as taken_count,
         COUNT(*) as total_count
       FROM medication_intake_log il
       JOIN patient_medications pm ON il.medication_id = pm.id
       WHERE pm.patient_id = $1 
         AND il.logged_at >= NOW() - INTERVAL '${parseInt(days)} days'`,
      [req.user.id]
    );
    
    // Pro Medikament
    const perMedResult = await db.query(
      `SELECT 
         pm.id, pm.name, pm.dosage,
         COUNT(*) FILTER (WHERE il.taken = true) as taken_count,
         COUNT(*) as total_count
       FROM patient_medications pm
       LEFT JOIN medication_intake_log il ON il.medication_id = pm.id 
         AND il.logged_at >= NOW() - INTERVAL '${parseInt(days)} days'
       WHERE pm.patient_id = $1 AND pm.is_active = true
       GROUP BY pm.id, pm.name, pm.dosage`,
      [req.user.id]
    );
    
    // Häufigste Nebenwirkungen
    const sideEffectsResult = await db.query(
      `SELECT il.side_effects_noted
       FROM medication_intake_log il
       JOIN patient_medications pm ON il.medication_id = pm.id
       WHERE pm.patient_id = $1 
         AND il.logged_at >= NOW() - INTERVAL '${parseInt(days)} days'
         AND il.side_effects_noted IS NOT NULL
         AND il.side_effects_noted != '[]'`,
      [req.user.id]
    );
    
    // Nebenwirkungen aggregieren
    const sideEffectCounts = {};
    sideEffectsResult.rows.forEach(row => {
      const effects = typeof row.side_effects_noted === 'string' 
        ? JSON.parse(row.side_effects_noted) 
        : row.side_effects_noted;
      effects.forEach(effect => {
        sideEffectCounts[effect] = (sideEffectCounts[effect] || 0) + 1;
      });
    });
    
    const total = parseInt(adherenceResult.rows[0].total_count) || 0;
    const taken = parseInt(adherenceResult.rows[0].taken_count) || 0;
    
    res.json({
      overall: {
        adherenceRate: total > 0 ? Math.round((taken / total) * 100) : null,
        taken,
        total,
        period: `${days} Tage`
      },
      byMedication: perMedResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        dosage: row.dosage,
        adherenceRate: parseInt(row.total_count) > 0 
          ? Math.round((parseInt(row.taken_count) / parseInt(row.total_count)) * 100)
          : null,
        taken: parseInt(row.taken_count),
        total: parseInt(row.total_count)
      })),
      sideEffects: Object.entries(sideEffectCounts)
        .map(([effect, count]) => ({ effect, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Adherence:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ===== THERAPIST ACCESS =====

// GET /api/medications/patient/:patientId - Patient's Medikamente (Therapeut)
router.get('/patient/:patientId', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const result = await db.query(
      `SELECT * FROM patient_medications 
       WHERE patient_id = $1 
       ORDER BY is_active DESC, name ASC`,
      [patientId]
    );
    
    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      genericName: row.generic_name,
      dosage: row.dosage,
      frequency: row.frequency,
      frequencyDetails: row.frequency_details,
      timing: row.timing,
      prescribedBy: row.prescribed_by,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      category: row.category,
      notes: row.notes,
      sideEffects: row.side_effects,
      isActive: row.is_active,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Fehler beim Abrufen:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/medications/patient/:patientId/adherence - Patient's Therapietreue (Therapeut)
router.get('/patient/:patientId/adherence', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { days = 30 } = req.query;
    
    const adherenceResult = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE il.taken = true) as taken_count,
         COUNT(*) as total_count
       FROM medication_intake_log il
       JOIN patient_medications pm ON il.medication_id = pm.id
       WHERE pm.patient_id = $1 
         AND il.logged_at >= NOW() - INTERVAL '${parseInt(days)} days'`,
      [patientId]
    );
    
    const total = parseInt(adherenceResult.rows[0].total_count) || 0;
    const taken = parseInt(adherenceResult.rows[0].taken_count) || 0;
    
    res.json({
      adherenceRate: total > 0 ? Math.round((taken / total) * 100) : null,
      taken,
      total,
      period: `${days} Tage`
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
