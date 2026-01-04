/**
 * Patient Pre-Session Materials Routes
 * DSGVO-konform: Art. 9 (Gesundheitsdaten), Art. 32 (Verschlüsselung)
 * 
 * Features:
 * - Upload von Notizen, Skizzen, Audio/Video
 * - AES-256-GCM Verschlüsselung
 * - Lokales Filesystem (kein S3)
 * - Zugriffskontrolle (RLS)
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import env from '../config/env.js';
import { logger } from '../utils/logger.js';

const router = Router();

function sanitizeFilenameForHeader(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'download';
  // Entferne CR/LF und Quotes, begrenze Länge
  const cleaned = trimmed
    .replace(/[\r\n]/g, '')
    .replace(/"/g, "'")
    .slice(0, 180);
  return cleaned || 'download';
}

// DSGVO-SAFE: Lokales File Storage (kein Cloud-Provider)
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/workspaces/abu-abad/uploads/patient-materials';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB (Audio/Video)
const ALLOWED_MIME_TYPES = [
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
  'audio/mpeg',
  'audio/webm',
  'audio/wav',
  'video/mp4',
  'video/webm',
  'application/pdf'
];

const ENCRYPTION_KEY_VERSION = env.ENCRYPTION_KEY_VERSION;

// Multer Config: Memory Storage (encrypt before disk write)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Nicht erlaubter Dateityp: ${file.mimetype}`));
    }
  }
});

// Initialize upload directory
async function initUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true, mode: 0o700 });
  } catch (error) {
    logger.error('Failed to create upload directory:', error);
  }
}
initUploadDir();

// ═══════════════════════════════════════════════════════════════
// POST /api/patient-materials - Upload Material (Note/Sketch/Audio/Video)
// ═══════════════════════════════════════════════════════════════
router.post(
  '/',
  authenticate,
  upload.single('file'),
  async (req: Request, res: Response): Promise<any> => {
    const pool: Pool = (req as any).pool;
    const userId = (req as any).userId;
    const userRole = (req as any).userRole;

    // SECURITY: Nur Patienten dürfen Materialien hochladen
    if (userRole !== 'patient') {
      return res.status(403).json({ error: 'Nur Patienten dürfen Materialien hochladen' });
    }

    const { materialType, content, appointmentId } = req.body;
    const file = req.file;

    // Validierung
    if (!materialType || !['note', 'sketch', 'audio', 'video', 'document'].includes(materialType)) {
      return res.status(400).json({ error: 'Ungültiger Material-Typ' });
    }

    if (materialType === 'note' && !content) {
      return res.status(400).json({ error: 'Notiz-Inhalt fehlt' });
    }

    if (['sketch', 'audio', 'video', 'document'].includes(materialType) && !file) {
      return res.status(400).json({ error: 'Datei fehlt' });
    }

    // HISTORY-AWARE: Declare secureFilePath outside try for cleanup in catch
    let secureFilePath: string | null = null;

    try {
      let contentEncrypted = null;
      let filePathEncrypted: string | null = null;
      let fileNameEncrypted = null;
      let fileSizeBytes = null;
      let fileMimeType = null;

      // HISTORY-AWARE: Nutze existierende encrypt() Funktion aus utils/encryption.ts
      if (materialType === 'note') {
        // DSGVO-SAFE: Verschlüssele Notizen-Inhalt
        contentEncrypted = encrypt(content);
      } else if (file) {
        // DSGVO-SAFE: Verschlüssele Datei vor dem Speichern
        const encryptedBuffer = encryptFileBuffer(file.buffer);
        
        // Generate secure filename (SHA-256 hash)
        const fileHash = crypto.createHash('sha256')
          .update(userId + Date.now() + file.originalname)
          .digest('hex');
        
        const fileExtension = path.extname(file.originalname);
        const secureFileName = `${fileHash}${fileExtension}.enc`;
        secureFilePath = path.join(UPLOAD_DIR, secureFileName);

        // Write encrypted file to disk
        await fs.writeFile(secureFilePath, encryptedBuffer, { mode: 0o600 });

        // DSGVO-SAFE: Verschlüssele Dateimetadaten
        filePathEncrypted = encrypt(secureFileName); // Nur Filename, kein absolute path
        fileNameEncrypted = encrypt(file.originalname);
        fileSizeBytes = file.size;
        fileMimeType = file.mimetype;
      }

      // Insert into database
      const result = await pool.query(
        `INSERT INTO patient_materials (
          patient_id, appointment_id, material_type,
          content_encrypted, file_path_encrypted, file_name_encrypted,
          file_size_bytes, file_mime_type,
          encryption_algorithm, encryption_key_id,
          auto_delete_after
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, created_at`,
        [
          userId,
          appointmentId || null,
          materialType,
          contentEncrypted,
          filePathEncrypted,
          fileNameEncrypted,
          fileSizeBytes,
          fileMimeType,
          'AES-256-GCM',
          ENCRYPTION_KEY_VERSION,
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Auto-delete after 1 year (DSGVO Art. 17)
        ]
      );

      res.status(201).json({
        id: result.rows[0].id,
        materialType,
        createdAt: result.rows[0].created_at,
        message: 'Material erfolgreich hochgeladen'
      });
    } catch (error: any) {
      logger.error('Error uploading patient material:', error);
      
      // Cleanup file on error
      if (secureFilePath) {
        try {
          await fs.unlink(secureFilePath);
        } catch (cleanupError) {
          logger.error('Failed to cleanup file:', cleanupError);
        }
      }

      res.status(500).json({ error: 'Fehler beim Hochladen' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// GET /api/patient-materials - Liste aller Materialien (Patient)
// ═══════════════════════════════════════════════════════════════
router.get('/', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;

  try {
    let query;
    let params;

    if (userRole === 'patient') {
      // Patient sieht nur eigene Materialien
      query = `
        SELECT 
          id, material_type, file_size_bytes, file_mime_type,
          shared_with_therapist, created_at, appointment_id
        FROM patient_materials
        WHERE patient_id = $1
        ORDER BY created_at DESC
      `;
      params = [userId];
    } else if (userRole === 'therapist') {
      // Therapeut sieht nur geteilte Materialien seiner Patienten
      query = `
        SELECT 
          pm.id, pm.material_type, pm.file_size_bytes, pm.file_mime_type,
          pm.created_at, pm.appointment_id, pm.patient_id,
          u.first_name_encrypted, u.last_name_encrypted
        FROM patient_materials pm
        JOIN appointments a ON pm.appointment_id = a.id
        JOIN users u ON pm.patient_id = u.id
        WHERE a.therapist_id = $1 AND pm.shared_with_therapist = TRUE
        ORDER BY pm.created_at DESC
      `;
      params = [userId];
    } else {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    const result = await pool.query(query, params);

    // DSGVO-SAFE: Entschlüssele nur notwendige Felder
    const materials = result.rows.map(row => ({
      id: row.id,
      materialType: row.material_type,
      fileSizeBytes: row.file_size_bytes,
      fileMimeType: row.file_mime_type,
      sharedWithTherapist: row.shared_with_therapist,
      createdAt: row.created_at,
      appointmentId: row.appointment_id,
      ...(userRole === 'therapist' && {
        patientId: row.patient_id,
        patientName: `${decrypt(row.first_name_encrypted)} ${decrypt(row.last_name_encrypted)}`
      })
    }));

    res.json({ materials });
  } catch (error: any) {
    logger.error('Error fetching patient materials:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Materialien' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/patient-materials/:id - Download Material
// ═══════════════════════════════════════════════════════════════
router.get('/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { id } = req.params;

  try {
    // SECURITY: Zugriffskontrolle
    let query;
    let params;

    if (userRole === 'patient') {
      query = `SELECT * FROM patient_materials WHERE id = $1 AND patient_id = $2`;
      params = [id, userId];
    } else if (userRole === 'therapist') {
      query = `
        SELECT pm.* 
        FROM patient_materials pm
        JOIN appointments a ON pm.appointment_id = a.id
        WHERE pm.id = $1 AND a.therapist_id = $2 AND pm.shared_with_therapist = TRUE
      `;
      params = [id, userId];
    } else {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Material nicht gefunden' });
    }

    const material = result.rows[0];

    // Update access audit trail
    if (userRole === 'therapist') {
      await pool.query(
        `UPDATE patient_materials SET accessed_by = $1, accessed_at = NOW() WHERE id = $2`,
        [userId, id]
      );
    }

    // Return content based on type
    if (material.material_type === 'note') {
      // DSGVO-SAFE: Entschlüssele Notiz
      const content = decrypt(material.content_encrypted);
      res.json({
        id: material.id,
        materialType: material.material_type,
        content,
        createdAt: material.created_at
      });
    } else {
      // DSGVO-SAFE: Entschlüssele und streame Datei
      const encryptedFileName = decrypt(material.file_path_encrypted);
      const filePath = path.join(UPLOAD_DIR, encryptedFileName);
      const originalFileName = sanitizeFilenameForHeader(decrypt(material.file_name_encrypted));

      // Read encrypted file
      const encryptedBuffer = await fs.readFile(filePath);
      
      // Decrypt file content
      const decryptedBuffer = decryptFileBuffer(encryptedBuffer);

      // Set headers
      res.setHeader('Content-Type', material.file_mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${originalFileName}"`);
      res.setHeader('Content-Length', decryptedBuffer.length);

      res.send(decryptedBuffer);
    }
  } catch (error: any) {
    logger.error('Error fetching patient material:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Materials' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/patient-materials/:id/share - Teile mit Therapeut
// ═══════════════════════════════════════════════════════════════
router.patch('/:id/share', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { id } = req.params;

  if (userRole !== 'patient') {
    return res.status(403).json({ error: 'Nur Patienten können Materialien teilen' });
  }

  try {
    const result = await pool.query(
      `UPDATE patient_materials 
       SET shared_with_therapist = TRUE, shared_at = NOW()
       WHERE id = $1 AND patient_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Material nicht gefunden' });
    }

    res.json({ message: 'Material erfolgreich geteilt' });
  } catch (error: any) {
    logger.error('Error sharing patient material:', error);
    res.status(500).json({ error: 'Fehler beim Teilen' });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/patient-materials/:id - Lösche Material (DSGVO Art. 17)
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  const pool: Pool = (req as any).pool;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { id } = req.params;

  if (userRole !== 'patient') {
    return res.status(403).json({ error: 'Nur Patienten können ihre Materialien löschen' });
  }

  try {
    // Get file path before deletion
    const materialResult = await pool.query(
      `SELECT file_path_encrypted FROM patient_materials WHERE id = $1 AND patient_id = $2`,
      [id, userId]
    );

    if (materialResult.rows.length === 0) {
      return res.status(404).json({ error: 'Material nicht gefunden' });
    }

    const material = materialResult.rows[0];

    // Delete from database
    await pool.query(
      `DELETE FROM patient_materials WHERE id = $1 AND patient_id = $2`,
      [id, userId]
    );

    // Delete file from filesystem
    if (material.file_path_encrypted) {
      try {
        const encryptedFileName = decrypt(material.file_path_encrypted);
        const filePath = path.join(UPLOAD_DIR, encryptedFileName);
        await fs.unlink(filePath);
      } catch (fileError) {
        logger.error('Failed to delete file:', fileError);
        // Continue anyway - DB record is deleted
      }
    }

    res.json({ message: 'Material erfolgreich gelöscht' });
  } catch (error: any) {
    logger.error('Error deleting patient material:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// ═══════════════════════════════════════════════════════════════
// HELPER: Encrypt File Buffer (AES-256-GCM)
// ═══════════════════════════════════════════════════════════════
function encryptFileBuffer(buffer: Buffer): Buffer {
  const algorithm = 'aes-256-gcm';
  // Derive a stable 32-byte key from the (string) ENCRYPTION_KEY.
  // This avoids relying on hex-only secrets and guarantees decryptability.
  const key = crypto.createHash('sha256').update(env.ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Format: [iv(16 bytes)][authTag(16 bytes)][encrypted data]
  return Buffer.concat([iv, authTag, encrypted]);
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Decrypt File Buffer (AES-256-GCM)
// ═══════════════════════════════════════════════════════════════
function decryptFileBuffer(encryptedBuffer: Buffer): Buffer {
  const algorithm = 'aes-256-gcm';
  const key = crypto.createHash('sha256').update(env.ENCRYPTION_KEY).digest();
  
  // Extract iv, authTag, and encrypted data
  const iv = encryptedBuffer.slice(0, 16);
  const authTag = encryptedBuffer.slice(16, 32);
  const encrypted = encryptedBuffer.slice(32);
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export default router;
