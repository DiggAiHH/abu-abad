import { Router, Request, Response } from 'express';
import { query } from '../database/init.js';
import { authenticate, requireTherapist } from '../middleware/auth.js';
import { decrypt } from '../utils/encryption.js';

const router = Router();

/**
 * GET /api/patients
 * Minimaler Compat-Endpoint für das Frontend Billing-Modul.
 * Liefert Patienten, die (mindestens) einen Termin mit dem Therapeuten haben.
 */
router.get('/', authenticate, requireTherapist, async (req: Request, res: Response) => {
  const therapistId = req.user!.userId;

  const result = await query<{
    id: string;
    first_name_encrypted: string;
    last_name_encrypted: string;
  }>(
    `SELECT DISTINCT
      u.id,
      u.first_name_encrypted,
      u.last_name_encrypted
     FROM appointments a
     JOIN users u ON u.id = a.patient_id
     WHERE a.therapist_id = $1
       AND a.patient_id IS NOT NULL
       AND u.role = 'patient'
     ORDER BY u.id`,
    [therapistId]
  );

  const patients = result.rows.map((p) => ({
    id: p.id,
    name: `${decrypt(p.first_name_encrypted)} ${decrypt(p.last_name_encrypted)}`.trim(),
  }));

  res.json(patients);
});

export default router;
