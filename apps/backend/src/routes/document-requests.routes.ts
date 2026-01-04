/**
 * Document Requests Routes
 * DSGVO-konform: Art. 9 (Gesundheitsdaten)
 * 
 * Features:
 * - Therapeut fordert Dokumente/Scans von Patienten an
 * - Patient lädt Dokumente hoch (verknüpft mit patient_materials)
 * - Therapeut reviewed hochgeladene Dokumente
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth.js';
import { decrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

const router = Router();

async function enqueueNotificationStub(targetUserId: string, payload: Record<string, any>): Promise<void> {
  logger.info(`Notification stub queued for user ${targetUserId}`, payload);
}

// ═══════════════════════════════════════════════════════════════
// POST /api/document-requests - Create Request (Therapeut)
// ═══════════════════════════════════════════════════════════════
router.post('/', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;

  if (userRole !== 'therapist') {
    return res.status(403).json({ error: 'Nur Therapeuten können Dokumente anfordern' });
  }

  const { patientId, appointmentId, title, description, documentType, deadline } = req.body;

  // Validierung
  if (!patientId || !title || !documentType) {
    return res.status(400).json({ error: 'Patienten-ID, Titel und Dokumenttyp erforderlich' });
  }

  const validDocumentTypes = [
    'medical_scan',
    'lab_results',
    'prescription',
    'referral',
    'insurance',
    'other'
  ];

  if (!validDocumentTypes.includes(documentType)) {
    return res.status(400).json({ 
      error: `Ungültiger Dokumenttyp. Erlaubt: ${validDocumentTypes.join(', ')}` 
    });
  }

  try {
    // Verify patient exists
    const patientCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'patient'`,
      [patientId]
    );

    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Patient nicht gefunden' });
    }

    const result = await pool.query(
      `INSERT INTO document_requests (
        therapist_id, patient_id, appointment_id,
        title, description, document_type, deadline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at`,
      [
        userId,
        patientId,
        appointmentId || null,
        title,
        description || null,
        documentType,
        deadline || null
      ]
    );

    await enqueueNotificationStub(patientId, {
      type: 'document-request',
      requestId: result.rows[0].id,
      title,
      deadline
    });

    res.status(201).json({
      id: result.rows[0].id,
      createdAt: result.rows[0].created_at,
      message: 'Dokument erfolgreich angefordert'
    });
  } catch (error: any) {
    logger.error('Error creating document request:', error);
    res.status(500).json({ error: 'Fehler beim Anfordern des Dokuments' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/document-requests - Liste Requests
// ═══════════════════════════════════════════════════════════════
router.get('/', authenticate, async (req: Request, res: Response): Promise<any> => {
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
          dr.id, dr.title, dr.description, dr.document_type,
          dr.status, dr.deadline, dr.created_at, dr.uploaded_at,
          dr.rejection_reason,
          u.first_name_encrypted, u.last_name_encrypted
        FROM document_requests dr
        JOIN users u ON dr.therapist_id = u.id
        WHERE dr.patient_id = $1
        ${status ? 'AND dr.status = $2' : ''}
        ORDER BY dr.created_at DESC
      `;
      params = status ? [userId, status] : [userId];
    } else if (userRole === 'therapist') {
      // Therapeut sieht nur eigene Requests
      query = `
        SELECT 
          dr.id, dr.title, dr.description, dr.document_type,
          dr.status, dr.deadline, dr.created_at, dr.uploaded_at,
          dr.reviewed_at, dr.uploaded_file_id,
          u.first_name_encrypted, u.last_name_encrypted
        FROM document_requests dr
        JOIN users u ON dr.patient_id = u.id
        WHERE dr.therapist_id = $1
        ${status ? 'AND dr.status = $2' : ''}
        ORDER BY dr.created_at DESC
      `;
      params = status ? [userId, status] : [userId];
    } else {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    const result = await pool.query(query, params);


    const requests = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      documentType: row.document_type,
      status: row.status,
      deadline: row.deadline,
      createdAt: row.created_at,
      uploadedAt: row.uploaded_at,
      reviewedAt: row.reviewed_at,
      uploadedFileId: row.uploaded_file_id,
      rejectionReason: row.rejection_reason,
      [userRole === 'patient' ? 'therapistName' : 'patientName']:
        `${decrypt(row.first_name_encrypted)} ${decrypt(row.last_name_encrypted)}`
    }));

    res.json({ requests });
  } catch (error: any) {
    logger.error('Error fetching document requests:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Anfragen' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/document-requests/:id/upload - Link Uploaded File (Patient)
// ═══════════════════════════════════════════════════════════════
router.patch('/:id/upload', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { id } = req.params;
  const { uploadedFileId } = req.body;

  if (userRole !== 'patient') {
    return res.status(403).json({ error: 'Nur Patienten können Dokumente hochladen' });
  }

  if (!uploadedFileId) {
    return res.status(400).json({ error: 'Uploaded File ID erforderlich' });
  }

  try {
    // Verify request exists and belongs to patient
    const requestCheck = await pool.query(
      `SELECT id FROM document_requests WHERE id = $1 AND patient_id = $2`,
      [id, userId]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    }

    // Verify uploaded file belongs to patient
    const fileCheck = await pool.query(
      `SELECT id FROM patient_materials WHERE id = $1 AND patient_id = $2`,
      [uploadedFileId, userId]
    );

    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Hochgeladene Datei nicht gefunden' });
    }

    // Update request
    await pool.query(
      `UPDATE document_requests 
       SET uploaded_file_id = $1, uploaded_at = NOW(), status = 'uploaded'
       WHERE id = $2`,
      [uploadedFileId, id]
    );

    // Auto-share file with therapist
    await pool.query(
      `UPDATE patient_materials 
       SET shared_with_therapist = TRUE, shared_at = NOW()
       WHERE id = $1`,
      [uploadedFileId]
    );

    res.json({ message: 'Dokument erfolgreich hochgeladen' });
  } catch (error: any) {
    logger.error('Error linking uploaded file:', error);
    res.status(500).json({ error: 'Fehler beim Hochladen' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/document-requests/:id/review - Review Document (Therapeut)
// ═══════════════════════════════════════════════════════════════
router.patch('/:id/review', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { id } = req.params;
  const { status, rejectionReason } = req.body;

  if (userRole !== 'therapist') {
    return res.status(403).json({ error: 'Nur Therapeuten können Dokumente reviewen' });
  }

  if (!status || !['reviewed', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status (reviewed oder rejected)' });
  }

  if (status === 'rejected' && !rejectionReason) {
    return res.status(400).json({ error: 'Ablehnungsgrund erforderlich' });
  }

  try {
    // Verify request exists and belongs to therapist
    const requestCheck = await pool.query(
      `SELECT id, uploaded_file_id FROM document_requests WHERE id = $1 AND therapist_id = $2`,
      [id, userId]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    }

    if (!requestCheck.rows[0].uploaded_file_id) {
      return res.status(400).json({ error: 'Kein Dokument hochgeladen' });
    }

    // Update request
    await pool.query(
      `UPDATE document_requests 
       SET status = $1, reviewed_at = NOW(), rejection_reason = $2
       WHERE id = $3`,
      [status, rejectionReason || null, id]
    );

    res.json({ 
      message: status === 'reviewed' ? 'Dokument akzeptiert' : 'Dokument abgelehnt' 
    });
  } catch (error: any) {
    logger.error('Error reviewing document:', error);
    res.status(500).json({ error: 'Fehler beim Reviewen' });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/document-requests/:id - Delete Request
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { id } = req.params;

  if (userRole !== 'therapist') {
    return res.status(403).json({ error: 'Nur Therapeuten können Anfragen löschen' });
  }

  try {
    const result = await pool.query(
      `DELETE FROM document_requests WHERE id = $1 AND therapist_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    }

    res.json({ message: 'Anfrage erfolgreich gelöscht' });
  } catch (error: any) {
    logger.error('Error deleting document request:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

export default router;
