import { describe, it, expect, vi } from 'vitest';

// Wichtig: env.ts wird beim Import von encryption.js geladen.
// Tests setzen daher ENV vor dynamischem Import.

describe('encryption (AES-256-GCM, versioned)', () => {
  it('encrypts + decrypts roundtrip (gcm:v1)', async () => {
    process.env.ENCRYPTION_KEY = 'x'.repeat(64);
    process.env.JWT_SECRET = 'y'.repeat(64);
    process.env.REFRESH_TOKEN_SECRET = 'z'.repeat(64);
    process.env.DATABASE_URL = 'https://example.com/db';
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

    const mod = await import('./encryption.js');
    const plain = 'Hallo Welt – 1234';

    const encrypted = mod.encrypt(plain);
    expect(encrypted.startsWith('gcm:v1:')).toBe(true);

    const decrypted = mod.decrypt(encrypted);
    expect(decrypted).toBe(plain);
  });

  it('supports legacy decrypt (CryptoJS passphrase format)', async () => {
    process.env.ENCRYPTION_KEY = 'legacy_key_'.padEnd(32, '_');
    process.env.JWT_SECRET = 'y'.repeat(64);
    process.env.REFRESH_TOKEN_SECRET = 'z'.repeat(64);
    process.env.DATABASE_URL = 'https://example.com/db';
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

    vi.resetModules();
    const CryptoJS = await import('crypto-js');
    const legacyCipher = CryptoJS.default.AES.encrypt('legacy', process.env.ENCRYPTION_KEY!).toString();

    const mod = await import('./encryption.js');
    expect(mod.decrypt(legacyCipher)).toBe('legacy');
  });
});
