import { Router, Request, Response } from 'express';
import { query } from '../database/init.js';
import { authenticate, requirePatient } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  medicationCreateSchema,
  medicationUpdateSchema,
  medicationDeactivateSchema,
  medicationIntakeSchema,
} from '../utils/validation.js';

const router = Router();

const MED_DB = {
  medications: [
    { name: 'Sertralin', genericName: 'Sertraline', category: 'antidepressant', commonDosages: ['25 mg', '50 mg', '100 mg'] },
    { name: 'Escitalopram', genericName: 'Escitalopram', category: 'antidepressant', commonDosages: ['5 mg', '10 mg', '20 mg'] },
    { name: 'Venlafaxin', genericName: 'Venlafaxine', category: 'antidepressant', commonDosages: ['37.5 mg', '75 mg', '150 mg'] },
    { name: 'Quetiapin', genericName: 'Quetiapine', category: 'antipsychotic', commonDosages: ['25 mg', '50 mg', '100 mg'] },
    { name: 'Lorazepam', genericName: 'Lorazepam', category: 'anxiolytic', commonDosages: ['0.5 mg', '1 mg', '2 mg'] },
    { name: 'Melatonin', genericName: 'Melatonin', category: 'sedative', commonDosages: ['1 mg', '2 mg', '5 mg'] },
  ],
  sideEffects: [
    'Übelkeit',
    'Schlafstörungen',
    'Müdigkeit',
    'Schwindel',
    'Kopfschmerzen',
    'Appetitveränderungen',
    'Nervosität',
    'Mundtrockenheit',
  ],
};

router.get('/', authenticate, requirePatient, async (req: Request, res: Response) => {
  const patientId = req.user!.userId;

  const result = await query<{
    id: string;
    name: string;
    generic_name: string | null;
    dosage: string;
    frequency: string;
    frequency_details: string | null;
    timing: string[];
    prescribed_by: string | null;
    start_date: string | null;
    end_date: string | null;
    reason: string | null;
    category: string | null;
    notes: string | null;
    side_effects: string[];
    is_active: boolean;
  }>(
    `SELECT
      id::text as id,
      name,
      generic_name,
      dosage,
      frequency,
      frequency_details,
      timing,
      prescribed_by,
      start_date::text as start_date,
      end_date::text as end_date,
      reason,
      category,
      notes,
      side_effects,
      is_active
     FROM patient_medications
     WHERE patient_id = $1
     ORDER BY is_active DESC, id DESC`,
    [patientId]
  );

  const medications = result.rows.map((m) => ({
    id: Number(m.id),
    name: m.name,
    genericName: m.generic_name ?? undefined,
    dosage: m.dosage,
    frequency: m.frequency,
    frequencyDetails: m.frequency_details ?? undefined,
    timing: m.timing ?? [],
    prescribedBy: m.prescribed_by ?? undefined,
    startDate: m.start_date ?? undefined,
    endDate: m.end_date ?? undefined,
    reason: m.reason ?? undefined,
    category: m.category ?? undefined,
    notes: m.notes ?? undefined,
    sideEffects: m.side_effects ?? [],
    isActive: m.is_active,
  }));

  res.json(medications);
});

router.get('/database', authenticate, requirePatient, async (_req: Request, res: Response) => {
  res.json(MED_DB);
});

router.post('/', authenticate, requirePatient, async (req: Request, res: Response) => {
  const patientId = req.user!.userId;
  const data = medicationCreateSchema.parse(req.body);

  const result = await query<{ id: string }>(
    `INSERT INTO patient_medications (
      patient_id,
      name,
      generic_name,
      dosage,
      frequency,
      frequency_details,
      timing,
      prescribed_by,
      start_date,
      reason,
      category,
      notes,
      side_effects,
      is_active
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,TRUE
    ) RETURNING id::text as id`,
    [
      patientId,
      data.name,
      data.genericName ?? null,
      data.dosage,
      data.frequency,
      data.frequencyDetails ?? null,
      data.timing ?? [],
      data.prescribedBy ?? null,
      data.startDate ?? null,
      data.reason ?? null,
      data.category ?? null,
      data.notes ?? null,
      data.sideEffects ?? [],
    ]
  );

  res.status(201).json({ id: Number(result.rows[0].id) });
});

router.put('/:id', authenticate, requirePatient, async (req: Request, res: Response) => {
  const patientId = req.user!.userId;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw new AppError('Ungültige ID', 400);

  const data = medicationUpdateSchema.parse(req.body);

  const existing = await query<{ id: string }>('SELECT id::text as id FROM patient_medications WHERE id = $1 AND patient_id = $2', [
    id,
    patientId,
  ]);
  if (existing.rows.length === 0) throw new AppError('Medikament nicht gefunden', 404);

  await query(
    `UPDATE patient_medications
     SET name = $1,
         generic_name = $2,
         dosage = $3,
         frequency = $4,
         frequency_details = $5,
         timing = $6,
         prescribed_by = $7,
         start_date = $8,
         reason = $9,
         category = $10,
         notes = $11,
         side_effects = $12
     WHERE id = $13 AND patient_id = $14`,
    [
      data.name,
      data.genericName ?? null,
      data.dosage,
      data.frequency,
      data.frequencyDetails ?? null,
      data.timing ?? [],
      data.prescribedBy ?? null,
      data.startDate ?? null,
      data.reason ?? null,
      data.category ?? null,
      data.notes ?? null,
      data.sideEffects ?? [],
      id,
      patientId,
    ]
  );

  res.json({ message: 'Medikament aktualisiert' });
});

