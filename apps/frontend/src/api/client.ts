import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// SECURITY: Timeout verhindert Hanging Requests (DoS-Prävention)
// GDPR-COMPLIANCE: Keine Third-Party Analytics oder Tracking
export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 10000, // SECURITY: 10s Timeout für alle Requests
});

// Request Interceptor: Add JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Errors
let isRedirecting = false;

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error: string }>) => {
    const message = error.response?.data?.error || 'Ein Fehler ist aufgetreten';
    
    if (error.response?.status === 401) {
      if (!isRedirecting) {
        isRedirecting = true;
        localStorage.removeItem('token');
        toast.error('Sitzung abgelaufen. Bitte neu anmelden.');
        setTimeout(() => {
          if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
            window.location.href = '/login';
          }
          isRedirecting = false;
        }, 100);
      }
    } else if (error.response?.status === 403) {
      toast.error('Zugriff verweigert.');
    } else if (!error.response) {
      toast.error('Server nicht erreichbar.');
    } else {
      toast.error(message);
    }
    
    // Logging
    if (window && (window as any).logError) {
      (window as any).logError(error, 'axios.response');
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'therapist' | 'patient';
    phone?: string;
    gdprConsent: boolean;
  }) => api.post('/auth/register', data),
  
  getMe: () => api.get('/auth/me'),
  
  logout: () => api.post('/auth/logout'),
};

// Appointment API
export const appointmentAPI = {
  getAll: (params?: { status?: string; date?: string }) =>
    api.get('/appointments', { params }),
  
  getById: (id: string) => api.get(`/appointments/${id}`),
  
  create: (data: {
    startTime: string;
    endTime: string;
    appointmentType: 'video' | 'audio' | 'in-person';
    price?: number;
  }) => api.post('/appointments', data),
  
  book: (id: string, patientNotes?: string) =>
    api.post(`/appointments/${id}/book`, { patientNotes }),
  
  cancel: (id: string, reason?: string) =>
    api.post(`/appointments/${id}/cancel`, { reason }),
  
  complete: (id: string, therapistNotes?: string) =>
    api.post(`/appointments/${id}/complete`, { therapistNotes }),
};

// Message API
export const messageAPI = {
  getAll: () => api.get('/messages'),
  
  getConversation: (userId: string) => api.get(`/messages/conversation/${userId}`),
  
  send: (receiverId: string, content: string) =>
    api.post('/messages', { receiverId, content }),
  
  markAsRead: (messageId: string) => api.put(`/messages/${messageId}/read`),
};

// Payment API
export const paymentAPI = {
  createCheckout: (appointmentId: string) =>
    api.post('/payments/create-checkout', { appointmentId }),
  
  getByAppointment: (appointmentId: string) =>
    api.get(`/payments/appointment/${appointmentId}`),
};

// User API
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  
  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) => api.put('/users/profile', data),
  
  getTherapists: () => api.get('/users/therapists'),
};
