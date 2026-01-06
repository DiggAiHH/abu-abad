/**
 * Validierungsschemas mit Zod
 * Verhindert SQL-Injection und falsche Datentypen
 */

import { z } from 'zod';

// User Schemas
export const registerSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string()
    .min(8, 'Passwort muss mindestens 8 Zeichen haben')
    .regex(/[A-Z]/, 'Passwort muss mindestens einen Großbuchstaben enthalten')
    .regex(/[a-z]/, 'Passwort muss mindestens einen Kleinbuchstaben enthalten')
    .regex(/[0-9]/, 'Passwort muss mindestens eine Zahl enthalten'),
  role: z.enum(['therapist', 'patient']),
  firstName: z.string().min(1, 'Vorname erforderlich'),
  lastName: z.string().min(1, 'Nachname erforderlich'),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gdprConsent: z.boolean().refine((val: boolean) => val === true, {
    message: 'DSGVO-Einwilligung erforderlich'
  })
});

export const loginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort erforderlich')
});

// Appointment Schemas
export const createAppointmentSchema = z.object({
  startTime: z.string().datetime('Ungültiges Startzeit-Format'),
  endTime: z.string().datetime('Ungültiges Endzeit-Format'),
  appointmentType: z.enum(['video', 'audio', 'in-person']).default('video'),
  price: z.number().positive().optional()
}).refine((data: { startTime: string; endTime: string }) => new Date(data.endTime) > new Date(data.startTime), {
  message: 'Endzeit muss nach Startzeit liegen'
});

export const bookAppointmentSchema = z.object({
  appointmentId: z.string().uuid('Ungültige Termin-ID'),
  patientNotes: z.string().max(1000).optional()
});

export const updateAppointmentSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  status: z.enum(['available', 'booked', 'completed', 'cancelled']).optional(),
  therapistNotes: z.string().max(2000).optional()
});

// Message Schema
export const sendMessageSchema = z.object({
  receiverId: z.string().uuid('Ungültige Empfänger-ID'),
  content: z.string().min(1, 'Nachricht darf nicht leer sein').max(5000, 'Nachricht zu lang'),
  appointmentId: z.string().uuid().optional()
});

// Payment Schema
export const createPaymentIntentSchema = z.object({
  appointmentId: z.string().uuid('Ungültige Termin-ID'),
  amount: z.number().positive('Betrag muss positiv sein')
});

// User Update Schema
export const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  bio: z.string().max(1000).optional(),
  specialization: z.string().max(200).optional(),
  hourlyRate: z.number().positive().optional()
});

// Symptom Diary
const symptomDiaryMedicationSchema = z.object({
  name: z.string().min(1).max(200),
  dosage: z.string().max(100).optional(),
  taken: z.boolean(),
});

export const symptomDiaryCreateSchema = z.object({
  date: z.string().min(8),
  moodScore: z.number().min(0).max(10),
  anxietyLevel: z.number().min(0).max(10).optional(),
  sleepQuality: z.number().min(0).max(5).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  energyLevel: z.number().min(0).max(10).optional(),
  stressLevel: z.number().min(0).max(10).optional(),
  symptoms: z.array(z.string().max(200)).optional(),
  triggers: z.array(z.string().max(200)).optional(),
  activities: z.array(z.string().max(200)).optional(),
  medications: z.array(symptomDiaryMedicationSchema).optional(),
  notes: z.string().max(5000).optional(),
});

export const symptomDiaryUpdateSchema = symptomDiaryCreateSchema;

// Medications
export const medicationCreateSchema = z.object({
  name: z.string().min(1).max(200),
  genericName: z.string().max(200).optional(),
  dosage: z.string().min(1).max(100),
  frequency: z.string().min(1).max(50),
  frequencyDetails: z.string().max(200).optional(),
  timing: z.array(z.string().max(20)).optional(),
  prescribedBy: z.string().max(200).optional(),
  startDate: z.string().max(20).optional(),
  reason: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  sideEffects: z.array(z.string().max(100)).optional(),
});

export const medicationUpdateSchema = medicationCreateSchema;

export const medicationDeactivateSchema = z.object({
  endDate: z.string().max(20).optional(),
});

export const medicationIntakeSchema = z.object({
  medicationId: z.number().int().positive(),
  taken: z.boolean(),
  actualTime: z.string().max(10).optional(),
  skippedReason: z.string().max(500).optional(),
  sideEffectsNoted: z.array(z.string().max(100)).optional(),
  notes: z.string().max(2000).optional(),
});

// Therapy Notes
export const therapyNoteCreateSchema = z.object({
  patientId: z.string().uuid(),
  sessionDate: z.string().min(8),
  sessionDuration: z.number().int().min(1).max(300).optional(),
  subjective: z.string().max(10000).optional(),
  objective: z.string().max(10000).optional(),
  assessment: z.string().max(10000).optional(),
  plan: z.string().max(10000).optional(),
  diagnosis: z.array(z.string().max(200)).optional(),
  interventions: z.array(z.string().max(200)).optional(),
  homework: z.string().max(5000).optional(),
  riskAssessment: z.enum(['none', 'low', 'moderate', 'high', 'acute']).default('none'),
  suicidalIdeation: z.boolean().default(false),
  mentalStatus: z.record(z.string(), z.any()).optional(),
  progressRating: z.number().int().min(1).max(5).optional(),
  goalsAddressed: z.array(z.string().max(200)).optional(),
  nextSessionPlanned: z.string().max(20).optional(),
  followUpRequired: z.boolean().default(false),
});

export const therapyNoteUpdateSchema = therapyNoteCreateSchema.omit({ patientId: true });

// Billing
export const billingSettingsSchema = z.object({
  practiceName: z.string().max(200).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  zipCode: z.string().max(30).optional(),
  city: z.string().max(100).optional(),
  taxId: z.string().max(100).optional(),
  bankName: z.string().max(200).optional(),
  iban: z.string().max(80).optional(),
  bic: z.string().max(80).optional(),
  invoiceFooter: z.string().max(2000).optional(),
  nextInvoiceNumber: z.number().int().min(1).max(1_000_000).optional(),
});

const invoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  code: z.string().max(50).optional(),
  factor: z.number().min(0).max(100).optional(),
  price: z.number(),
});

export const invoiceCreateSchema = z.object({
  patientId: z.string().uuid(),
  date: z.string().min(8),
  dueDate: z.string().min(8),
  items: z.array(invoiceItemSchema).min(1),
  taxRate: z.number().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),
});

// Typen exportieren
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export type SymptomDiaryCreateInput = z.infer<typeof symptomDiaryCreateSchema>;
export type MedicationCreateInput = z.infer<typeof medicationCreateSchema>;
export type TherapyNoteCreateInput = z.infer<typeof therapyNoteCreateSchema>;
export type BillingSettingsInput = z.infer<typeof billingSettingsSchema>;
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
