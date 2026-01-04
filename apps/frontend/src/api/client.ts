import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';
import { clearAccessToken, getAccessToken, setAccessToken } from '../auth/token';

function coerceErrorMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return 'Ein Fehler ist aufgetreten';

  const obj = value as any;
  // Häufige Backend-Formate: { error: string } oder { error: { message: string } }
  if (typeof obj.error === 'string') return obj.error;
  if (obj.error) return coerceErrorMessage(obj.error);
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.detail === 'string') return obj.detail;
  if (typeof obj.title === 'string') return obj.title;

  return 'Ein Fehler ist aufgetreten';
}

const RAW_API_URL = import.meta.env.VITE_API_URL || '';
// VITE_API_URL soll auf die Backend-Origin zeigen (z.B. http://localhost:4000)
// Robustheit: falls /api im Wert steckt, entfernen und sauber wieder anhängen.
const API_ORIGIN = RAW_API_URL.replace(/\/$/, '').replace(/\/api$/, '');
const BASE_URL = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';

// SECURITY: Timeout verhindert Hanging Requests (DoS-Prävention)
// GDPR-COMPLIANCE: Keine Third-Party Analytics oder Tracking
export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 10000, // SECURITY: 10s Timeout für alle Requests
});

// Request Interceptor: Add JWT Token
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Errors
let isRedirecting = false;
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
let logoutInProgress = false;

export function setLogoutInProgress(value: boolean): void {
  logoutInProgress = value;
}

export function isLogoutInProgress(): boolean {
  return logoutInProgress;
}

async function refreshAccessToken(): Promise<string | null> {
  if (logoutInProgress) return null;
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await api.post('/auth/refresh', {});
      const token = (res.data?.accessToken || res.data?.token) as string | undefined;
      if (!token) return null;
      setAccessToken(token);
      return token;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error: string }>) => {
    const message = coerceErrorMessage(error.response?.data);
    const originalRequest: any = error.config;
    
    if (error.response?.status === 401) {
      if (logoutInProgress) {
        return Promise.reject(error);
      }
      // Einmalig versuchen: Refresh via HttpOnly Cookie, dann Request erneut
      if (originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api.request(originalRequest);
        }
      }

      // Refresh fehlgeschlagen: Logout/Redirect
      if (!isRedirecting) {
        isRedirecting = true;
        clearAccessToken();
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

  refresh: () => api.post('/auth/refresh', {}),
  
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

// Alias für Komponenten-Kompatibilität
export const apiClient = api;
