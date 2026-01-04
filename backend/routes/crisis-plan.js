const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { pool } = require('../utils/db');
const { authenticateToken, requirePatient, requireTherapist } = require('../middleware/auth');
const crypto = require('crypto');

// Encryption (same as therapy-notes)
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

// ===== VALIDATION =====
const CrisisPlanSchema = z.object({
  // Warnsignale
  warningSignsThoughts: z.array(z.string()).optional(),
  warningSignsBehaviors: z.array(z.string()).optional(),
  warningSignsPhysical: z.array(z.string()).optional(),
  warningSignsEmotional: z.array(z.string()).optional(),
  
  // Bewältigungsstrategien
  copingStrategies: z.array(z.object({
    strategy: z.string(),
    category: z.enum(['distraction', 'relaxation', 'social', 'physical', 'cognitive', 'other']),
    effectiveness: z.number().min(1).max(5).optional(),
  })).optional(),
  
  // Sichere Umgebung
  safeEnvironmentSteps: z.array(z.string()).optional(),
  itemsToRemove: z.array(z.string()).optional(),
  safePlace: z.string().optional(),
  
  // Unterstützungsnetzwerk
  emergencyContacts: z.array(z.object({
    name: z.string(),
    relationship: z.string(),
    phone: z.string(),
    availableWhen: z.string().optional(),
  })).optional(),
  
  professionalContacts: z.array(z.object({
    name: z.string(),
    role: z.string(),
    phone: z.string(),
    organization: z.string().optional(),
  })).optional(),
  
  // Gründe zum Leben
  reasonsToLive: z.array(z.string()).optional(),
  
  // Krisenhotlines
  crisisHotlines: z.array(z.object({
    name: z.string(),
    phone: z.string(),
    available: z.string().optional(),
  })).optional(),
  
  // Zusätzliche Notizen
  additionalNotes: z.string().optional(),
});

// ===== DEFAULT CRISIS HOTLINES (Germany) =====
const DEFAULT_HOTLINES = [
  { name: 'Telefonseelsorge (evangelisch)', phone: '0800 111 0 111', available: '24/7, kostenlos' },
  { name: 'Telefonseelsorge (katholisch)', phone: '0800 111 0 222', available: '24/7, kostenlos' },
  { name: 'Kinder- und Jugendtelefon', phone: '116 111', available: 'Mo-Sa 14-20 Uhr' },
  { name: 'Psychiatrischer Notdienst', phone: '112', available: '24/7' },
];

// ===== ROUTES =====

/**
 * GET /api/crisis-plan/defaults
 * Liefert Standard-Krisenhotlines und Vorschläge
 */
