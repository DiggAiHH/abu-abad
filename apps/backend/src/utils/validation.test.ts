import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema } from './validation.js';

describe('validation (Zod)', () => {
  describe('loginSchema', () => {
    it('rejects invalid email format', () => {
      const result = loginSchema.safeParse({ email: 'not-an-email', password: 'x' });
      expect(result.success).toBe(false);
    });

    it('rejects empty password', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
      expect(result.success).toBe(false);
    });

    it('accepts valid payload', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com', password: 'SomePass123!' });
      expect(result.success).toBe(true);
    });
  });

  describe('registerSchema', () => {
    const base = {
      email: 'user@example.com',
      password: 'Test1234!',
      role: 'patient' as const,
      firstName: 'Test',
      lastName: 'User',
    };

    it('rejects missing DSGVO consent', () => {
      const result = registerSchema.safeParse({ ...base, gdprConsent: false });
      expect(result.success).toBe(false);
    });

    it('rejects weak password (no uppercase)', () => {
      const result = registerSchema.safeParse({ ...base, password: 'test1234!', gdprConsent: true });
      expect(result.success).toBe(false);
    });

    it('rejects weak password (no lowercase)', () => {
      const result = registerSchema.safeParse({ ...base, password: 'TEST1234!', gdprConsent: true });
      expect(result.success).toBe(false);
    });

    it('rejects weak password (no number)', () => {
      const result = registerSchema.safeParse({ ...base, password: 'TestTest!', gdprConsent: true });
      expect(result.success).toBe(false);
    });

    it('accepts valid registration payload', () => {
      const result = registerSchema.safeParse({ ...base, password: 'Test1234!', gdprConsent: true });
      expect(result.success).toBe(true);
    });
  });
});
