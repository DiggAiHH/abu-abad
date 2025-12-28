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

// Typen exportieren
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