router.get('/defaults', authenticateToken, async (req, res) => {
  try {
    res.json({
      crisisHotlines: DEFAULT_HOTLINES,
      copingCategories: [
        { id: 'distraction', name: 'Ablenkung', examples: ['Musik hören', 'Spazieren gehen', 'Rätsel lösen'] },
        { id: 'relaxation', name: 'Entspannung', examples: ['Tiefes Atmen', 'Progressive Muskelentspannung', 'Meditation'] },
        { id: 'social', name: 'Sozial', examples: ['Freund anrufen', 'Familie besuchen', 'Selbsthilfegruppe'] },
        { id: 'physical', name: 'Körperlich', examples: ['Sport', 'Kaltes Wasser', 'Eiswürfel halten'] },
        { id: 'cognitive', name: 'Gedanklich', examples: ['Positives Selbstgespräch', 'Gedanken aufschreiben', 'Faktencheck'] },
      ],
      warningSignExamples: {
        thoughts: ['Alles ist hoffnungslos', 'Niemand versteht mich', 'Ich bin eine Last'],
        behaviors: ['Sozialer Rückzug', 'Vernachlässigung der Hygiene', 'Alkohol-/Drogenkonsum'],
        physical: ['Schlafstörungen', 'Appetitveränderungen', 'Herzrasen'],
        emotional: ['Überwältigende Traurigkeit', 'Wut', 'Taubheit/Leere'],
      },
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * POST /api/crisis-plan
 * Erstellt oder aktualisiert den Krisenplan des Patienten
 */
router.post('/', authenticateToken, requirePatient, async (req, res) => {
  try {
    const validated = CrisisPlanSchema.parse(req.body);
    const patientId = req.user.id;

    // Prüfen ob bereits ein Plan existiert
    const existing = await pool.query(
      `SELECT id FROM crisis_plans WHERE patient_id = $1`,
      [patientId]
    );

    const encryptedData = encrypt(JSON.stringify(validated));

    if (existing.rows.length > 0) {
      // Update
      await pool.query(
        `UPDATE crisis_plans SET 
          plan_data_encrypted = $1,
          updated_at = NOW()
         WHERE patient_id = $2`,
        [encryptedData, patientId]
      );
      res.json({ message: 'Krisenplan aktualisiert' });
    } else {
      // Insert
      await pool.query(
        `INSERT INTO crisis_plans (patient_id, plan_data_encrypted)
         VALUES ($1, $2)`,
        [patientId, encryptedData]
      );
      res.status(201).json({ message: 'Krisenplan erstellt' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    }
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/crisis-plan
 * Holt den eigenen Krisenplan (Patient)
 */
router.get('/', authenticateToken, requirePatient, async (req, res) => {
  try {
    const patientId = req.user.id;

    const result = await pool.query(
      `SELECT * FROM crisis_plans WHERE patient_id = $1`,
      [patientId]
    );

    if (result.rows.length === 0) {
      return res.json({ exists: false, plan: null });
    }

    const row = result.rows[0];
    const decryptedData = decrypt(row.plan_data_encrypted);

    res.json({
      exists: true,
      plan: decryptedData ? JSON.parse(decryptedData) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/crisis-plan/patient/:patientId
 * Therapeut sieht Krisenplan eines Patienten
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
      `SELECT cp.*, u.first_name, u.last_name
       FROM crisis_plans cp
       JOIN users u ON cp.patient_id = u.id
       WHERE cp.patient_id = $1`,
      [patientId]
    );

    if (result.rows.length === 0) {
      return res.json({ 
        exists: false, 
        message: 'Patient hat noch keinen Krisenplan erstellt' 
      });
    }

    const row = result.rows[0];
    const decryptedData = decrypt(row.plan_data_encrypted);

    res.json({
      exists: true,
      patientName: `${row.first_name} ${row.last_name}`,
      plan: decryptedData ? JSON.parse(decryptedData) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * POST /api/crisis-plan/share/:therapistId
 * Patient teilt Krisenplan mit Therapeut
 */
router.post('/share/:therapistId', authenticateToken, requirePatient, async (req, res) => {
  try {
    const patientId = req.user.id;
    const { therapistId } = req.params;

    // Krisenplan existiert?
    const plan = await pool.query(
      `SELECT id FROM crisis_plans WHERE patient_id = $1`,
      [patientId]
    );

    if (plan.rows.length === 0) {
      return res.status(404).json({ error: 'Kein Krisenplan vorhanden' });
    }

    // Share-Eintrag erstellen
    await pool.query(
      `INSERT INTO crisis_plan_shares (crisis_plan_id, therapist_id)
       VALUES ($1, $2)
       ON CONFLICT (crisis_plan_id, therapist_id) DO NOTHING`,
      [plan.rows[0].id, therapistId]
    );

    res.json({ message: 'Krisenplan geteilt' });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * GET /api/crisis-plan/quick-access
 * Schnellzugriff auf Notfallkontakte (für Krisensituationen)
 */
router.get('/quick-access', authenticateToken, requirePatient, async (req, res) => {
  try {
    const patientId = req.user.id;

    const result = await pool.query(
      `SELECT plan_data_encrypted FROM crisis_plans WHERE patient_id = $1`,
      [patientId]
    );

    // Immer Hotlines zurückgeben
    const response = {
      crisisHotlines: DEFAULT_HOTLINES,
      emergencyContacts: [],
      professionalContacts: [],
      topCopingStrategies: [],
    };

    if (result.rows.length > 0) {
      const decrypted = decrypt(result.rows[0].plan_data_encrypted);
      if (decrypted) {
        const plan = JSON.parse(decrypted);
        response.emergencyContacts = plan.emergencyContacts || [];
        response.professionalContacts = plan.professionalContacts || [];
        response.topCopingStrategies = (plan.copingStrategies || [])
          .filter((s) => s.effectiveness >= 4)
          .slice(0, 5);
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
