const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { pool } = require('../utils/db');
const { authenticateToken, requireTherapist } = require('../middleware/auth');

// ===== ICD-10-GM KAPITEL F (Psychische Störungen) - Auszug =====
const ICD_10_F_CODES = [
  // F00-F09: Organische Störungen
  { code: 'F00', name: 'Demenz bei Alzheimer-Krankheit', category: 'Organische Störungen' },
  { code: 'F01', name: 'Vaskuläre Demenz', category: 'Organische Störungen' },
  { code: 'F06', name: 'Andere psychische Störungen aufgrund einer Schädigung des Gehirns', category: 'Organische Störungen' },
  
  // F10-F19: Psychische Störungen durch psychotrope Substanzen
  { code: 'F10', name: 'Psychische und Verhaltensstörungen durch Alkohol', category: 'Substanzstörungen' },
  { code: 'F11', name: 'Psychische und Verhaltensstörungen durch Opioide', category: 'Substanzstörungen' },
  { code: 'F12', name: 'Psychische und Verhaltensstörungen durch Cannabinoide', category: 'Substanzstörungen' },
  { code: 'F13', name: 'Psychische und Verhaltensstörungen durch Sedativa oder Hypnotika', category: 'Substanzstörungen' },
  { code: 'F17', name: 'Psychische und Verhaltensstörungen durch Tabak', category: 'Substanzstörungen' },
  
  // F20-F29: Schizophrenie
  { code: 'F20.0', name: 'Paranoide Schizophrenie', category: 'Schizophrenie' },
  { code: 'F20.1', name: 'Hebephrene Schizophrenie', category: 'Schizophrenie' },
  { code: 'F21', name: 'Schizotype Störung', category: 'Schizophrenie' },
  { code: 'F22', name: 'Anhaltende wahnhafte Störung', category: 'Schizophrenie' },
  { code: 'F23', name: 'Akute vorübergehende psychotische Störung', category: 'Schizophrenie' },
  { code: 'F25', name: 'Schizoaffektive Störung', category: 'Schizophrenie' },
  
  // F30-F39: Affektive Störungen
  { code: 'F31', name: 'Bipolare affektive Störung', category: 'Affektive Störungen' },
  { code: 'F32.0', name: 'Leichte depressive Episode', category: 'Affektive Störungen' },
  { code: 'F32.1', name: 'Mittelgradige depressive Episode', category: 'Affektive Störungen' },
  { code: 'F32.2', name: 'Schwere depressive Episode ohne psychotische Symptome', category: 'Affektive Störungen' },
  { code: 'F32.3', name: 'Schwere depressive Episode mit psychotischen Symptomen', category: 'Affektive Störungen' },
  { code: 'F33.0', name: 'Rezidivierende depressive Störung, gegenwärtig leichte Episode', category: 'Affektive Störungen' },
  { code: 'F33.1', name: 'Rezidivierende depressive Störung, gegenwärtig mittelgradige Episode', category: 'Affektive Störungen' },
  { code: 'F33.2', name: 'Rezidivierende depressive Störung, gegenwärtig schwere Episode', category: 'Affektive Störungen' },
  { code: 'F34.1', name: 'Dysthymia', category: 'Affektive Störungen' },
  
  // F40-F48: Neurotische, Belastungs- und somatoforme Störungen
  { code: 'F40.0', name: 'Agoraphobie', category: 'Angststörungen' },
  { code: 'F40.1', name: 'Soziale Phobien', category: 'Angststörungen' },
  { code: 'F40.2', name: 'Spezifische (isolierte) Phobien', category: 'Angststörungen' },
  { code: 'F41.0', name: 'Panikstörung', category: 'Angststörungen' },
  { code: 'F41.1', name: 'Generalisierte Angststörung', category: 'Angststörungen' },
  { code: 'F41.2', name: 'Angst und depressive Störung, gemischt', category: 'Angststörungen' },
  { code: 'F42', name: 'Zwangsstörung', category: 'Angststörungen' },
  { code: 'F43.0', name: 'Akute Belastungsreaktion', category: 'Belastungsstörungen' },
  { code: 'F43.1', name: 'Posttraumatische Belastungsstörung', category: 'Belastungsstörungen' },
  { code: 'F43.2', name: 'Anpassungsstörungen', category: 'Belastungsstörungen' },
  { code: 'F44', name: 'Dissoziative Störungen', category: 'Dissoziative Störungen' },
  { code: 'F45.0', name: 'Somatisierungsstörung', category: 'Somatoforme Störungen' },
  { code: 'F45.2', name: 'Hypochondrische Störung', category: 'Somatoforme Störungen' },
  { code: 'F45.4', name: 'Anhaltende somatoforme Schmerzstörung', category: 'Somatoforme Störungen' },
  
  // F50-F59: Verhaltensauffälligkeiten mit körperlichen Störungen
  { code: 'F50.0', name: 'Anorexia nervosa', category: 'Essstörungen' },
  { code: 'F50.2', name: 'Bulimia nervosa', category: 'Essstörungen' },
  { code: 'F50.8', name: 'Sonstige Essstörungen (inkl. Binge-Eating)', category: 'Essstörungen' },
  { code: 'F51.0', name: 'Nichtorganische Insomnie', category: 'Schlafstörungen' },
  
  // F60-F69: Persönlichkeitsstörungen
  { code: 'F60.0', name: 'Paranoide Persönlichkeitsstörung', category: 'Persönlichkeitsstörungen' },
  { code: 'F60.1', name: 'Schizoide Persönlichkeitsstörung', category: 'Persönlichkeitsstörungen' },
  { code: 'F60.2', name: 'Dissoziale Persönlichkeitsstörung', category: 'Persönlichkeitsstörungen' },
  { code: 'F60.3', name: 'Emotional instabile Persönlichkeitsstörung', category: 'Persönlichkeitsstörungen' },
  { code: 'F60.31', name: 'Emotional instabile PS, Borderline-Typ', category: 'Persönlichkeitsstörungen' },
  { code: 'F60.4', name: 'Histrionische Persönlichkeitsstörung', category: 'Persönlichkeitsstörungen' },
  { code: 'F60.5', name: 'Anankastische Persönlichkeitsstörung', category: 'Persönlichkeitsstörungen' },
  { code: 'F60.6', name: 'Ängstliche (vermeidende) Persönlichkeitsstörung', category: 'Persönlichkeitsstörungen' },
  { code: 'F60.7', name: 'Abhängige Persönlichkeitsstörung', category: 'Persönlichkeitsstörungen' },
  { code: 'F60.8', name: 'Sonstige spezifische Persönlichkeitsstörungen (Narzissmus)', category: 'Persönlichkeitsstörungen' },
  { code: 'F61', name: 'Kombinierte und andere Persönlichkeitsstörungen', category: 'Persönlichkeitsstörungen' },
  
  // F90-F98: Verhaltens- und emotionale Störungen (Kindheit)
  { code: 'F90.0', name: 'Einfache Aktivitäts- und Aufmerksamkeitsstörung (ADHS)', category: 'ADHS' },
  { code: 'F90.1', name: 'Hyperkinetische Störung des Sozialverhaltens', category: 'ADHS' },
  { code: 'F91', name: 'Störungen des Sozialverhaltens', category: 'Verhaltensstörungen' },
  { code: 'F93', name: 'Emotionale Störungen des Kindesalters', category: 'Verhaltensstörungen' },
  
  // Sonstige
  { code: 'F99', name: 'Psychische Störung ohne nähere Angabe', category: 'Sonstige' },
];

