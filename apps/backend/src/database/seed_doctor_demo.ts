/**
 * Doctor Demo Seed
 *
 * Creates a small but realistic dataset for manual doctor testing:
 * - multiple therapists + patients (each with their own password)
 * - appointments in various states (available/booked/completed/cancelled)
 * - messages tied to an appointment
 * - a couple of payment records (dummy Stripe IDs)
 *
 * Idempotent: re-running should not duplicate core entities.
 */

import bcrypt from 'bcrypt';
import { initDatabase, query } from './init.js';
import { encrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

type UserRole = 'therapist' | 'patient';

type DemoUser = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  licenseNumber?: string;
  specialization?: string;
  hourlyRate?: number;
};

async function ensureUser(params: DemoUser): Promise<{ id: string; created: boolean }> {
  const existing = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [params.email]);
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, created: false };
  }

  const passwordHash = await bcrypt.hash(params.password, 12);

  const result = await query<{ id: string }>(
    `INSERT INTO users (
      email,
      password_hash,
      role,
      first_name_encrypted,
      last_name_encrypted,
      phone_encrypted,
      license_number,
      specialization,
      hourly_rate,
      gdpr_consent_at,
      is_verified
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6,
      $7, $8, $9,
      CURRENT_TIMESTAMP,
      TRUE
    )
    RETURNING id`,
    [
      params.email,
      passwordHash,
      params.role,
      encrypt(params.firstName),
      encrypt(params.lastName),
      params.phone ? encrypt(params.phone) : null,
      params.licenseNumber ?? null,
      params.specialization ?? null,
      params.hourlyRate ?? null,
    ]
  );

  return { id: result.rows[0].id, created: true };
}

type AppointmentStatus = 'available' | 'booked' | 'completed' | 'cancelled';
type AppointmentType = 'video' | 'audio' | 'in-person';
type PaymentStatus = 'pending' | 'paid' | 'refunded';

type DemoAppointment = {
  therapistId: string;
  patientId?: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  appointmentType: AppointmentType;
  price?: number;
  paymentStatus?: PaymentStatus;
  roomId: string;
  patientNotes?: string;
  therapistNotes?: string;
  cancelledAt?: string;
  completedAt?: string;
};

async function ensureAppointment(apt: DemoAppointment): Promise<{ id: string; created: boolean }> {
  const existing = await query<{ id: string }>(
    `SELECT id
     FROM appointments
     WHERE therapist_id = $1 AND start_time = $2 AND end_time = $3`,
    [apt.therapistId, apt.startTime, apt.endTime]
  );

  const durationMinutes = Math.max(
    5,
    Math.floor((new Date(apt.endTime).getTime() - new Date(apt.startTime).getTime()) / 60000)
  );

  const patientNotesEncrypted = apt.patientNotes ? encrypt(apt.patientNotes) : null;
  const therapistNotesEncrypted = apt.therapistNotes ? encrypt(apt.therapistNotes) : null;

  if (existing.rows.length > 0) {
    const id = existing.rows[0].id;
    await query(
      `UPDATE appointments
       SET patient_id = $1,
           duration_minutes = $2,
           status = $3,
           appointment_type = $4,
           price = $5,
           payment_status = $6,
           room_id = $7,
           patient_notes_encrypted = $8,
           therapist_notes_encrypted = $9,
           cancelled_at = $10,
           completed_at = $11
       WHERE id = $12`,
      [
        apt.patientId ?? null,
        durationMinutes,
        apt.status,
        apt.appointmentType,
        apt.price ?? null,
        apt.paymentStatus ?? 'pending',
        apt.roomId,
        patientNotesEncrypted,
        therapistNotesEncrypted,
        apt.cancelledAt ?? null,
        apt.completedAt ?? null,
        id,
      ]
    );
    return { id, created: false };
  }

  const result = await query<{ id: string }>(
    `INSERT INTO appointments (
      therapist_id,
      patient_id,
      start_time,
      end_time,
      duration_minutes,
      status,
      appointment_type,
      therapist_notes_encrypted,
      patient_notes_encrypted,
      price,
      payment_status,
      room_id,
      cancelled_at,
      completed_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
    )
    RETURNING id`,
    [
      apt.therapistId,
      apt.patientId ?? null,
      apt.startTime,
      apt.endTime,
      durationMinutes,
      apt.status,
      apt.appointmentType,
      therapistNotesEncrypted,
      patientNotesEncrypted,
      apt.price ?? null,
      apt.paymentStatus ?? 'pending',
      apt.roomId,
      apt.cancelledAt ?? null,
      apt.completedAt ?? null,
    ]
  );

  return { id: result.rows[0].id, created: true };
}

