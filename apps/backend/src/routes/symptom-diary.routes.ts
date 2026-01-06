import { Router, Request, Response } from 'express';
import { query } from '../database/init.js';
import { authenticate, requirePatient } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { decrypt, encrypt } from '../utils/encryption.js';
import { symptomDiaryCreateSchema, symptomDiaryUpdateSchema } from '../utils/validation.js';

const router = Router();

router.get('/', authenticate, requirePatient, async (req: Request, res: Response) => {
  const patientId = req.user!.userId;

  const result = await query<{
    id: string;
    entry_date: string;
    mood_score: number;
    anxiety_level: number | null;
    sleep_quality: number | null;
    sleep_hours: string | null;
    energy_level: number | null;
    stress_level: number | null;
    symptoms: string[];
    triggers: string[];
    activities: string[];
    medications: any;
    notes_encrypted: string | null;
  }>(
    `SELECT
      id,
      entry_date::text as entry_date,
      mood_score,
      anxiety_level,
      sleep_quality,
      sleep_hours::text as sleep_hours,
      energy_level,
      stress_level,
      symptoms,
      triggers,
      activities,
      medications,
      notes_encrypted
     FROM symptom_diary_entries
     WHERE patient_id = $1
     ORDER BY entry_date DESC`,
    [patientId]
  );

  const entries = result.rows.map((r) => ({
    id: r.id,
    entry_date: r.entry_date,
    mood_score: r.mood_score,
    anxiety_level: r.anxiety_level ?? undefined,
    sleep_quality: r.sleep_quality ?? undefined,
    sleep_hours: r.sleep_hours != null ? Number(r.sleep_hours) : undefined,
    energy_level: r.energy_level ?? undefined,
    stress_level: r.stress_level ?? undefined,
    symptoms: r.symptoms ?? [],
    triggers: r.triggers ?? [],
    activities: r.activities ?? [],
    medications: (r.medications as any) ?? [],
    notes: r.notes_encrypted ? decrypt(r.notes_encrypted) : undefined,
  }));

  res.json(entries);
});

router.get('/stats', authenticate, requirePatient, async (req: Request, res: Response) => {
  const patientId = req.user!.userId;

  const totals = await query<{
    total: string;
    avg_mood: string | null;
    avg_anxiety: string | null;
    avg_sleep_quality: string | null;
    avg_sleep_hours: string | null;
    avg_energy: string | null;
    avg_stress: string | null;
  }>(
    `SELECT
      COUNT(*)::text as total,
      AVG(mood_score)::text as avg_mood,
      AVG(anxiety_level)::text as avg_anxiety,
      AVG(sleep_quality)::text as avg_sleep_quality,
      AVG(sleep_hours)::text as avg_sleep_hours,
      AVG(energy_level)::text as avg_energy,
      AVG(stress_level)::text as avg_stress
     FROM symptom_diary_entries
     WHERE patient_id = $1`,
    [patientId]
  );

  // Trend: compare last 7 days vs previous 7 days
  const trendRows = await query<{
    bucket: 'recent' | 'previous';
    avg_mood: string | null;
  }>(
    `SELECT
      CASE
        WHEN entry_date >= (CURRENT_DATE - INTERVAL '6 days') THEN 'recent'
        WHEN entry_date >= (CURRENT_DATE - INTERVAL '13 days') THEN 'previous'
        ELSE NULL
      END as bucket,
      AVG(mood_score)::text as avg_mood
     FROM symptom_diary_entries
     WHERE patient_id = $1
       AND entry_date >= (CURRENT_DATE - INTERVAL '13 days')
     GROUP BY 1`,
    [patientId]
  );

  const recent = trendRows.rows.find((r) => r.bucket === 'recent')?.avg_mood;
  const previous = trendRows.rows.find((r) => r.bucket === 'previous')?.avg_mood;

  let moodTrend: 'improving' | 'declining' | 'stable' = 'stable';
  if (recent != null && previous != null) {
    const dr = Number(recent) - Number(previous);
    if (dr >= 0.5) moodTrend = 'improving';
    else if (dr <= -0.5) moodTrend = 'declining';
  }

  const row = totals.rows[0];

  res.json({
    averages: {
      mood: row?.avg_mood != null ? Number(row.avg_mood) : null,
      anxiety: row?.avg_anxiety != null ? Number(row.avg_anxiety) : null,
      sleepQuality: row?.avg_sleep_quality != null ? Number(row.avg_sleep_quality) : null,
      sleepHours: row?.avg_sleep_hours != null ? Number(row.avg_sleep_hours) : null,
      energy: row?.avg_energy != null ? Number(row.avg_energy) : null,
      stress: row?.avg_stress != null ? Number(row.avg_stress) : null,
    },
    totalEntries: row ? Number(row.total) : 0,
    moodTrend,
  });
});

