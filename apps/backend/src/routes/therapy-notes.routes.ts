import { Router, Request, Response } from 'express';
import { query } from '../database/init.js';
import { authenticate, requireTherapist } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { decrypt, encrypt } from '../utils/encryption.js';
import { therapyNoteCreateSchema, therapyNoteUpdateSchema } from '../utils/validation.js';

const router = Router();

async function assertTherapistPatientRelationship(therapistId: string, patientId: string): Promise<void> {
  const rel = await query<{ c: string }>(
    `SELECT COUNT(*)::text as c
     FROM appointments
     WHERE therapist_id = $1
       AND patient_id = $2
       AND status IN ('booked','completed')`,
    [therapistId, patientId]
  );

  const c = Number(rel.rows[0]?.c ?? '0');
  if (c <= 0) throw new AppError('Kein Zugriff auf diesen Patienten', 403);
}

router.get('/patient/:patientId', authenticate, requireTherapist, async (req: Request, res: Response) => {
  const therapistId = req.user!.userId;
  const { patientId } = req.params;

  await assertTherapistPatientRelationship(therapistId, patientId);

  const result = await query<{
    id: string;
    patient_id: string;
    session_date: string;
    session_number: number | null;
    session_duration: number | null;
    subjective_encrypted: string | null;
    objective_encrypted: string | null;
    assessment_encrypted: string | null;
    plan_encrypted: string | null;
    homework_encrypted: string | null;
    diagnosis: string[];
    interventions: string[];
    risk_assessment: 'none' | 'low' | 'moderate' | 'high' | 'acute';
    suicidal_ideation: boolean;
    mental_status: any;
    progress_rating: number | null;
    goals_addressed: string[];
    next_session_planned: string | null;
    follow_up_required: boolean;
    first_name_encrypted: string;
    last_name_encrypted: string;
  }>(
    `SELECT
      n.id,
      n.patient_id,
      n.session_date::text as session_date,
      n.session_number,
      n.session_duration,
      n.subjective_encrypted,
      n.objective_encrypted,
      n.assessment_encrypted,
      n.plan_encrypted,
      n.homework_encrypted,
      n.diagnosis,
      n.interventions,
      n.risk_assessment,
      n.suicidal_ideation,
      n.mental_status,
      n.progress_rating,
      n.goals_addressed,
      n.next_session_planned::text as next_session_planned,
      n.follow_up_required,
      u.first_name_encrypted,
      u.last_name_encrypted
     FROM therapy_notes n
     JOIN users u ON u.id = n.patient_id
     WHERE n.therapist_id = $1 AND n.patient_id = $2
     ORDER BY n.session_date DESC, n.created_at DESC`,
    [therapistId, patientId]
  );

  const rows = result.rows.map((r) => ({
    id: r.id,
    patient_id: r.patient_id,
    first_name: decrypt(r.first_name_encrypted),
    last_name: decrypt(r.last_name_encrypted),
    session_date: r.session_date,
    session_number: r.session_number ?? undefined,
    session_duration: r.session_duration ?? undefined,
    subjective: r.subjective_encrypted ? decrypt(r.subjective_encrypted) : undefined,
    objective: r.objective_encrypted ? decrypt(r.objective_encrypted) : undefined,
    assessment: r.assessment_encrypted ? decrypt(r.assessment_encrypted) : undefined,
    plan: r.plan_encrypted ? decrypt(r.plan_encrypted) : undefined,
    homework: r.homework_encrypted ? decrypt(r.homework_encrypted) : undefined,
    diagnosis: r.diagnosis ?? [],
    interventions: r.interventions ?? [],
    risk_assessment: r.risk_assessment,
    suicidal_ideation: r.suicidal_ideation,
    mental_status: (r.mental_status as any) ?? {},
    progress_rating: r.progress_rating ?? undefined,
    goals_addressed: r.goals_addressed ?? [],
    next_session_planned: r.next_session_planned ?? undefined,
    follow_up_required: r.follow_up_required,
  }));

  res.json(rows);
});