async function ensurePayment(params: {
  appointmentId: string;
  patientId: string;
  therapistId: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  stripePaymentIntentId: string;
  description: string;
  paidAt?: string;
}): Promise<{ id: string; created: boolean }> {
  const existing = await query<{ id: string }>('SELECT id FROM payments WHERE stripe_payment_intent_id = $1', [
    params.stripePaymentIntentId,
  ]);
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, created: false };
  }

  const result = await query<{ id: string }>(
    `INSERT INTO payments (
      appointment_id,
      patient_id,
      therapist_id,
      stripe_payment_intent_id,
      amount,
      currency,
      status,
      description,
      paid_at
    ) VALUES ($1,$2,$3,$4,$5,'EUR',$6,$7,$8)
    RETURNING id`,
    [
      params.appointmentId,
      params.patientId,
      params.therapistId,
      params.stripePaymentIntentId,
      params.amount,
      params.status,
      params.description,
      params.paidAt ?? null,
    ]
  );

  return { id: result.rows[0].id, created: true };
}

async function maybeSeedMessages(params: {
  appointmentId: string;
  therapistId: string;
  patientId: string;
  thread: Array<{ from: 'therapist' | 'patient'; content: string; createdAt: string }>;
}): Promise<{ inserted: number }> {
  const count = await query<{ c: string }>('SELECT COUNT(*)::text as c FROM messages WHERE appointment_id = $1', [
    params.appointmentId,
  ]);
  const existingCount = Number(count.rows[0]?.c ?? '0');
  if (existingCount > 0) return { inserted: 0 };

  let inserted = 0;
  for (const msg of params.thread) {
    const senderId = msg.from === 'therapist' ? params.therapistId : params.patientId;
    const receiverId = msg.from === 'therapist' ? params.patientId : params.therapistId;
    await query(
      `INSERT INTO messages (sender_id, receiver_id, appointment_id, content_encrypted, created_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [senderId, receiverId, params.appointmentId, encrypt(msg.content), msg.createdAt]
    );
    inserted++;
  }

  return { inserted };
}

function iso(d: Date): string {
  return d.toISOString();
}

function yyyyMmDd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function ensureSymptomDiaryEntry(params: {
  patientId: string;
  date: string;
  moodScore: number;
  anxietyLevel?: number;
  sleepQuality?: number;
  sleepHours?: number;
  energyLevel?: number;
  stressLevel?: number;
  symptoms?: string[];
  triggers?: string[];
  activities?: string[];
  medications?: Array<{ name: string; dosage?: string; taken: boolean }>;
  notes?: string;
}): Promise<void> {
  await query(
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
    ON CONFLICT (patient_id, entry_date) DO NOTHING`,
    [
      params.patientId,
      params.date,
      params.moodScore,
      params.anxietyLevel ?? null,
      params.sleepQuality ?? null,
      params.sleepHours ?? null,
      params.energyLevel ?? null,
      params.stressLevel ?? null,
      params.symptoms ?? [],
      params.triggers ?? [],
      params.activities ?? [],
      JSON.stringify(params.medications ?? []),
      params.notes?.trim() ? encrypt(params.notes.trim()) : null,
    ]
  );
}

async function ensureMedication(params: {
  patientId: string;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  frequencyDetails?: string;
  timing?: string[];
  prescribedBy?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  category?: string;
  notes?: string;
  sideEffects?: string[];
  isActive?: boolean;
}): Promise<{ id: number; created: boolean }> {
  const existing = await query<{ id: string }>(
    `SELECT id::text as id
     FROM patient_medications
     WHERE patient_id = $1 AND name = $2 AND dosage = $3 AND frequency = $4
     ORDER BY id DESC
     LIMIT 1`,
    [params.patientId, params.name, params.dosage, params.frequency]
  );
  if (existing.rows.length > 0) {
    return { id: Number(existing.rows[0].id), created: false };
  }

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
      end_date,
      reason,
      category,
      notes,
      side_effects,
      is_active
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
    ) RETURNING id::text as id`,
    [
      params.patientId,
      params.name,
      params.genericName ?? null,
      params.dosage,
      params.frequency,
      params.frequencyDetails ?? null,
      params.timing ?? [],
      params.prescribedBy ?? null,
      params.startDate ?? null,
      params.endDate ?? null,
      params.reason ?? null,
      params.category ?? null,
      params.notes ?? null,
      params.sideEffects ?? [],
      params.isActive ?? true,
    ]
  );

  return { id: Number(result.rows[0].id), created: true };
}

async function ensureMedicationIntake(params: {
  patientId: string;
  medicationId: number;
  taken: boolean;
  actualTime?: string;
  skippedReason?: string;
  sideEffectsNoted?: string[];
  notes?: string;
  loggedAt: string;
}): Promise<void> {
  const existing = await query<{ c: string }>(
    `SELECT COUNT(*)::text as c
     FROM medication_intake_log
     WHERE patient_id = $1 AND medication_id = $2 AND logged_at = $3`,
    [params.patientId, params.medicationId, params.loggedAt]
  );
  if (Number(existing.rows[0]?.c ?? '0') > 0) return;

  await query(
    `INSERT INTO medication_intake_log (
      patient_id,
      medication_id,
      taken,
      actual_time,
      skipped_reason,
      side_effects_noted,
      notes,
      logged_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      params.patientId,
      params.medicationId,
      params.taken,
      params.actualTime ?? null,
      params.skippedReason ?? null,
      params.sideEffectsNoted ?? [],
      params.notes ?? null,
      params.loggedAt,
    ]
  );
}

