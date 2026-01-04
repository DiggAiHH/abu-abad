/**
 * Abu-Abbad Auth SDK
 * 
 * Standalone Authentication Package für:
 * - React Web Apps (Vite/CRA)
 * - React Native (iOS/Android)
 * - Capacitor (Hybrid Apps)
 * - Electron (Desktop)
 * 
 * @packageDocumentation
 */

// Components
export { default as LoginPage } from './Login';
export { default as RegisterPage } from './Register';

// Store & Hooks
export { useAuthStore } from './authStore';

// API Client (Export as 'apiClient' for consistency)
export { api as apiClient } from './apiClient';

// Helper to set auth token
export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

// Types
export * from './types';

// Utils
export { validateEmail, validatePassword } from './utils';