router.post('/', authenticate, requireTherapist, async (req: Request, res: Response) => {
  const therapistId = req.user!.userId;
  const data = therapyNoteCreateSchema.parse(req.body);

  await assertTherapistPatientRelationship(therapistId, data.patientId);

  const result = await query<{ id: string }>(
    `INSERT INTO therapy_notes (
      therapist_id,
      patient_id,
      session_date,
      session_duration,
      subjective_encrypted,
      objective_encrypted,
      assessment_encrypted,
      plan_encrypted,
      homework_encrypted,
      diagnosis,
      interventions,
      risk_assessment,
      suicidal_ideation,
      mental_status,
      progress_rating,
      goals_addressed,
      next_session_planned,
      follow_up_required
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
    ) RETURNING id`,
    [
      therapistId,
      data.patientId,
      data.sessionDate,
      data.sessionDuration ?? null,
      data.subjective?.trim() ? encrypt(data.subjective.trim()) : null,
      data.objective?.trim() ? encrypt(data.objective.trim()) : null,
      data.assessment?.trim() ? encrypt(data.assessment.trim()) : null,
      data.plan?.trim() ? encrypt(data.plan.trim()) : null,
      data.homework?.trim() ? encrypt(data.homework.trim()) : null,
      data.diagnosis ?? [],
      data.interventions ?? [],
      data.riskAssessment,
      data.suicidalIdeation,
      JSON.stringify(data.mentalStatus ?? {}),
      data.progressRating ?? null,
      data.goalsAddressed ?? [],
      data.nextSessionPlanned ?? null,
      data.followUpRequired,
    ]
  );

  res.status(201).json({ id: result.rows[0].id });
});

router.put('/:id', authenticate, requireTherapist, async (req: Request, res: Response) => {
  const therapistId = req.user!.userId;
  const { id } = req.params;
  const data = therapyNoteUpdateSchema.parse(req.body);

  const existing = await query<{ patient_id: string }>(
    'SELECT patient_id FROM therapy_notes WHERE id = $1 AND therapist_id = $2',
    [id, therapistId]
  );
  if (existing.rows.length === 0) throw new AppError('Notiz nicht gefunden', 404);

  await query(
    `UPDATE therapy_notes
     SET session_date = $1,
         session_duration = $2,
         subjective_encrypted = $3,
         objective_encrypted = $4,
         assessment_encrypted = $5,
         plan_encrypted = $6,
         homework_encrypted = $7,
         diagnosis = $8,
         interventions = $9,
         risk_assessment = $10,
         suicidal_ideation = $11,
         mental_status = $12,
         progress_rating = $13,
         goals_addressed = $14,
         next_session_planned = $15,
         follow_up_required = $16
     WHERE id = $17 AND therapist_id = $18`,
    [
      data.sessionDate,
      data.sessionDuration ?? null,
      data.subjective?.trim() ? encrypt(data.subjective.trim()) : null,
      data.objective?.trim() ? encrypt(data.objective.trim()) : null,
      data.assessment?.trim() ? encrypt(data.assessment.trim()) : null,
      data.plan?.trim() ? encrypt(data.plan.trim()) : null,
      data.homework?.trim() ? encrypt(data.homework.trim()) : null,
      data.diagnosis ?? [],
      data.interventions ?? [],
      data.riskAssessment,
      data.suicidalIdeation,
      JSON.stringify(data.mentalStatus ?? {}),
      data.progressRating ?? null,
      data.goalsAddressed ?? [],
      data.nextSessionPlanned ?? null,
      data.followUpRequired,
      id,
      therapistId,
    ]
  );

  res.json({ message: 'Notiz aktualisiert' });
});

router.delete('/:id', authenticate, requireTherapist, async (req: Request, res: Response) => {
  const therapistId = req.user!.userId;
  const { id } = req.params;

  await query('DELETE FROM therapy_notes WHERE id = $1 AND therapist_id = $2', [id, therapistId]);

  res.json({ message: 'Notiz gelöscht' });
});

export default router;
