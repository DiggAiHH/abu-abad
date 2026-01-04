import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import { authAPI, setLogoutInProgress } from '../api/client';
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '../auth/token';

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
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: getAccessToken(),
      loading: false,
      error: null,

      checkAuth: async () => {
        set({ loading: true, error: null });
        try {
          const response = await authAPI.getMe();
          const user = (response as any)?.data?.user ?? (response as any)?.data;
          const token = getAccessToken();

          if (!user) {
            throw new Error('Keine Benutzerdaten erhalten');
          }

          set({ user, token, loading: false, error: null });
        } catch {
          clearAccessToken();
          set({ user: null, token: null, loading: false, error: null });
        }
      },

      login: async (email, password) => {
        set({ loading: true, error: null });
        try {
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            set({ error: 'Ungültige E-Mail-Adresse', loading: false });
            throw new Error('Ungültige E-Mail-Adresse');
          }
          if (!password || password.length < 8) {
            set({ error: 'Passwort zu kurz', loading: false });
            throw new Error('Passwort zu kurz');
          }

          const response = await authAPI.login(email, password);
          const token =
            (response as any)?.data?.accessToken || (response as any)?.data?.token;
          const user = (response as any)?.data?.user;

          if (!token || !user) {
            set({ error: 'Ungültige Server-Antwort', loading: false });
            throw new Error('Ungültige Server-Antwort');
          }

          setAccessToken(token);
          set({ user, token, error: null, loading: false });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Login fehlgeschlagen';
          set({ error: errorMessage, loading: false });
          if (window && (window as any).logError) {
            (window as any).logError(error, 'authStore.login');
          }
          throw error;
        }
      },

      register: async (data) => {
        set({ loading: true, error: null });

        if (!data.email || !data.password || !data.firstName || !data.lastName) {
          set({ loading: false });
          throw new Error('Alle Pflichtfelder müssen ausgefüllt sein');
        }

        if (!data.gdprConsent) {
          set({ loading: false });
          throw new Error('DSGVO-Einwilligung erforderlich');
        }

        const response = await authAPI.register(data);
        const token =
          (response as any)?.data?.accessToken || (response as any)?.data?.token;
        const user = (response as any)?.data?.user;

        if (!token || !user) {
          throw new Error('Ungültige Server-Antwort');
        }

        setAccessToken(token);
        set({ user, token, error: null, loading: false });
      },

      logout: async () => {
        setLogoutInProgress(true);
        try {
          // WICHTIG: Backend muss das Refresh-Cookie immer löschen können.
          await authAPI.logout();
        } catch {
          // ignore (lokaler State wird trotzdem gelöscht)
        } finally {
          clearAccessToken();
          set({ user: null, token: null, error: null, loading: false });
          setLogoutInProgress(false);
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: () => ({}),
    }
  )
);
