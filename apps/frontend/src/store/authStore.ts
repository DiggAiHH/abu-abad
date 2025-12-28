import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import { authAPI } from '../api/client';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'therapist' | 'patient';
    phone?: string;
    gdprConsent: boolean;
  }) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      loading: true,
      error: null,

      checkAuth: async () => {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 1000;
        
        let attempt = 0;
        
        while (attempt < MAX_RETRIES) {
          try {
            set({ loading: true, error: null });
            
            const token = localStorage.getItem('token');
            
            if (!token) {
              set({ user: null, token: null, loading: false, error: null });
              return;
            }
            
            const response = await authAPI.getMe();
            
            if (!response?.data) {
              throw new Error('Keine Benutzerdaten erhalten');
            }
            
            set({ user: response.data, token, loading: false, error: null });
            console.log('✅ Auth check successful');
            return; // Erfolg, beende Loop
            
          } catch (error: any) {
            attempt++;
            console.error(`Auth-Check Versuch ${attempt}/${MAX_RETRIES} fehlgeschlagen:`, error);
            
            if (attempt >= MAX_RETRIES) {
              // Nach allen Versuchen: Token entfernen
              console.warn('❌ Auth check failed after max retries, clearing token');
              localStorage.removeItem('token');
              set({ 
                user: null, 
                token: null, 
                loading: false, 
                error: 'Authentifizierung fehlgeschlagen' 
              });
              return;
            }
            
            // Warte vor erneutem Versuch
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
          }
        }
      },

      login: async (email, password) => {
        set({ loading: true, error: null });
        try {
          // Input-Validierung
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            set({ error: 'Ungültige E-Mail-Adresse', loading: false });
            throw new Error('Ungültige E-Mail-Adresse');
          }
          if (!password || password.length < 8) {
            set({ error: 'Passwort zu kurz', loading: false });
            throw new Error('Passwort zu kurz');
          }
          const response = await authAPI.login(email, password);
          if (!response?.data?.token || !response?.data?.user) {
            set({ error: 'Ungültige Server-Antwort', loading: false });
            throw new Error('Ungültige Server-Antwort');
          }
          const { user, token } = response.data;
          localStorage.setItem('token', token);
          set({ user, token, error: null, loading: false });
          console.log('✅ Login successful');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Login fehlgeschlagen';
          set({ error: errorMessage, loading: false });
          if (window && (window as any).logError) {
            (window as any).logError(error, 'authStore.login');
          }
          throw error;
        }
      },

      register: async (data) => {
        // Validation
        if (!data.email || !data.password || !data.firstName || !data.lastName) {
          throw new Error('Alle Pflichtfelder müssen ausgefüllt sein');
        }
        
        if (!data.gdprConsent) {
          throw new Error('DSGVO-Einwilligung erforderlich');
        }
        
        const response = await authAPI.register(data);
        
        if (!response?.data?.token || !response?.data?.user) {
          throw new Error('Ungültige Server-Antwort');
        }
        
        const { user, token } = response.data;
        localStorage.setItem('token', token);
        set({ user, token, error: null, loading: false });
        console.log('✅ Registration successful');
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, error: null, loading: false });
        console.log('✅ Logout successful');
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);

// Initialisierung mit Verzögerung um Race Conditions zu vermeiden
if (typeof window !== 'undefined') {
  // Warte bis DOM ready ist
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        console.log('🔄 Starting auth check...');
        useAuthStore.getState().checkAuth();
      }, 100);
    });
  } else {
    setTimeout(() => {
      console.log('🔄 Starting auth check...');
      useAuthStore.getState().checkAuth();
    }, 100);
  }
}
