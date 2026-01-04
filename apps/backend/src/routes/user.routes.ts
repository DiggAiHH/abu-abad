/**
 * User-Management-Routes
 * Profile anzeigen/bearbeiten, Suche nach Therapeuten
 */

import { Router, Request, Response } from 'express';
import { query } from '../database/init.js';
import { authenticate } from '../middleware/auth.js';
import { updateUserSchema } from '../utils/validation.js';
import { encrypt } from '../utils/encryption.js';
import { decrypt } from '../utils/encryption.js';
import { AppError } from '../middleware/errorHandler.js';
import { writeAuditLog } from '../utils/audit.js';

const router = Router();

/**
 * GET /api/users/therapists
 * Sucht Therapeuten (öffentlich für eingeloggte Patienten)
 */
router.get('/therapists', authenticate, async (req: Request, res: Response) => {
  try {
    const { specialization, minPrice, maxPrice } = req.query;

    let queryText = `
      SELECT 
        id, email, specialization, bio, hourly_rate,
        created_at
      FROM users
      WHERE role = 'therapist' AND is_active = true
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (specialization) {
      queryText += ` AND specialization ILIKE $${paramCount}`;
      params.push(`%${specialization}%`);
      paramCount++;
    }

    if (minPrice) {
      queryText += ` AND hourly_rate >= $${paramCount}`;
      params.push(minPrice);
      paramCount++;
    }

    if (maxPrice) {
      queryText += ` AND hourly_rate <= $${paramCount}`;
      params.push(maxPrice);
      paramCount++;
    }

    queryText += ' ORDER BY created_at DESC LIMIT 50';

    const result = await query(queryText, params);

    res.json({
      therapists: result.rows
    });
  } catch (error) {
    throw error;
  }
});

/**
 * PATCH /api/users/me
 * Aktualisiert eigenes Profil
 */
router.patch('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const validatedData = updateUserSchema.parse(req.body);

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (validatedData.firstName) {
      updates.push(`first_name_encrypted = $${paramCount}`);
      params.push(encrypt(validatedData.firstName));
      paramCount++;
    }

    if (validatedData.lastName) {
      updates.push(`last_name_encrypted = $${paramCount}`);
      params.push(encrypt(validatedData.lastName));
      paramCount++;
    }

    if (validatedData.phone) {
      updates.push(`phone_encrypted = $${paramCount}`);
      params.push(encrypt(validatedData.phone));
      paramCount++;
    }

    if (validatedData.bio) {
      updates.push(`bio = $${paramCount}`);
      params.push(validatedData.bio);
      paramCount++;
    }

    if (validatedData.specialization && req.user!.role === 'therapist') {
      updates.push(`specialization = $${paramCount}`);
      params.push(validatedData.specialization);
      paramCount++;
    }

    if (validatedData.hourlyRate && req.user!.role === 'therapist') {
      updates.push(`hourly_rate = $${paramCount}`);
      params.push(validatedData.hourlyRate);
      paramCount++;
    }

    if (updates.length === 0) {
      throw new AppError('Keine Änderungen angegeben', 400);
    }

    params.push(req.user!.userId);

    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      params
    );

    await writeAuditLog({
      userId: req.user!.userId,
      action: 'user.profile.update',
      req,
      metadata: { updatedFields: Object.keys(validatedData).filter((k) => (validatedData as any)[k] != null) },
    });

    res.json({ message: 'Profil aktualisiert' });
  } catch (error) {
    throw error;
  }
});

/**
 * DELETE /api/users/me
 * Löscht eigenen Account (DSGVO Recht auf Löschung Art. 17)
 */
router.delete('/me', authenticate, async (req: Request, res: Response) => {
  try {
    // Soft Delete: deaktivieren statt löschen (für Audit-Trail)
    await query(
      `UPDATE users 
       SET is_active = false, 
           email = CONCAT('deleted_', id, '@deleted.local'),
           data_retention_until = (CURRENT_TIMESTAMP + INTERVAL '30 days')
       WHERE id = $1`,
      [req.user!.userId]
    );

    // Refresh Tokens sofort widerrufen
    await query(
      'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL',
      [req.user!.userId]
    );

    await writeAuditLog({
      userId: req.user!.userId,
      action: 'user.account.delete.request',
      req,
    });

    res.json({ 
      message: 'Account gelöscht',
      note: 'Ihre Daten werden gemäß DSGVO nach 30 Tagen endgültig gelöscht'
    });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /api/users/me/data-export
 * DSGVO Art. 20: Recht auf Datenübertragbarkeit
 */
router.get('/me/data-export', authenticate, async (req: Request, res: Response) => {
  try {
    const userRow = await query<{
      id: string;
      email: string;
      role: 'therapist' | 'patient';
      first_name_encrypted: string;
      last_name_encrypted: string;
      phone_encrypted: string | null;
      date_of_birth: string | null;
      specialization: string | null;
      bio: string | null;
      hourly_rate: string | null;
      created_at: string;
      updated_at: string;
      gdpr_consent_at: string | null;
      last_login_at: string | null;
    }>(
      `SELECT
        id,
        email,
        role,
        first_name_encrypted,
        last_name_encrypted,
        phone_encrypted,
        date_of_birth,
        specialization,
        bio,
        hourly_rate,
        created_at,
        updated_at,
        gdpr_consent_at,
        last_login_at
      FROM users
      WHERE id = $1`,
      [req.user!.userId]
    );

    if (userRow.rows.length === 0) {
      throw new AppError('Benutzer nicht gefunden', 404);
    }

    const user = userRow.rows[0];

    const appointments = await query<{
      id: string;
      therapist_id: string;
      patient_id: string | null;
      start_time: string;
      end_time: string;
      status: string;
      appointment_type: string | null;
      price: string | null;
      created_at: string;
      updated_at: string;
      cancelled_at: string | null;
      completed_at: string | null;
      therapist_notes_encrypted: string | null;
      patient_notes_encrypted: string | null;
    }>(
      `SELECT
        id,
        therapist_id,
        patient_id,
        start_time,
        end_time,
        status,
        appointment_type,
        price,
        created_at,
        updated_at,
        cancelled_at,
        completed_at,
        therapist_notes_encrypted,
        patient_notes_encrypted
      FROM appointments
      WHERE therapist_id = $1 OR patient_id = $1
      ORDER BY start_time DESC`,
      [req.user!.userId]
    );

    const messages = await query<{
      id: string;
      sender_id: string;
      receiver_id: string;
      appointment_id: string | null;
      content_encrypted: string;
      is_read: boolean;
      read_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
        id,
        sender_id,
        receiver_id,
        appointment_id,
        content_encrypted,
        is_read,
        read_at,
        created_at,
        updated_at
      FROM messages
      WHERE sender_id = $1 OR receiver_id = $1
      ORDER BY created_at DESC`,
      [req.user!.userId]
    );

    const payments = await query<{
      id: string;
      appointment_id: string | null;
      patient_id: string;
      therapist_id: string;
      amount: string;
      currency: string;
      status: string;
      paid_at: string | null;
      refunded_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
        id,
        appointment_id,
        patient_id,
        therapist_id,
        amount,
        currency,
        status,
        paid_at,
        refunded_at,
        created_at,
        updated_at
      FROM payments
      WHERE patient_id = $1 OR therapist_id = $1
      ORDER BY created_at DESC`,
      [req.user!.userId]
    );

    await writeAuditLog({
      userId: req.user!.userId,
      action: 'user.data.export',
      req,
    });

    res.json({
      exportedAt: new Date().toISOString(),
      format: 'JSON',
      gdprCompliance: 'Art. 20 DSGVO - Recht auf Datenübertragbarkeit',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        personalData: {
          firstName: decrypt(user.first_name_encrypted),
          lastName: decrypt(user.last_name_encrypted),
          phone: user.phone_encrypted ? decrypt(user.phone_encrypted) : null,
          dateOfBirth: user.date_of_birth,
        },
        therapistProfile: user.role === 'therapist'
          ? {
              specialization: user.specialization,
              bio: user.bio,
              hourlyRate: user.hourly_rate,
            }
          : null,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        gdprConsentAt: user.gdpr_consent_at,
        lastLoginAt: user.last_login_at,
      },
      appointments: appointments.rows.map((a) => ({
        id: a.id,
        therapistId: a.therapist_id,
        patientId: a.patient_id,
        startTime: a.start_time,
        endTime: a.end_time,
        status: a.status,
        appointmentType: a.appointment_type,
        price: a.price,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        cancelledAt: a.cancelled_at,
        completedAt: a.completed_at,
        notes: {
          therapistNotes: a.therapist_notes_encrypted ? decrypt(a.therapist_notes_encrypted) : null,
          patientNotes: a.patient_notes_encrypted ? decrypt(a.patient_notes_encrypted) : null,
        },
      })),
      messages: messages.rows.map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        receiverId: m.receiver_id,
        appointmentId: m.appointment_id,
        content: decrypt(m.content_encrypted),
        isRead: m.is_read,
        readAt: m.read_at,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      })),
      payments: payments.rows.map((p) => ({
        id: p.id,
        appointmentId: p.appointment_id,
        patientId: p.patient_id,
        therapistId: p.therapist_id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        paidAt: p.paid_at,
        refundedAt: p.refunded_at,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
    });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /api/users/:id
 * Zeigt öffentliches Profil eines Users
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        id, email, role, specialization, bio, hourly_rate,
        is_verified, created_at
      FROM users
      WHERE id = $1 AND is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Benutzer nicht gefunden', 404);
    }

    res.json({
      user: result.rows[0]
    });
  } catch (error) {
    throw error;
  }
});

export default router;
