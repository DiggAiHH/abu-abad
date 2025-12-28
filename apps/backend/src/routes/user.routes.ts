/**
 * User-Management-Routes
 * Profile anzeigen/bearbeiten, Suche nach Therapeuten
 */

import { Router, Request, Response } from 'express';
import { query } from '../database/init.js';
import { authenticate } from '../middleware/auth';
import { updateUserSchema } from '../utils/validation.js';
import { encrypt } from '../utils/encryption.js';
import { AppError } from '../middleware/errorHandler.js';

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
           email = CONCAT('deleted_', id, '@deleted.local')
       WHERE id = $1`,
      [req.user!.userId]
    );

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
    // User-Daten
    const userData = await query(
      `SELECT * FROM users WHERE id = $1`,
      [req.user!.userId]
    );

    // Appointments
    const appointments = await query(
      `SELECT * FROM appointments 
       WHERE therapist_id = $1 OR patient_id = $1`,
      [req.user!.userId]
    );

    // Messages
    const messages = await query(
      `SELECT * FROM messages 
       WHERE sender_id = $1 OR receiver_id = $1`,
      [req.user!.userId]
    );

    // Payments
    const payments = await query(
      `SELECT * FROM payments 
       WHERE patient_id = $1 OR therapist_id = $1`,
      [req.user!.userId]
    );

    const exportData = {
      user: userData.rows[0],
      appointments: appointments.rows,
      messages: messages.rows,
      payments: payments.rows,
      exportedAt: new Date().toISOString(),
      format: 'JSON',
      gdprCompliance: 'Art. 20 DSGVO - Recht auf Datenübertragbarkeit'
    };

    res.json(exportData);
  } catch (error) {
    throw error;
  }
});

export default router;
