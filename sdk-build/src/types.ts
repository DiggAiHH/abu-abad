export interface User {
  id: string;
  email: string;
  role: 'therapist' | 'patient';
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface Appointment {
  id: string;
  therapistId: string;
  patientId?: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked' | 'completed' | 'cancelled';
  price: number;
  paymentStatus: 'pending' | 'completed' | 'refunded';
  meetingRoomId?: string;
  therapistNotes?: string;
  patientNotes?: string;
  therapist?: {
    firstName: string;
    lastName: string;
  };
  patient?: {
    firstName: string;
    lastName: string;
  };
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: string;
  sender?: {
    firstName: string;
    lastName: string;
  };
}

export interface Payment {
  id: string;
  appointmentId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}