async function ensureTherapyNote(params: {
  therapistId: string;
  patientId: string;
  sessionDate: string;
  sessionDuration?: number;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  diagnosis?: string[];
  interventions?: string[];
  homework?: string;
  riskAssessment?: 'none' | 'low' | 'moderate' | 'high' | 'acute';
  suicidalIdeation?: boolean;
  mentalStatus?: Record<string, any>;
  progressRating?: number;
  goalsAddressed?: string[];
  nextSessionPlanned?: string;
  followUpRequired?: boolean;
}): Promise<void> {
  const existing = await query<{ id: string }>(
    `SELECT id
     FROM therapy_notes
     WHERE therapist_id = $1 AND patient_id = $2 AND session_date = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [params.therapistId, params.patientId, params.sessionDate]
  );
  if (existing.rows.length > 0) return;

  await query(
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
    )`,
    [
      params.therapistId,
      params.patientId,
      params.sessionDate,
      params.sessionDuration ?? 50,
      params.subjective?.trim() ? encrypt(params.subjective.trim()) : null,
      params.objective?.trim() ? encrypt(params.objective.trim()) : null,
      params.assessment?.trim() ? encrypt(params.assessment.trim()) : null,
      params.plan?.trim() ? encrypt(params.plan.trim()) : null,
      params.homework?.trim() ? encrypt(params.homework.trim()) : null,
      params.diagnosis ?? [],
      params.interventions ?? [],
      params.riskAssessment ?? 'none',
      params.suicidalIdeation ?? false,
      JSON.stringify(params.mentalStatus ?? {}),
      params.progressRating ?? 3,
      params.goalsAddressed ?? [],
      params.nextSessionPlanned ?? null,
      params.followUpRequired ?? false,
    ]
  );
}

async function ensureBillingSettings(params: {
  therapistId: string;
  practiceName: string;
  addressLine1: string;
  zipCode: string;
  city: string;
  taxId: string;
  bankName: string;
  iban: string;
  bic: string;
  invoiceFooter?: string;
  nextInvoiceNumber?: number;
}): Promise<void> {
  await query(
    `INSERT INTO billing_settings (
      therapist_id,
      practice_name,
      address_line1,
      zip_code,
      city,
      tax_id,
      bank_name,
      iban,
      bic,
      invoice_footer,
      next_invoice_number
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (therapist_id) DO NOTHING`,
    [
      params.therapistId,
      params.practiceName,
      params.addressLine1,
      params.zipCode,
      params.city,
      params.taxId,
      params.bankName,
      params.iban,
      params.bic,
      params.invoiceFooter ?? null,
      params.nextInvoiceNumber ?? 1000,
    ]
  );
}

