import { describe, it, expect, vi } from 'vitest';
import { redactPII, logger } from './logger.js';

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

  it('redacts PII in info logs', () => {
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    logger.info('demo log', { email: 'user@example.com' });

    expect(writeSpy).toHaveBeenCalled();
    const output = String(writeSpy.mock.calls[0][0]);
    expect(output).toContain('demo log');
    expect(output).toContain('[redacted]');
    expect(output).not.toContain('user@example.com');

    writeSpy.mockRestore();
  });
});
