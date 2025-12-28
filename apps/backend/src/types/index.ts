// User Types
export enum UserRole {
  THERAPIST = 'therapist',
  PATIENT = 'patient',
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * @deprecated Use Express.Request directly - custom properties added via express.d.ts
 * This export remains for backward compatibility but will be removed in v2.0
 */
export type AuthRequest = import('express').Request;

// Appointment Types
export enum AppointmentStatus {
  AVAILABLE = 'available',
  BOOKED = 'booked',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface Appointment {
  id: string;
  therapist_id: string;
  patient_id?: string;
  start_time: Date;
  end_time: Date;
  status: AppointmentStatus;
  notes?: string;
  price: number;
  payment_status: 'pending' | 'completed' | 'refunded';
  meeting_room_id?: string;
  created_at: Date;
  updated_at: Date;
}

// Message Types
export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string; // verschlüsselt
  read: boolean;
  created_at: Date;
}

// Payment Types
export interface Payment {
  id: string;
  appointment_id: string;
  stripe_payment_intent_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: Date;
}

// WebRTC Types
export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join-room' | 'leave-room';
  room: string;
  from: string;
  to?: string;
  data?: any;
}