router.post('/', authenticate, requirePatient, async (req: Request, res: Response) => {
  const patientId = req.user!.userId;
  const data = symptomDiaryCreateSchema.parse(req.body);

  const notesEncrypted = data.notes?.trim() ? encrypt(data.notes.trim()) : null;

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO symptom_diary_entries (
        patient_id,
        entry_date,
        mood_score,
        anxiety_level,
        sleep_quality,
        sleep_hours,
        energy_level,
        stress_level,
        symptoms,
        triggers,
        activities,
        medications,
        notes_encrypted
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
      )
      RETURNING id`,
      [
        patientId,
        data.date,
        data.moodScore,
        data.anxietyLevel ?? null,
        data.sleepQuality ?? null,
        data.sleepHours ?? null,
        data.energyLevel ?? null,
        data.stressLevel ?? null,
        data.symptoms ?? [],
        data.triggers ?? [],
        data.activities ?? [],
        JSON.stringify(data.medications ?? []),
        notesEncrypted,
      ]
    );

    res.status(201).json({ id: result.rows[0].id });
  } catch (err: any) {
    // Unique violation
    if (err?.code === '23505') {
      throw new AppError('Für dieses Datum existiert bereits ein Eintrag', 409);
    }
    throw err;
  }
});

router.put('/:id', authenticate, requirePatient, async (req: Request, res: Response) => {
  const patientId = req.user!.userId;
  const { id } = req.params;
  const data = symptomDiaryUpdateSchema.parse(req.body);

  const notesEncrypted = data.notes?.trim() ? encrypt(data.notes.trim()) : null;

  const existing = await query<{ id: string }>(
    'SELECT id FROM symptom_diary_entries WHERE id = $1 AND patient_id = $2',
    [id, patientId]
  );
  if (existing.rows.length === 0) throw new AppError('Eintrag nicht gefunden', 404);

  await query(
    `UPDATE symptom_diary_entries
     SET entry_date = $1,
         mood_score = $2,
         anxiety_level = $3,
         sleep_quality = $4,
         sleep_hours = $5,
         energy_level = $6,
         stress_level = $7,
         symptoms = $8,
         triggers = $9,
         activities = $10,
         medications = $11,
         notes_encrypted = $12
     WHERE id = $13 AND patient_id = $14`,
    [
      data.date,
      data.moodScore,
      data.anxietyLevel ?? null,
      data.sleepQuality ?? null,
      data.sleepHours ?? null,
      data.energyLevel ?? null,
      data.stressLevel ?? null,
      data.symptoms ?? [],
      data.triggers ?? [],
      data.activities ?? [],
      JSON.stringify(data.medications ?? []),
      notesEncrypted,
      id,
      patientId,
    ]
  );

  res.json({ message: 'Eintrag aktualisiert' });
});

router.delete('/:id', authenticate, requirePatient, async (req: Request, res: Response) => {
  const patientId = req.user!.userId;
  const { id } = req.params;

  const result = await query('DELETE FROM symptom_diary_entries WHERE id = $1 AND patient_id = $2', [id, patientId]);
  if ((result as any).rowCount === 0) throw new AppError('Eintrag nicht gefunden', 404);

  res.json({ message: 'Eintrag gelöscht' });
});

export default router;