async function ensureInvoice(params: {
  therapistId: string;
  patientId: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  items: Array<{ description: string; code?: string; factor?: number; price: number }>;
  taxRate?: number;
  notes?: string;
  status?: 'draft' | 'sent' | 'paid';
}): Promise<void> {
  const existing = await query<{ id: string }>(
    `SELECT id::text as id
     FROM invoices
     WHERE therapist_id = $1 AND invoice_number = $2`,
    [params.therapistId, params.invoiceNumber]
  );
  if (existing.rows.length > 0) return;

  const total = params.items.reduce((sum, it) => sum + Number(it.price ?? 0), 0);

  await query(
    `INSERT INTO invoices (
      therapist_id,
      patient_id,
      invoice_number,
      invoice_date,
      due_date,
      items,
      tax_rate,
      notes,
      total,
      status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      params.therapistId,
      params.patientId,
      params.invoiceNumber,
      params.date,
      params.dueDate,
      JSON.stringify(params.items),
      params.taxRate ?? 0,
      params.notes ?? null,
      total,
      params.status ?? 'draft',
    ]
  );
}

async function ensureQuestionnaireDemo(params: { therapistId: string; patientId: string; appointmentId?: string }): Promise<void> {
  const tmplExisting = await query<{ id: string }>(
    `SELECT id
     FROM questionnaire_templates
     WHERE therapist_id = $1 AND title = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [params.therapistId, 'Kurz-Anamnese (Demo)']
  );

  let templateId = tmplExisting.rows[0]?.id;
  if (!templateId) {
    const inserted = await query<{ id: string }>(
      `INSERT INTO questionnaire_templates (
        therapist_id,
        title,
        description,
        category,
        form_schema,
        is_active,
        is_template
      ) VALUES ($1,$2,$3,$4,$5,TRUE,TRUE)
      RETURNING id`,
      [
        params.therapistId,
        'Kurz-Anamnese (Demo)',
        'Kurzer Fragebogen für die Vorbereitung der ersten Sitzung',
        'anamnese',
        JSON.stringify({
          fields: [
            { id: 'topic', type: 'textarea', label: 'Worum geht es Ihnen aktuell?', required: true },
            { id: 'sleep', type: 'radio', label: 'Wie war Ihr Schlaf in der letzten Woche?', options: ['gut', 'mittel', 'schlecht'], required: true },
            { id: 'stress', type: 'select', label: 'Aktuelles Stressniveau', options: ['0-3', '4-6', '7-10'], required: true },
          ],
        }),
      ]
    );
    templateId = inserted.rows[0].id;
  }

  const reqExisting = await query<{ id: string }>(
    `SELECT id
     FROM questionnaire_requests
     WHERE therapist_id = $1 AND patient_id = $2 AND questionnaire_template_id = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [params.therapistId, params.patientId, templateId]
  );

  let requestId = reqExisting.rows[0]?.id;
  if (!requestId) {
    const inserted = await query<{ id: string }>(
      `INSERT INTO questionnaire_requests (
        questionnaire_template_id,
        therapist_id,
        patient_id,
        appointment_id,
        title,
        instructions,
        status,
        priority
      ) VALUES ($1,$2,$3,$4,$5,$6,'pending','normal')
      RETURNING id`,
      [
        templateId,
        params.therapistId,
        params.patientId,
        params.appointmentId ?? null,
        'Kurz-Anamnese vor Erstgespräch (Demo)',
        'Bitte füllen Sie den Fragebogen vor dem Termin aus.',
      ]
    );
    requestId = inserted.rows[0].id;
  }

  // Create a draft response if none exists
  const respExisting = await query<{ c: string }>(
    'SELECT COUNT(*)::text as c FROM questionnaire_responses WHERE request_id = $1',
    [requestId]
  );
  if (Number(respExisting.rows[0]?.c ?? '0') > 0) return;

  const responses = {
    topic: { answer: 'Ich möchte besser mit Stress und Schlafproblemen umgehen.', type: 'textarea', answered_at: new Date().toISOString() },
    sleep: { answer: 'mittel', type: 'radio', answered_at: new Date().toISOString() },
    stress: { answer: '4-6', type: 'select', answered_at: new Date().toISOString() },
  };

  await query(
    `INSERT INTO questionnaire_responses (
      request_id,
      patient_id,
      responses_encrypted,
      status,
      progress_percentage,
      submitted_at
    ) VALUES ($1,$2,$3,'submitted',100,CURRENT_TIMESTAMP)`,
    [requestId, params.patientId, encrypt(JSON.stringify(responses))]
  );
}

async function main(): Promise<void> {
  await initDatabase();

  // Deterministic demo users (each with its own password).
  const demoUsers: DemoUser[] = [
    {
      email: 'musterarzt1@test.de',
      password: 'ArztDemo1!2026',
      firstName: 'Dr. Lara',
      lastName: 'Weber',
      role: 'therapist',
      phone: '+4915111111111',
      specialization: 'Psychotherapie',
      licenseNumber: 'DE-DEMO-1001',
      hourlyRate: 110,
    },
    {
      email: 'musterarzt2@test.de',
      password: 'ArztDemo2!2026',
      firstName: 'Dr. Jonas',
      lastName: 'Klein',
      role: 'therapist',
      phone: '+4915222222222',
      specialization: 'Neurologie',
      licenseNumber: 'DE-DEMO-1002',
      hourlyRate: 130,
    },
    {
      email: 'musterpatient1@test.de',
      password: 'PatientDemo1!2026',
      firstName: 'Mia',
      lastName: 'Hoffmann',
      role: 'patient',
      phone: '+4915333333333',
    },
    {
      email: 'musterpatient2@test.de',
      password: 'PatientDemo2!2026',
      firstName: 'Noah',
      lastName: 'Schneider',
      role: 'patient',
      phone: '+4915444444444',
    },
    {
      email: 'musterpatient3@test.de',
      password: 'PatientDemo3!2026',
      firstName: 'Emma',
      lastName: 'Fischer',
      role: 'patient',
      phone: '+4915555555555',
    },
    {
      email: 'musterpatient4@test.de',
      password: 'PatientDemo4!2026',
      firstName: 'Paul',
      lastName: 'Wagner',
      role: 'patient',
      phone: '+4915666666666',
    },
  ];

  const createdUsers: Array<{ email: string; password: string; role: UserRole; id: string; created: boolean }> = [];
  const userIdsByEmail = new Map<string, string>();

  for (const u of demoUsers) {
    const ensured = await ensureUser(u);
    userIdsByEmail.set(u.email, ensured.id);
    createdUsers.push({ email: u.email, password: u.password, role: u.role, id: ensured.id, created: ensured.created });
  }

  // Also ensure the existing deterministic test accounts still exist.
  const deterministic = [
    {
      email: 'therapeut@test.de',
      password: 'Test123!',
      firstName: 'Dr. Anna',
      lastName: 'Schmidt',
      role: 'therapist' as const,
      phone: '+49123456789',
      specialization: 'Neurologie',
      licenseNumber: 'DE-12345',
      hourlyRate: 120,
    },
    {
      email: 'patient@test.de',
      password: 'Test123!',
      firstName: 'Max',
      lastName: 'Mustermann',
      role: 'patient' as const,
      phone: '+49987654321',
    },
  ];
  for (const u of deterministic) {
    const ensured = await ensureUser(u);
    userIdsByEmail.set(u.email, ensured.id);
    createdUsers.push({ email: u.email, password: u.password, role: u.role, id: ensured.id, created: ensured.created });
  }

  const t1 = userIdsByEmail.get('musterarzt1@test.de')!;
  const t2 = userIdsByEmail.get('musterarzt2@test.de')!;
  const p1 = userIdsByEmail.get('musterpatient1@test.de')!;
  const p2 = userIdsByEmail.get('musterpatient2@test.de')!;
  const p3 = userIdsByEmail.get('musterpatient3@test.de')!;
  const p4 = userIdsByEmail.get('musterpatient4@test.de')!;
  const p0 = userIdsByEmail.get('patient@test.de')!;

  // Fixed, relative timestamps for predictable dataset.
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  const appointmentsToSeed: DemoAppointment[] = [
    // Therapist 1: mix of available/booked/completed/cancelled
    {
      therapistId: t1,
      startTime: iso(new Date(now.getTime() + 1 * day)),
      endTime: iso(new Date(now.getTime() + 1 * day + 50 * 60 * 1000)),
      status: 'available',
      appointmentType: 'video',
      price: 85,
      paymentStatus: 'pending',
      roomId: 'demo-room-t1-01',
    },
    {
      therapistId: t1,
      patientId: p1,
      startTime: iso(new Date(now.getTime() + 2 * day)),
      endTime: iso(new Date(now.getTime() + 2 * day + 50 * 60 * 1000)),
      status: 'booked',
      appointmentType: 'video',
      price: 95,
      paymentStatus: 'pending',
      roomId: 'demo-room-t1-02',
      patientNotes: 'Ich habe seit einigen Wochen Schlafprobleme und möchte darüber sprechen.',
    },
    {
      therapistId: t1,
      patientId: p2,
      startTime: iso(new Date(now.getTime() - 3 * day)),
      endTime: iso(new Date(now.getTime() - 3 * day + 50 * 60 * 1000)),
      status: 'completed',
      appointmentType: 'in-person',
      price: 120,
      paymentStatus: 'paid',
      roomId: 'demo-room-t1-03',
      patientNotes: 'Kurze Notiz: Stress in der Arbeit nimmt zu.',
      therapistNotes: 'Erstgespräch, Anamnese begonnen. Nächster Schritt: Schlafhygiene-Protokoll.',
      completedAt: iso(new Date(now.getTime() - 3 * day + 55 * 60 * 1000)),
    },
    {
      therapistId: t1,
      patientId: p3,
      startTime: iso(new Date(now.getTime() - 7 * day)),
      endTime: iso(new Date(now.getTime() - 7 * day + 50 * 60 * 1000)),
      status: 'cancelled',
      appointmentType: 'audio',
      price: 70,
      paymentStatus: 'refunded',
      roomId: 'demo-room-t1-04',
      patientNotes: 'Termin musste kurzfristig verschoben werden.',
      cancelledAt: iso(new Date(now.getTime() - 7 * day + 10 * 60 * 1000)),
    },

    // Therapist 2: more future slots
    {
      therapistId: t2,
      startTime: iso(new Date(now.getTime() + 1 * day + 2 * 60 * 60 * 1000)),
      endTime: iso(new Date(now.getTime() + 1 * day + 2 * 60 * 60 * 1000 + 50 * 60 * 1000)),
      status: 'available',
      appointmentType: 'video',
      price: 90,
      paymentStatus: 'pending',
      roomId: 'demo-room-t2-01',
    },
    {
      therapistId: t2,
      patientId: p4,
      startTime: iso(new Date(now.getTime() + 4 * day)),
      endTime: iso(new Date(now.getTime() + 4 * day + 50 * 60 * 1000)),
      status: 'booked',
      appointmentType: 'video',
      price: 100,
      paymentStatus: 'pending',
      roomId: 'demo-room-t2-02',
      patientNotes: 'Angst vor Präsentationen, möchte Strategien erarbeiten.',
    },
    {
      therapistId: t2,
      patientId: p0,
      startTime: iso(new Date(now.getTime() - 2 * day)),
      endTime: iso(new Date(now.getTime() - 2 * day + 50 * 60 * 1000)),
      status: 'completed',
      appointmentType: 'video',
      price: 110,
      paymentStatus: 'paid',
      roomId: 'demo-room-t2-03',
      patientNotes: 'Follow-up: Stimmungsschwankungen in letzter Zeit.',
      therapistNotes: 'Follow-up durchgeführt. Übung: Atemtechnik + Journaling bis nächster Termin.',
      completedAt: iso(new Date(now.getTime() - 2 * day + 55 * 60 * 1000)),
    },
  ];

  const createdAppointments: Array<{ id: string; created: boolean; roomId: string }> = [];
  const appointmentIdsByRoom = new Map<string, string>();

  for (const apt of appointmentsToSeed) {
    const ensured = await ensureAppointment(apt);
    createdAppointments.push({ id: ensured.id, created: ensured.created, roomId: apt.roomId });
    appointmentIdsByRoom.set(apt.roomId, ensured.id);
  }

  // Payments for completed appointments
  const completedApt1 = appointmentIdsByRoom.get('demo-room-t1-03')!;
  const completedApt2 = appointmentIdsByRoom.get('demo-room-t2-03')!;

  const pay1 = await ensurePayment({
    appointmentId: completedApt1,
    patientId: p2,
    therapistId: t1,
    amount: 120,
    status: 'succeeded',
    stripePaymentIntentId: `pi_demo_${completedApt1.replace(/-/g, '').slice(0, 16)}`,
    description: 'Demo-Zahlung (abgeschlossen) – Termin t1-03',
    paidAt: iso(new Date(now.getTime() - 3 * day + 56 * 60 * 1000)),
  });
  const pay2 = await ensurePayment({
    appointmentId: completedApt2,
    patientId: p0,
    therapistId: t2,
    amount: 110,
    status: 'succeeded',
    stripePaymentIntentId: `pi_demo_${completedApt2.replace(/-/g, '').slice(0, 16)}`,
    description: 'Demo-Zahlung (abgeschlossen) – Termin t2-03',
    paidAt: iso(new Date(now.getTime() - 2 * day + 56 * 60 * 1000)),
  });

  // Link payments to appointments for UI testing
  await query('UPDATE appointments SET payment_id = $1 WHERE id = $2 AND payment_id IS NULL', [pay1.id, completedApt1]);
  await query('UPDATE appointments SET payment_id = $1 WHERE id = $2 AND payment_id IS NULL', [pay2.id, completedApt2]);

  // Messages for one booked appointment (t1-02)
  const bookedApt = appointmentIdsByRoom.get('demo-room-t1-02')!;
  const msgSeed = await maybeSeedMessages({
    appointmentId: bookedApt,
    therapistId: t1,
    patientId: p1,
    thread: [
      {
        from: 'patient',
        content: 'Hallo, ich freue mich auf den Termin. Gibt es etwas, das ich vorbereiten soll?',
        createdAt: iso(new Date(now.getTime() + 1 * day + 1 * 60 * 60 * 1000)),
      },
      {
        from: 'therapist',
        content: 'Hallo! Bringen Sie gern eine kurze Liste Ihrer wichtigsten Themen mit. Wir klären alles im Gespräch.',
        createdAt: iso(new Date(now.getTime() + 1 * day + 1 * 60 * 60 * 1000 + 5 * 60 * 1000)),
      },
      {
        from: 'patient',
        content: 'Super, danke. Ich notiere mir Schlaf, Stress und Konzentration.',
        createdAt: iso(new Date(now.getTime() + 1 * day + 1 * 60 * 60 * 1000 + 12 * 60 * 1000)),
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // Rich demo data for requested modules: diary, medications, therapy notes,
  // forms (questionnaires), billing/invoices.
  // ---------------------------------------------------------------------------

  // Symptom diary: 21 days for patient p1
  const diarySymptoms = ['Schlafstörungen', 'Innere Unruhe', 'Konzentrationsprobleme'];
  const diaryTriggers = ['Arbeitsstress', 'Schlafmangel', 'Soziale Medien'];
  const diaryActivities = ['Spaziergang', 'Meditation', 'Sport/Bewegung'];

  for (let i = 0; i < 21; i++) {
    const d = new Date(now.getTime() - i * day);
    const mood = Math.max(2, Math.min(9, 4 + Math.round(Math.sin(i / 3) * 2) + (i % 3)));
    await ensureSymptomDiaryEntry({
      patientId: p1,
      date: yyyyMmDd(d),
      moodScore: mood,
      anxietyLevel: Math.max(0, 7 - (i % 5)),
      sleepQuality: Math.max(1, 4 - (i % 3)),
      sleepHours: 6 + ((i % 4) * 0.5),
      energyLevel: Math.max(1, 6 - (i % 4)),
      stressLevel: Math.max(0, 8 - (i % 6)),
      symptoms: diarySymptoms.slice(0, (i % 3) + 1),
      triggers: diaryTriggers.slice(0, (i % 3) + 1),
      activities: diaryActivities.slice(0, (i % 3) + 1),
      medications: [
        { name: 'Sertralin', dosage: '50 mg', taken: i % 5 !== 0 },
        { name: 'Melatonin', dosage: '2 mg', taken: i % 2 === 0 },
      ],
      notes: i % 4 === 0 ? 'Heute ging es etwas besser. Schlafhygiene-Übungen ausprobiert.' : undefined,
    });
  }

  // Medications + intake logs for p1
  const med1 = await ensureMedication({
    patientId: p1,
    name: 'Sertralin',
    genericName: 'Sertraline',
    dosage: '50 mg',
    frequency: 'once_daily',
    timing: ['08:00'],
    prescribedBy: 'Dr. Lara Weber',
    startDate: yyyyMmDd(new Date(now.getTime() - 40 * day)),
    reason: 'Angst & depressive Symptome',
    category: 'antidepressant',
    notes: 'Langsam eindosiert. Beobachtung: Müdigkeit am Anfang.',
    sideEffects: ['Übelkeit', 'Müdigkeit'],
    isActive: true,
  });

  const med2 = await ensureMedication({
    patientId: p1,
    name: 'Melatonin',
    genericName: 'Melatonin',
    dosage: '2 mg',
    frequency: 'as_needed',
    timing: ['22:30'],
    prescribedBy: 'Dr. Lara Weber',
    startDate: yyyyMmDd(new Date(now.getTime() - 20 * day)),
    reason: 'Schlafrhythmus stabilisieren',
    category: 'sedative',
    notes: 'Bei Bedarf, nicht täglich.',
    sideEffects: [],
    isActive: true,
  });

  for (let i = 0; i < 14; i++) {
    const when = new Date(now.getTime() - i * day + 8 * 60 * 60 * 1000);
    await ensureMedicationIntake({
      patientId: p1,
      medicationId: med1.id,
      taken: i % 6 !== 0,
      actualTime: '08:05',
      skippedReason: i % 6 === 0 ? 'Vergessen' : undefined,
      sideEffectsNoted: i % 7 === 0 ? ['Übelkeit'] : [],
      notes: i % 5 === 0 ? 'Heute etwas Unruhe.' : undefined,
      loggedAt: iso(when),
    });

    const melWhen = new Date(now.getTime() - i * day + 22 * 60 * 60 * 1000);
    await ensureMedicationIntake({
      patientId: p1,
      medicationId: med2.id,
      taken: i % 2 === 0,
      actualTime: '22:35',
      skippedReason: i % 2 !== 0 ? 'Nicht benötigt' : undefined,
      sideEffectsNoted: [],
      loggedAt: iso(melWhen),
    });
  }

  // Therapy notes for therapist t1 about patient p1 (requires relationship: booked appointment exists)
  await ensureTherapyNote({
    therapistId: t1,
    patientId: p1,
    sessionDate: yyyyMmDd(new Date(now.getTime() - 8 * day)),
    sessionDuration: 50,
    subjective: 'Patient berichtet über Ein- und Durchschlafstörungen sowie erhöhte innere Anspannung.',
    objective: 'Wirkt müde, aber kooperativ. Konzentration zeitweise eingeschränkt.',
    assessment: 'Stressbedingte Symptomatik, Schlafhygiene als erster Interventionsfokus.',
    plan: 'Schlafprotokoll führen, Stimulus-Kontrolle besprechen, nächste Sitzung in 1 Woche.',
    diagnosis: ['F41.1', 'F32.0'],
    interventions: ['Psychoedukation', 'Achtsamkeitsübungen', 'Aktivitätsaufbau'],
    homework: 'Schlafhygiene-Regeln testen + 10 Minuten Atemübung täglich.',
    riskAssessment: 'low',
    suicidalIdeation: false,
    mentalStatus: { mood: 'angespannt', affect: 'eingeschränkt', cognition: 'leicht beeinträchtigt' },
    progressRating: 3,
    goalsAddressed: ['Schlaf verbessern', 'Stress reduzieren'],
    nextSessionPlanned: yyyyMmDd(new Date(now.getTime() - 1 * day)),
    followUpRequired: true,
  });

  await ensureTherapyNote({
    therapistId: t1,
    patientId: p1,
    sessionDate: yyyyMmDd(new Date(now.getTime() - 1 * day)),
    sessionDuration: 50,
    subjective: 'Patient berichtet: Schlafqualität leicht verbessert, aber Grübeln am Abend bleibt.',
    objective: 'Wirkt etwas erholter. Blickkontakt besser.',
    assessment: 'Positive Tendenz. Kognitive Umstrukturierung zu abendlichem Grübeln sinnvoll.',
    plan: 'Gedankenprotokoll, Grübelzeit-Technik, nächste Sitzung in 1 Woche.',
    diagnosis: ['F41.1'],
    interventions: ['Kognitive Umstrukturierung', 'Entspannungstechniken'],
    homework: 'Gedankenprotokoll 3x/Woche, Grübelzeit täglich 15 Min.',
    riskAssessment: 'none',
    suicidalIdeation: false,
    mentalStatus: { mood: 'leicht angespannt', insight: 'gut' },
    progressRating: 4,
    goalsAddressed: ['Grübeln reduzieren', 'Stress reduzieren'],
    followUpRequired: false,
  });

  // Billing: settings + 2 invoices for therapist t1
  await ensureBillingSettings({
    therapistId: t1,
    practiceName: 'Praxis Dr. Lara Weber',
    addressLine1: 'Musterstraße 12',
    zipCode: '10115',
    city: 'Berlin',
    taxId: 'DE-TEST-123456',
    bankName: 'Demo Bank',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    invoiceFooter: 'Vielen Dank für Ihr Vertrauen. Bitte überweisen Sie innerhalb von 14 Tagen.',
    nextInvoiceNumber: 1002,
  });

  await ensureInvoice({
    therapistId: t1,
    patientId: p1,
    invoiceNumber: '1000',
    date: yyyyMmDd(new Date(now.getTime() - 10 * day)),
    dueDate: yyyyMmDd(new Date(now.getTime() - 10 * day + 14 * day)),
    items: [
      { description: 'Psychotherapeutische Sitzung (50 Min)', code: '870', factor: 2.3, price: 100.55 },
      { description: 'Kurzbericht / Dokumentation', code: '75', factor: 1.0, price: 25.0 },
    ],
    notes: 'Demo-Rechnung für Testzwecke',
    status: 'sent',
  });

  await ensureInvoice({
    therapistId: t1,
    patientId: p2,
    invoiceNumber: '1001',
    date: yyyyMmDd(new Date(now.getTime() - 3 * day)),
    dueDate: yyyyMmDd(new Date(now.getTime() - 3 * day + 14 * day)),
    items: [{ description: 'Psychotherapeutische Sitzung (50 Min)', code: '870', factor: 2.3, price: 120.0 }],
    status: 'draft',
  });

  // Forms: questionnaire demo for t1->p1
  await ensureQuestionnaireDemo({ therapistId: t1, patientId: p1, appointmentId: bookedApt });

  logger.info('✓ Doctor demo seed completed', {
    users: {
      total: createdUsers.length,
      created: createdUsers.filter((u) => u.created).length,
    },
    appointments: {
      total: createdAppointments.length,
      created: createdAppointments.filter((a) => a.created).length,
    },
    payments: {
      created: [pay1, pay2].filter((p) => p.created).length,
    },
    messagesInserted: msgSeed.inserted,
  });

  // Do not log credentials or PII. Provide a safe summary only.
  logger.warn('Demo credentials are not logged. Use DB access in a secure environment if needed.', {
    users: createdUsers.length,
  });
}

main().catch((err) => {
  logger.error('❌ Doctor demo seed failed', err);
  process.exit(1);
});
