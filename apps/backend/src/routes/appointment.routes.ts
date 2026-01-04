/**
 * Terminverwaltungs-Routes
 * Therapeut: Slots erstellen, verwalten
 * Patient: Slots buchen, ansehen
 */

import { Router, Request, Response } from 'express';
import { query } from '../database/init.js';
import { authenticate, requireTherapist, requirePatient } from '../middleware/auth.js';
import { 
  createAppointmentSchema, 
  bookAppointmentSchema,
  updateAppointmentSchema 
} from '../utils/validation.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /api/appointments
 * Therapeut erstellt verfügbare Slots
 */
router.post('/', authenticate, requireTherapist, async (req: Request, res: Response) => {
  const { pool } = await import('../config/database.js');
  const client = await pool.connect();
  
  try {
    const validatedData = createAppointmentSchema.parse(req.body);
    
    await client.query('BEGIN');
    
    // Prüfe Überschneidungen mit Row-Level Locking (UTC-sicher)
    const conflicts = await client.query(
      `SELECT id FROM appointments 
       WHERE therapist_id = $1 
       AND status != 'cancelled'
       AND (
         (start_time AT TIME ZONE 'UTC', end_time AT TIME ZONE 'UTC') OVERLAPS ($2::timestamptz, $3::timestamptz)
       )
       FOR UPDATE`,
      [req.user!.userId, validatedData.startTime, validatedData.endTime]
    );
    if (conflicts.rows.length > 0) {
      await client.query('ROLLBACK');
      throw new AppError('Zeitslot überschneidet sich mit existierendem Termin', 409);
    }

    // Berechne Dauer
    const start = new Date(validatedData.startTime);
    const end = new Date(validatedData.endTime);
    const durationMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);

    // Room-ID für Video-Call
    const roomId = uuidv4();

    const result = await client.query<{ id: string }>(
      `INSERT INTO appointments (
        therapist_id, start_time, end_time, duration_minutes, 
        appointment_type, price, status, room_id
      ) VALUES ($1, $2, $3, $4, $5, $6, 'available', $7)
      RETURNING id`,
      [
        req.user!.userId,
        validatedData.startTime,
        validatedData.endTime,
        durationMinutes,
        validatedData.appointmentType,
        validatedData.price,
        roomId
      ]
    );

    await client.query('COMMIT');
    
    // Defensive Check
    if (!result.rows || result.rows.length === 0) {
      throw new Error('INSERT lieferte keine ID zurück');
    }

    res.status(201).json({
      message: 'Termin-Slot erstellt',
      appointmentId: result.rows[0].id
    });
  } catch (error) {
    await client.query('ROLLBACK');
    
    // Log für Debugging
    logger.error('Fehler beim Erstellen des Termins:', {
      error,
      userId: req.user?.userId,
      body: req.body
    });
    
    throw error;
  } finally {
    client.release();
  }
});

/**
 * GET /api/appointments/available
 * Zeigt verfügbare Termine für Patienten
 */
router.get('/available', authenticate, requirePatient, async (req: Request, res: Response) => {
  try {
    const { therapistId, from, to } = req.query;

    let queryText = `
      SELECT 
        a.id, a.start_time, a.end_time, a.duration_minutes,
        a.appointment_type, a.price,
        u.specialization, u.hourly_rate
      FROM appointments a
      JOIN users u ON a.therapist_id = u.id
      WHERE a.status = 'available'
      AND a.start_time > CURRENT_TIMESTAMP
    `;
    
    const params: any[] = [];
    let paramCount = 1;

    if (therapistId) {
      queryText += ` AND a.therapist_id = $${paramCount}`;
      params.push(therapistId);
      paramCount++;
    }

    if (from) {
      queryText += ` AND a.start_time >= $${paramCount}`;
      params.push(from);
      paramCount++;
    }

    if (to) {
      queryText += ` AND a.end_time <= $${paramCount}`;
      params.push(to);
      paramCount++;
    }

    queryText += ' ORDER BY a.start_time ASC';

    const result = await query(queryText, params);

    res.json({
      appointments: result.rows
    });
  } catch (error) {
    throw error;
  }
});

/**
 * POST /api/appointments/:id/book
 * Patient bucht einen Termin
 */