// ===== VALIDATION =====
const DiagnosisSchema = z.object({
  patientId: z.string().uuid(),
  icdCode: z.string().min(3).max(10),
  icdName: z.string().max(200),
  diagnosisType: z.enum(['confirmed', 'suspected', 'differential', 'history']),
  severity: z.enum(['mild', 'moderate', 'severe']).optional(),
  notes: z.string().max(1000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

// ===== ROUTES =====

/**
 * GET /api/diagnoses/icd-codes
 * Sucht ICD-10 Codes
 */
router.get('/icd-codes', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const { search, category } = req.query;
    
    let results = ICD_10_F_CODES;
    
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(
        (c) =>
          c.code.toLowerCase().includes(searchLower) ||
          c.name.toLowerCase().includes(searchLower)
      );
    }
    
    if (category) {
      results = results.filter((c) => c.category === category);
    }
    
    res.json({
      codes: results.slice(0, 50),
      categories: [...new Set(ICD_10_F_CODES.map((c) => c.category))],
    });
  } catch (error) {
    console.error('Fehler bei ICD-Suche:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * POST /api/diagnoses
 * Erstellt eine neue Diagnose für einen Patienten
 */
router.post('/', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const validated = DiagnosisSchema.parse(req.body);
    const therapistId = req.user.id;

    // Behandlungsbeziehung prüfen
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

    // Wenn isPrimary, andere primäre Diagnosen zurücksetzen
    if (validated.isPrimary) {
      await pool.query(
        `UPDATE patient_diagnoses SET is_primary = FALSE 
         WHERE patient_id = $1 AND therapist_id = $2`,
        [validated.patientId, therapistId]
      );
    }

    const result = await pool.query(
      `INSERT INTO patient_diagnoses (
        patient_id, therapist_id, icd_code, icd_name,
        diagnosis_type, severity, notes,
        start_date, end_date, is_primary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        validated.patientId,
        therapistId,
        validated.icdCode,
        validated.icdName,
        validated.diagnosisType,
        validated.severity || null,
        validated.notes || null,
        validated.startDate || null,
        validated.endDate || null,
        validated.isPrimary || false,
      ]
    );

    res.status(201).json({
      message: 'Diagnose hinzugefügt',
      diagnosis: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    }
    console.error('Fehler beim Erstellen der Diagnose:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/diagnoses/patient/:patientId
 * Holt alle Diagnosen eines Patienten
 */
router.get('/patient/:patientId', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const { patientId } = req.params;
    const therapistId = req.user.id;

    const result = await pool.query(
      `SELECT pd.*, u.first_name, u.last_name
       FROM patient_diagnoses pd
       JOIN users u ON pd.patient_id = u.id
       WHERE pd.patient_id = $1 AND pd.therapist_id = $2
       ORDER BY pd.is_primary DESC, pd.created_at DESC`,
      [patientId, therapistId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fehler beim Laden der Diagnosen:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * PUT /api/diagnoses/:id
 * Aktualisiert eine Diagnose
 */
router.put('/:id', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const { id } = req.params;
    const therapistId = req.user.id;
    const validated = DiagnosisSchema.partial().parse(req.body);

    // Ownership check
    const existing = await pool.query(
      `SELECT id, patient_id FROM patient_diagnoses WHERE id = $1 AND therapist_id = $2`,
      [id, therapistId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Diagnose nicht gefunden' });
    }

    // Wenn auf isPrimary gesetzt, andere zurücksetzen
    if (validated.isPrimary) {
      await pool.query(
        `UPDATE patient_diagnoses SET is_primary = FALSE 
         WHERE patient_id = $1 AND therapist_id = $2 AND id != $3`,
        [existing.rows[0].patient_id, therapistId, id]
      );
    }

    const updateFields = [];
    const values = [];
    let paramCount = 0;

    const fieldMapping = {
      diagnosisType: 'diagnosis_type',
      severity: 'severity',
      notes: 'notes',
      startDate: 'start_date',
      endDate: 'end_date',
      isPrimary: 'is_primary',
    };

    for (const [jsField, dbField] of Object.entries(fieldMapping)) {
      if (validated[jsField] !== undefined) {
        paramCount++;
        updateFields.push(`${dbField} = $${paramCount}`);
        values.push(validated[jsField]);
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
      `UPDATE patient_diagnoses SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    res.json({ message: 'Diagnose aktualisiert' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    }
    console.error('Fehler beim Aktualisieren:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * DELETE /api/diagnoses/:id
 * Löscht eine Diagnose (Soft-Delete empfohlen für klinische Daten)
 */
router.delete('/:id', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const { id } = req.params;
    const therapistId = req.user.id;

    // Soft Delete: Setze end_date statt echtem Löschen
    const result = await pool.query(
      `UPDATE patient_diagnoses SET 
        end_date = CURRENT_DATE,
        diagnosis_type = 'history',
        updated_at = NOW()
       WHERE id = $1 AND therapist_id = $2 
       RETURNING id`,
      [id, therapistId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Diagnose nicht gefunden' });
    }

    res.json({ message: 'Diagnose archiviert' });
  } catch (error) {
    console.error('Fehler beim Archivieren:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/diagnoses/statistics/:patientId
 * Gibt Diagnose-Statistiken für einen Patienten
 */
router.get('/statistics/:patientId', authenticateToken, requireTherapist, async (req, res) => {
  try {
    const { patientId } = req.params;
    const therapistId = req.user.id;

    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_diagnoses,
        COUNT(*) FILTER (WHERE diagnosis_type = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE diagnosis_type = 'suspected') as suspected,
        COUNT(*) FILTER (WHERE is_primary = TRUE) as primary_count,
        array_agg(DISTINCT icd_code) as all_codes
       FROM patient_diagnoses
       WHERE patient_id = $1 AND therapist_id = $2`,
      [patientId, therapistId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Fehler bei Statistiken:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