router.post('/:id/deactivate', authenticate, requirePatient, async (req: Request, res: Response) => {
  const patientId = req.user!.userId;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw new AppError('Ungültige ID', 400);

  const data = medicationDeactivateSchema.parse(req.body);

  await query(
    `UPDATE patient_medications
     SET is_active = FALSE,
         end_date = $1
     WHERE id = $2 AND patient_id = $3`,
    [data.endDate ?? null, id, patientId]
  );

  res.json({ message: 'Medikament abgesetzt' });
});

router.delete('/:id', authenticate, requirePatient, async (req: Request, res: Response) => {
  const patientId = req.user!.userId;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw new AppError('Ungültige ID', 400);

  await query('DELETE FROM patient_medications WHERE id = $1 AND patient_id = $2', [id, patientId]);

  res.json({ message: 'Medikament gelöscht' });
});

router.post('/intake', authenticate, requirePatient, async (req: Request, res: Response) => {
  const patientId = req.user!.userId;
  const data = medicationIntakeSchema.parse(req.body);

  const med = await query<{ id: string; dosage: string; name: string }>(
    'SELECT id::text as id, dosage, name FROM patient_medications WHERE id = $1 AND patient_id = $2',
    [data.medicationId, patientId]
  );
  if (med.rows.length === 0) throw new AppError('Medikament nicht gefunden', 404);

  await query(
    `INSERT INTO medication_intake_log (
      patient_id,
      medication_id,
      taken,
      actual_time,
      skipped_reason,
      side_effects_noted,
      notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      patientId,
      data.medicationId,
      data.taken,
      data.actualTime ?? null,
      data.skippedReason ?? null,
      data.sideEffectsNoted ?? [],
      data.notes ?? null,
    ]
  );

  res.status(201).json({ message: 'Einnahme protokolliert' });
});

router.get('/intake', authenticate, requirePatient, async (req: Request, res: Response) => {
  const patientId = req.user!.userId;
  const days = Math.max(1, Math.min(365, Number(req.query.days ?? 7)));

  const result = await query<{
    id: string;
    medication_id: string;
    taken: boolean;
    scheduled_time: string | null;
    actual_time: string | null;
    skipped_reason: string | null;
    side_effects_noted: string[];
    notes: string | null;
    logged_at: string;
    name: string;
    dosage: string;
  }>(
    `SELECT
      l.id::text as id,
      l.medication_id::text as medication_id,
      l.taken,
      l.scheduled_time,
      l.actual_time,
      l.skipped_reason,
      l.side_effects_noted,
      l.notes,
      l.logged_at,
      m.name,
      m.dosage
     FROM medication_intake_log l
     JOIN patient_medications m ON m.id = l.medication_id
     WHERE l.patient_id = $1
       AND l.logged_at >= (CURRENT_TIMESTAMP - ($2::int || ' days')::interval)
     ORDER BY l.logged_at DESC`,
    [patientId, days]
  );

  const logs = result.rows.map((r) => ({
    id: Number(r.id),
    medicationId: Number(r.medication_id),
    medicationName: r.name,
    dosage: r.dosage,
    taken: r.taken,
    scheduledTime: r.scheduled_time ?? undefined,
    actualTime: r.actual_time ?? undefined,
    skippedReason: r.skipped_reason ?? undefined,
    sideEffectsNoted: r.side_effects_noted ?? [],
    notes: r.notes ?? undefined,
    loggedAt: r.logged_at,
  }));

  res.json(logs);
});

router.get('/adherence', authenticate, requirePatient, async (req: Request, res: Response) => {
  const patientId = req.user!.userId;
  const days = Math.max(1, Math.min(365, Number(req.query.days ?? 30)));

  const logs = await query<{
    medication_id: string;
    taken: boolean;
    side_effects_noted: string[];
  }>(
    `SELECT
      medication_id::text as medication_id,
      taken,
      side_effects_noted
     FROM medication_intake_log
     WHERE patient_id = $1
       AND logged_at >= (CURRENT_TIMESTAMP - ($2::int || ' days')::interval)`,
    [patientId, days]
  );

  const meds = await query<{
    id: string;
    name: string;
    dosage: string;
  }>('SELECT id::text as id, name, dosage FROM patient_medications WHERE patient_id = $1', [patientId]);

  const byMed = new Map<string, { taken: number; total: number }>();
  const sideEffectsCount = new Map<string, number>();

  for (const row of logs.rows) {
    const key = row.medication_id;
    const agg = byMed.get(key) ?? { taken: 0, total: 0 };
    agg.total += 1;
    if (row.taken) agg.taken += 1;
    byMed.set(key, agg);

    for (const effect of row.side_effects_noted ?? []) {
      sideEffectsCount.set(effect, (sideEffectsCount.get(effect) ?? 0) + 1);
    }
  }

  let overallTaken = 0;
  let overallTotal = 0;
  for (const agg of byMed.values()) {
    overallTaken += agg.taken;
    overallTotal += agg.total;
  }

  const byMedication = meds.rows.map((m) => {
    const agg = byMed.get(m.id) ?? { taken: 0, total: 0 };
    const rate = agg.total > 0 ? Math.round((agg.taken / agg.total) * 1000) / 10 : null;
    return {
      id: Number(m.id),
      name: m.name,
      dosage: m.dosage,
      adherenceRate: rate,
      taken: agg.taken,
      total: agg.total,
    };
  });

  const overallRate = overallTotal > 0 ? Math.round((overallTaken / overallTotal) * 1000) / 10 : null;

  const sideEffects = Array.from(sideEffectsCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([effect, count]) => ({ effect, count }));

  res.json({
    overall: {
      adherenceRate: overallRate,
      taken: overallTaken,
      total: overallTotal,
      period: `${days} Tage`,
    },
    byMedication,
    sideEffects,
  });
});

export default router;