router.post('/:id/book', authenticate, requirePatient, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = bookAppointmentSchema.parse({ ...req.body, appointmentId: id });

    // Prüfe ob Slot verfügbar ist
    const appointment = await query<{
      id: string;
      status: string;
      price: number;
    }>(
      'SELECT id, status, price FROM appointments WHERE id = $1',
      [id]
    );

    if (appointment.rows.length === 0) {
      throw new AppError('Termin nicht gefunden', 404);
    }

    if (appointment.rows[0].status !== 'available') {
      throw new AppError('Termin nicht verfügbar', 409);
    }

    // Verschlüssele Notizen falls vorhanden
    const patientNotesEncrypted = validatedData.patientNotes 
      ? encrypt(validatedData.patientNotes)
      : null;

    // Termin buchen
    await query(
      `UPDATE appointments 
       SET patient_id = $1, 
           status = 'booked',
           patient_notes_encrypted = $2
       WHERE id = $3`,
      [req.user!.userId, patientNotesEncrypted, id]
    );

    res.json({
      message: 'Termin erfolgreich gebucht',
      appointmentId: id,
      price: appointment.rows[0].price
    });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /api/appointments/my
 * Zeigt eigene Termine (Therapeut oder Patient)
 */
router.get('/my', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, upcoming } = req.query;
    
    const isTherapist = req.user!.role === 'therapist';
    const userIdField = isTherapist ? 'therapist_id' : 'patient_id';

    let queryText = `
      SELECT 
        a.id, a.start_time, a.end_time, a.duration_minutes,
        a.status, a.appointment_type, a.price, a.payment_status,
        a.room_id, a.therapist_notes_encrypted, a.patient_notes_encrypted,
        t.email as therapist_email,
        p.email as patient_email
      FROM appointments a
      LEFT JOIN users t ON a.therapist_id = t.id
      LEFT JOIN users p ON a.patient_id = p.id
      WHERE a.${userIdField} = $1
    `;

    const params: any[] = [req.user!.userId];
    let paramCount = 2;

    if (status) {
      queryText += ` AND a.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (upcoming === 'true') {
      queryText += ` AND a.start_time > CURRENT_TIMESTAMP`;
    }

    queryText += ' ORDER BY a.start_time DESC';

    const result = await query(queryText, params);

    // Entschlüssele Notizen nur für eigene Rolle
    const appointments = result.rows.map((apt: any) => {
      const decrypted: any = { ...apt };
      
      if (isTherapist && apt.therapist_notes_encrypted) {
        decrypted.therapist_notes = decrypt(apt.therapist_notes_encrypted);
        delete decrypted.therapist_notes_encrypted;
      }
      
      if (!isTherapist && apt.patient_notes_encrypted) {
        decrypted.patient_notes = decrypt(apt.patient_notes_encrypted);
        delete decrypted.patient_notes_encrypted;
      }

      // Entferne verschlüsselte Felder aus Response
      delete decrypted.therapist_notes_encrypted;
      delete decrypted.patient_notes_encrypted;

      return decrypted;
    });

    res.json({ appointments });
  } catch (error) {
    throw error;
  }
});

/**
 * PATCH /api/appointments/:id
 * Aktualisiert einen Termin (nur Therapeut)
 */
router.patch('/:id', authenticate, requireTherapist, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = updateAppointmentSchema.parse(req.body);

    // Prüfe Ownership
    const appointment = await query<{ therapist_id: string }>(
      'SELECT therapist_id FROM appointments WHERE id = $1',
      [id]
    );

    if (appointment.rows.length === 0) {
      throw new AppError('Termin nicht gefunden', 404);
    }

    if (appointment.rows[0].therapist_id !== req.user!.userId) {
      throw new AppError('Keine Berechtigung', 403);
    }

    // Build Update Query dynamisch
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (validatedData.startTime) {
      updates.push(`start_time = $${paramCount}`);
      params.push(validatedData.startTime);
      paramCount++;
    }

    if (validatedData.endTime) {
      updates.push(`end_time = $${paramCount}`);
      params.push(validatedData.endTime);
      paramCount++;
    }

    if (validatedData.status) {
      updates.push(`status = $${paramCount}`);
      params.push(validatedData.status);
      paramCount++;
    }

    if (validatedData.therapistNotes) {
      updates.push(`therapist_notes_encrypted = $${paramCount}`);
      params.push(encrypt(validatedData.therapistNotes));
      paramCount++;
    }

    if (updates.length === 0) {
      throw new AppError('Keine Änderungen angegeben', 400);
    }

    params.push(id);

    await query(
      `UPDATE appointments SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      params
    );

    res.json({ message: 'Termin aktualisiert' });
  } catch (error) {
    throw error;
  }
});

/**
 * DELETE /api/appointments/:id
 * Löscht/Storniert einen Termin
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const appointment = await query<{
      therapist_id: string;
      patient_id: string | null;
      status: string;
    }>(
      'SELECT therapist_id, patient_id, status FROM appointments WHERE id = $1',
      [id]
    );

    if (appointment.rows.length === 0) {
      throw new AppError('Termin nicht gefunden', 404);
    }

    const apt = appointment.rows[0];
    const isOwner = apt.therapist_id === req.user!.userId || 
                    apt.patient_id === req.user!.userId;

    if (!isOwner) {
      throw new AppError('Keine Berechtigung', 403);
    }

    // Termin stornieren (nicht löschen für Audit)
    await query(
      `UPDATE appointments 
       SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Termin storniert' });
  } catch (error) {
    throw error;
  }
});

export default router;
