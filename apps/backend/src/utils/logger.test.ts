import { describe, it, expect } from 'vitest';
import { redactPII } from './logger.js';

describe('logger redactPII', () => {
  it('redacts common PII/token fields recursively', () => {
    const input = {
      email: 'user@example.com',
      ip: '1.2.3.4',
      ocrText: 'SEHR_SENSIBLER_INHALT',
      nested: {
        password: 'Secret123!',
        refreshToken: 'abcd',
        safe: 'ok',
      },
    };

    const out = redactPII(input) as any;
    expect(out.email).toBe('[redacted]');
    expect(out.ip).toBe('[redacted]');
    expect(out.ocrText).toBe('[redacted]');
    expect(out.nested.password).toBe('[redacted]');
    expect(out.nested.refreshToken).toBe('[redacted]');
    expect(out.nested.safe).toBe('ok');
  });
});
