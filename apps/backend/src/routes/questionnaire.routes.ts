/**
 * Questionnaire Routes - Dynamic Form Builder System
 * DSGVO-konform: Art. 9 (Gesundheitsdaten), Art. 25 (Privacy by Design)
 * 
 * Features:
 * - Therapeut erstellt Fragebogen-Templates (JSON-Schema)
 * - Therapeut fordert Fragebogen von Patienten an
 * - Patient füllt Fragebogen aus (verschlüsselte Antworten)
 * - Dynamische Formular-Typen: text, textarea, radio, checkbox, select, number, date
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';
import { ocrPdfBufferToText } from '../utils/ocr.js';

const router = Router();

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Nur PDF-Dateien sind erlaubt'));
    }
  },
});

type SuggestedField = {
  id: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'select' | 'number' | 'date' | 'email' | 'tel';
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
};

function slugId(prefix: string, n: number): string {
  return `${prefix}-${Date.now()}-${n}`;
}

function suggestFieldsFromText(
  text: string,
  opts: { allowFallback?: boolean } = {}
): SuggestedField[] {
  // MVP: heuristisch, DSGVO-safe (keine Logs des Texts)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 500);

  const fields: SuggestedField[] = [];

  let currentQuestion: { label: string; options: string[] } | null = null;
  const flushQuestion = () => {
    if (!currentQuestion) return;
    const options = currentQuestion.options.map((o) => o.trim()).filter(Boolean);
    if (options.length >= 2) {
      fields.push({
        id: slugId('field', fields.length + 1),
        type: options.length <= 5 ? 'radio' : 'select',
        label: currentQuestion.label,
        required: false,
        options,
      });
    } else {
      fields.push({
        id: slugId('field', fields.length + 1),
        type: 'text',
        label: currentQuestion.label,
        required: false,
      });
    }
    currentQuestion = null;
  };

  for (const line of lines) {
    // Checkbox style: "☐ Option" / "[ ] Option" / "□ Option"
    const checkboxMatch = line.match(/^(?:\[\s*\]|☐|□)\s*(.+)$/);
    if (checkboxMatch) {
      if (!currentQuestion) {
        currentQuestion = { label: 'Auswahl', options: [] };
      }
      currentQuestion.options.push(checkboxMatch[1]);
      continue;
    }

    // Bullet options under a question
    const bulletMatch = line.match(/^(?:[-•*]|\d+\.)\s+(.+)$/);
    if (bulletMatch && currentQuestion) {
      currentQuestion.options.push(bulletMatch[1]);
      continue;
    }

    // Question-like label
    const isQuestion = /\?$/.test(line) || /:$/.test(line);
    if (isQuestion) {
      flushQuestion();

      const label = line.replace(/[:?]\s*$/, '').trim();
      if (!label) continue;

      // Simple typed hints
      const lower = label.toLowerCase();
      if (/(e-?mail)/.test(lower)) {
        fields.push({ id: slugId('field', fields.length + 1), type: 'email', label, required: false });
        continue;
      }
      if (/(telefon|tel\b|handy)/.test(lower)) {
        fields.push({ id: slugId('field', fields.length + 1), type: 'tel', label, required: false });
        continue;
      }
      if (/(datum|geburt)/.test(lower)) {
        fields.push({ id: slugId('field', fields.length + 1), type: 'date', label, required: false });
        continue;
      }

      // Start collecting options for potential choice question
      currentQuestion = { label, options: [] };
      continue;
    }

    // Inline yes/no
    if (currentQuestion && /\b(ja)\b.*\b(nein)\b/i.test(line)) {
      currentQuestion.options.push('Ja');
      currentQuestion.options.push('Nein');
      flushQuestion();
      continue;
    }
  }

  flushQuestion();

  // Fallback: if nothing parsed, create a single textarea
  if (fields.length === 0 && opts.allowFallback !== false) {
    return [
      {
        id: slugId('field', 1),
        type: 'textarea',
        label: 'Antwort',
        required: false,
        placeholder: 'Bitte ausfüllen',
      },
    ];
  }

  // Limit count to keep UI usable
  return fields.slice(0, 60);
}

async function enqueueNotificationStub(targetUserId: string, payload: Record<string, any>): Promise<void> {
  logger.info(`Notification stub queued for user ${targetUserId}`, payload);
}

// ═══════════════════════════════════════════════════════════════
// POST /api/questionnaires/templates/import-pdf - Import Template from PDF (Therapeut, MVP)
// ═══════════════════════════════════════════════════════════════
router.post(
  '/templates/import-pdf',
  authenticate,
  pdfUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const userRole = (req as any).userRole;
      if (userRole !== 'therapist') {
        return res.status(403).json({ error: 'Nur Therapeuten können PDF-Vorlagen importieren' });
      }

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ error: 'Datei fehlt' });
      }

      const parsed = await pdfParse(file.buffer);
      let text = (parsed?.text || '').trim();

      const OCR_MAX_PAGES = 10;
      const OCR_SOFT_PAGE_LIMIT = 30;

      const pdfPages =
        typeof (parsed as any)?.numpages === 'number' && Number.isFinite((parsed as any).numpages)
          ? (parsed as any).numpages
          : undefined;

      const meta: {
        usedOcr: boolean;
        pdfPages?: number;
        ocrPagesProcessed?: number;
        ocrTruncated?: boolean;
      } = { usedOcr: false, ...(pdfPages ? { pdfPages } : {}) };

      let warning: string | null = null;
      const looksLikeScan = !text || text.length < 30;
      let allowFallback = true;

      if (looksLikeScan) {
        // Klare User-Info statt „hängt einfach“: extrem lange PDFs nicht OCRen
        if (pdfPages && pdfPages > OCR_SOFT_PAGE_LIMIT) {
          warning = `PDF hat ${pdfPages} Seiten. Für OCR sind nur bis zu ${OCR_MAX_PAGES} Seiten sinnvoll. Bitte PDF kürzen oder relevante Seiten extrahieren.`;
          allowFallback = false;
        }

        try {
          if (!allowFallback) {
            // OCR wird bewusst nicht versucht
          } else {
            const ocr = await ocrPdfBufferToText(file.buffer, {
              language: 'deu',
              maxPages: OCR_MAX_PAGES,
              dpi: 200,
              timeoutMs: 60_000,
              perPageTimeoutMs: 15_000,
              maxTextChars: 50_000,
            });

            const ocrText = (ocr.text || '').trim();
            if (ocrText) {
              text = ocrText;
              meta.usedOcr = true;
              meta.ocrPagesProcessed = ocr.pagesProcessed;
              if (ocr.truncated) meta.ocrTruncated = true;

              const pieces: string[] = [];
              pieces.push('OCR-Fallback (deu) verwendet. Bitte Ergebnisse sorgfältig prüfen.');
              if (pdfPages && pdfPages > OCR_MAX_PAGES) {
                pieces.push(`OCR hat nur die ersten ${OCR_MAX_PAGES} Seiten verarbeitet (von ${pdfPages}).`);
              }
              if (ocr.truncated) {
                pieces.push('OCR-Text wurde aus Sicherheits-/Performance-Gründen gekürzt.');
              }
              warning = pieces.join(' ');
            } else {
              warning = 'PDF enthält keinen gut extrahierbaren Text (Scan) und OCR lieferte kein Ergebnis.';
              allowFallback = false;
            }
          }
        } catch (error: any) {
          // DSGVO: niemals OCR-/PDF-Text loggen
          if (error?.code === 'ENOENT') {
            warning = 'PDF wirkt wie ein Scan, aber OCR ist auf dem Server nicht verfügbar. Bitte Admin kontaktieren.';
            allowFallback = false;
          } else if (error?.killed || error?.signal || /timed? out/i.test(String(error?.message || ''))) {
            warning = 'OCR dauerte zu lange. Bitte PDF verkleinern oder Seiten reduzieren.';
            allowFallback = false;
          } else {
            warning = 'PDF wirkt wie ein Scan, aber OCR-Fallback ist fehlgeschlagen. Bitte manuell prüfen.';
            allowFallback = false;
          }
        }
      }

      const fields = suggestFieldsFromText(text, { allowFallback });
      const titleFromName = (file.originalname || 'Vorlage').replace(/\.[^.]+$/, '').trim();

      return res.json({
        warning,
        meta,
        suggested: {
          title: titleFromName || 'Vorlage (Import)',
          description: 'Import aus PDF (bitte prüfen/korregieren)',
          formSchema: { fields },
        },
      });
    } catch (error) {
      return next(error);
    }
  },
  (err: any, _req: Request, res: Response, next: NextFunction) => {
    // Multer errors (klare Fehlermeldungen statt generischer 500)
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'PDF ist zu groß (max. 10MB).' });
    }
    if (typeof err?.message === 'string' && err.message.includes('Nur PDF-Dateien')) {
      return res.status(400).json({ error: 'Nur PDF-Dateien sind erlaubt.' });
    }
    return next(err);
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /api/questionnaires/templates - Create Template (Therapeut)
// ═══════════════════════════════════════════════════════════════
router.post('/templates', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;

  if (userRole !== 'therapist') {
    return res.status(403).json({ error: 'Nur Therapeuten können Templates erstellen' });
  }

  const { title, description, category, formSchema, isTemplate = true } = req.body;

  // Validierung
  if (!title || !formSchema || !Array.isArray(formSchema.fields)) {
    return res.status(400).json({ error: 'Titel und Form-Schema (fields) erforderlich' });
  }

  // Validate form schema structure
  for (const field of formSchema.fields) {
    if (!field.id || !field.type || !field.label) {
      return res.status(400).json({ 
        error: 'Jedes Feld benötigt id, type und label' 
      });
    }

    const validTypes = ['text', 'textarea', 'radio', 'checkbox', 'select', 'number', 'date', 'email', 'tel'];
    if (!validTypes.includes(field.type)) {
      return res.status(400).json({ 
        error: `Ungültiger Feldtyp: ${field.type}. Erlaubt: ${validTypes.join(', ')}` 
      });
    }

    // Radio, checkbox, select benötigen options
    if (['radio', 'checkbox', 'select'].includes(field.type) && !Array.isArray(field.options)) {
      return res.status(400).json({ 
        error: `Feld "${field.label}" (${field.type}) benötigt options-Array` 
      });
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO questionnaire_templates (
        therapist_id, title, description, category, form_schema, is_template
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at`,
      [userId, title, description || null, category || null, JSON.stringify(formSchema), isTemplate]
    );

    res.status(201).json({
      id: result.rows[0].id,
      title,
      createdAt: result.rows[0].created_at,
      message: 'Template erfolgreich erstellt'
    });
  } catch (error: any) {
    logger.error('Error creating questionnaire template:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Templates' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUT /api/questionnaires/templates/:id - Update Template (Therapeut)
// ═══════════════════════════════════════════════════════════════
router.put('/templates/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { id } = req.params;

  if (userRole !== 'therapist') {
    return res.status(403).json({ error: 'Nur Therapeuten können Templates bearbeiten' });
  }

  const { title, description, category, formSchema } = req.body;

  if (!title || !formSchema || !Array.isArray(formSchema.fields)) {
    return res.status(400).json({ error: 'Titel und Form-Schema (fields) erforderlich' });
  }

  for (const field of formSchema.fields) {
    if (!field.id || !field.type || !field.label) {
      return res.status(400).json({ error: 'Jedes Feld benötigt id, type und label' });
    }

    const validTypes = ['text', 'textarea', 'radio', 'checkbox', 'select', 'number', 'date', 'email', 'tel'];
    if (!validTypes.includes(field.type)) {
      return res.status(400).json({ error: `Ungültiger Feldtyp: ${field.type}. Erlaubt: ${validTypes.join(', ')}` });
    }

    if (['radio', 'checkbox', 'select'].includes(field.type) && !Array.isArray(field.options)) {
      return res.status(400).json({ error: `Feld "${field.label}" (${field.type}) benötigt options-Array` });
    }
  }

  try {
    const ownership = await pool.query(
      `SELECT id FROM questionnaire_templates WHERE id = $1 AND therapist_id = $2 AND is_active = TRUE`,
      [id, userId]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({ error: 'Template nicht gefunden' });
    }

    await pool.query(
      `UPDATE questionnaire_templates
       SET title = $1, description = $2, category = $3, form_schema = $4
       WHERE id = $5 AND therapist_id = $6`,
      [title, description || null, category || null, JSON.stringify(formSchema), id, userId]
    );

    res.json({ message: 'Template erfolgreich aktualisiert' });
  } catch (error: any) {
    logger.error('Error updating questionnaire template:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Templates' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/questionnaires/templates - Liste Templates (Therapeut)
// ═══════════════════════════════════════════════════════════════
router.get('/templates', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;

  if (userRole !== 'therapist') {
    return res.status(403).json({ error: 'Nur Therapeuten können Templates abrufen' });
  }

  try {
    const result = await pool.query(
      `SELECT 
        id, title, description, category, form_schema,
        is_template, is_active, usage_count, last_used_at, created_at
      FROM questionnaire_templates
      WHERE therapist_id = $1 AND is_active = TRUE
      ORDER BY last_used_at DESC NULLS LAST, created_at DESC`,
      [userId]
    );

    const templates = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      formSchema: row.form_schema,
      isTemplate: row.is_template,
      usageCount: row.usage_count,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at
    }));

    res.json({ templates });
  } catch (error: any) {
    logger.error('Error fetching questionnaire templates:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Templates' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/questionnaires/templates/:id - Get Template Details
// ═══════════════════════════════════════════════════════════════
router.get('/templates/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { id } = req.params;

  if (userRole !== 'therapist') {
    return res.status(403).json({ error: 'Nur Therapeuten können Templates abrufen' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM questionnaire_templates WHERE id = $1 AND therapist_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template nicht gefunden' });
    }

    const template = result.rows[0];
    res.json({
      id: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      formSchema: template.form_schema,
      isTemplate: template.is_template,
      usageCount: template.usage_count,
      lastUsedAt: template.last_used_at,
      createdAt: template.created_at
    });
  } catch (error: any) {
    logger.error('Error fetching questionnaire template:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Templates' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/questionnaires/requests - Request Questionnaire (Therapeut)
// ═══════════════════════════════════════════════════════════════
router.post('/requests', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;

  if (userRole !== 'therapist') {
    return next(new AppError('Nur Therapeuten können Fragebögen anfordern', 403));
  }

  const { 
    templateId, 
    patientId, 
    appointmentId, 
    title, 
    instructions, 
    deadline,
    priority = 'normal' 
  } = req.body;

  // Validierung
  if (!templateId || !patientId || !title) {
    return next(new AppError('Template-ID, Patienten-ID und Titel erforderlich', 400));
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify template exists and belongs to therapist
    const templateCheck = await client.query(
      `SELECT id FROM questionnaire_templates WHERE id = $1 AND therapist_id = $2`,
      [templateId, userId]
    );

    if (templateCheck.rows.length === 0) {
      throw new AppError('Template nicht gefunden', 404);
    }

    // Verify patient exists
    const patientCheck = await client.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'patient'`,
      [patientId]
    );

    if (patientCheck.rows.length === 0) {
      throw new AppError('Patient nicht gefunden', 404);
    }

    // Insert request
    const result = await client.query(
      `INSERT INTO questionnaire_requests (
        questionnaire_template_id, therapist_id, patient_id, appointment_id,
        title, instructions, deadline, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, created_at`,
      [
        templateId, 
        userId, 
        patientId, 
        appointmentId || null,
        title,
        instructions || null,
        deadline || null,
        priority
      ]
    );

    // Update template usage count
    await client.query(
      `UPDATE questionnaire_templates 
       SET usage_count = usage_count + 1, last_used_at = NOW()
       WHERE id = $1`,
      [templateId]
    );

    await client.query('COMMIT');

    // Notifications can happen after commit
    enqueueNotificationStub(patientId, {
      type: 'questionnaire-request',
      requestId: result.rows[0].id,
      title,
      deadline,
      priority
    }).catch(err => logger.error('Notification failed', err));

    res.status(201).json({
      id: result.rows[0].id,
      createdAt: result.rows[0].created_at,
      message: 'Fragebogen erfolgreich angefordert'
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/questionnaires/requests - Liste Requests
// ═══════════════════════════════════════════════════════════════
router.get('/requests', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { status } = req.query;

  try {
    let query;
    let params: any[];

    if (userRole === 'patient') {
      // Patient sieht nur an ihn gerichtete Requests
      query = `
        SELECT 
          qr.id, qr.title, qr.instructions, qr.deadline, qr.priority,
          qr.status, qr.created_at,
          qt.title as template_title, qt.form_schema,
          u.first_name_encrypted, u.last_name_encrypted
        FROM questionnaire_requests qr
        JOIN questionnaire_templates qt ON qr.questionnaire_template_id = qt.id
        JOIN users u ON qr.therapist_id = u.id
        WHERE qr.patient_id = $1
        ${status ? 'AND qr.status = $2' : ''}
        ORDER BY 
          CASE qr.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
          END,
          qr.created_at DESC
      `;
      params = status ? [userId, status] : [userId];
    } else if (userRole === 'therapist') {
      // Therapeut sieht nur eigene Requests
      query = `
        SELECT 
          qr.id, qr.title, qr.instructions, qr.deadline, qr.priority,
          qr.status, qr.created_at, qr.completed_at,
          qt.title as template_title,
          u.first_name_encrypted, u.last_name_encrypted
        FROM questionnaire_requests qr
        JOIN questionnaire_templates qt ON qr.questionnaire_template_id = qt.id
        JOIN users u ON qr.patient_id = u.id
        WHERE qr.therapist_id = $1
        ${status ? 'AND qr.status = $2' : ''}
        ORDER BY qr.created_at DESC
      `;
      params = status ? [userId, status] : [userId];
    } else {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    const result = await pool.query(query, params);

    const requests = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      instructions: row.instructions,
      deadline: row.deadline,
      priority: row.priority,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      templateTitle: row.template_title,
      formSchema: row.form_schema,
      [userRole === 'patient' ? 'therapistName' : 'patientName']: 
        `${decrypt(row.first_name_encrypted)} ${decrypt(row.last_name_encrypted)}`
    }));

    res.json({ requests });
  } catch (error: any) {
    logger.error('Error fetching questionnaire requests:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Anfragen' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/questionnaires/responses - Submit Response (Patient)
// ═══════════════════════════════════════════════════════════════
router.post('/responses', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;

  if (userRole !== 'patient') {
    return next(new AppError('Nur Patienten können Antworten einreichen', 403));
  }

  const { requestId, responses, status = 'draft' } = req.body;

  // Validierung
  if (!requestId || !responses) {
    return next(new AppError('Request-ID und Antworten erforderlich', 400));
  }

  if (!['draft', 'submitted'].includes(status)) {
    return next(new AppError('Ungültiger Status', 400));
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify request exists and belongs to patient
    const requestCheck = await client.query(
      `SELECT id FROM questionnaire_requests WHERE id = $1 AND patient_id = $2`,
      [requestId, userId]
    );

    if (requestCheck.rows.length === 0) {
      throw new AppError('Anfrage nicht gefunden', 404);
    }

    // DSGVO-SAFE: Verschlüssele Antworten
    const responsesEncrypted = encrypt(JSON.stringify(responses));

    // Calculate progress
    const totalFields = Object.keys(responses).length;
    const answeredFields = Object.values(responses).filter((answer: any) => {
      if (answer === undefined || answer === null) return false;
      if (typeof answer === 'object' && 'answer' in answer) {
        return (answer as any).answer !== null && (answer as any).answer !== '';
      }
      if (Array.isArray(answer)) return answer.length > 0;
      return answer !== '';
    }).length;
    const progressPercentage = Math.round((answeredFields / totalFields) * 100);

    // Check if response already exists (update) or create new
    const existingResponse = await client.query(
      `SELECT id FROM questionnaire_responses WHERE request_id = $1 AND patient_id = $2`,
      [requestId, userId]
    );

    let result;
    if (existingResponse.rows.length > 0) {
      // Update existing response
      result = await client.query(
        `UPDATE questionnaire_responses
         SET responses_encrypted = $1, status = $2, progress_percentage = $3,
             updated_at = NOW(), submitted_at = CASE WHEN $2 = 'submitted' THEN NOW() ELSE submitted_at END
         WHERE request_id = $4 AND patient_id = $5
         RETURNING id, created_at`,
        [responsesEncrypted, status, progressPercentage, requestId, userId]
      );
    } else {
      // Create new response
      result = await client.query(
        `INSERT INTO questionnaire_responses (
          request_id, patient_id, responses_encrypted, status, progress_percentage,
          submitted_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at`,
        [
          requestId, 
          userId, 
          responsesEncrypted, 
          status, 
          progressPercentage,
          status === 'submitted' ? new Date() : null
        ]
      );
    }

    // Update request status if submitted
    if (status === 'submitted') {
      await client.query(
        `UPDATE questionnaire_requests SET status = 'completed', completed_at = NOW()
         WHERE id = $1`,
        [requestId]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      id: result.rows[0].id,
      status,
      progressPercentage,
      createdAt: result.rows[0].created_at,
      message: status === 'submitted' ? 'Antworten erfolgreich eingereicht' : 'Entwurf gespeichert'
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/questionnaires/responses/:requestId - Get Response
// ═══════════════════════════════════════════════════════════════
router.get('/responses/:requestId', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { requestId } = req.params;

  try {
    let query;
    let params;

    if (userRole === 'patient') {
      // Patient sieht nur eigene Antworten
      query = `
        SELECT * FROM questionnaire_responses
        WHERE request_id = $1 AND patient_id = $2
      `;
      params = [requestId, userId];
    } else if (userRole === 'therapist') {
      // Therapeut sieht nur Antworten auf eigene Requests
      query = `
        SELECT qr.* 
        FROM questionnaire_responses qr
        JOIN questionnaire_requests req ON qr.request_id = req.id
        WHERE qr.request_id = $1 AND req.therapist_id = $2 AND qr.status = 'submitted'
      `;
      params = [requestId, userId];
    } else {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Antworten nicht gefunden' });
    }

    const response = result.rows[0];

    // DSGVO-SAFE: Entschlüssele Antworten
    const responsesDecrypted = JSON.parse(decrypt(response.responses_encrypted));

    // Update therapist view timestamp
    if (userRole === 'therapist') {
      await pool.query(
        `UPDATE questionnaire_responses SET viewed_by_therapist_at = NOW() WHERE id = $1`,
        [response.id]
      );
    }

    res.json({
      id: response.id,
      requestId: response.request_id,
      responses: responsesDecrypted,
      status: response.status,
      progressPercentage: response.progress_percentage,
      createdAt: response.created_at,
      updatedAt: response.updated_at,
      submittedAt: response.submitted_at,
      viewedByTherapistAt: response.viewed_by_therapist_at
    });
  } catch (error: any) {
    logger.error('Error fetching questionnaire response:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Antworten' });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/questionnaires/templates/:id - Delete Template
// ═══════════════════════════════════════════════════════════════
router.delete('/templates/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { id } = req.params;

  if (userRole !== 'therapist') {
    return res.status(403).json({ error: 'Nur Therapeuten können Templates löschen' });
  }

  try {
    // Soft delete (mark as inactive)
    const result = await pool.query(
      `UPDATE questionnaire_templates SET is_active = FALSE WHERE id = $1 AND therapist_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template nicht gefunden' });
    }

    res.json({ message: 'Template erfolgreich gelöscht' });
  } catch (error: any) {
    logger.error('Error deleting questionnaire template:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Templates' });
  }
});

export default router;
