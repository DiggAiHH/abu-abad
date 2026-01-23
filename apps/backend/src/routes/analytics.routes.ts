import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

const router = Router();

function sanitizeProps(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const obj = input as Record<string, unknown>;

  // Privacy-by-default: never accept obvious PII/secrets keys.
  const blockedKeys = new Set(['email', 'password', 'token', 'accessToken', 'refreshToken']);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!blockedKeys.has(k)) out[k] = v;
  }
  return out;
}

router.post('/events', (req: Request, res: Response) => {
  const event = typeof req.body?.event === 'string' ? req.body.event.trim() : '';
  const ts = typeof req.body?.ts === 'string' ? req.body.ts : new Date().toISOString();
  const props = sanitizeProps(req.body?.props);

  if (!event || event.length > 80) {
    return res.status(400).json({ error: 'Invalid event' });
  }

  // Self-hosted analytics: log-only for now (testing). No DB write.
  logger.info('analytics_event', {
    event,
    ts,
    props,
    // No PII in logs (GDPR Art. 9)
  });

  return res.status(204).send();
});

export default router;
