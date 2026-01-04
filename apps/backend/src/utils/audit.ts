/**
 * Audit Logging (DB)
 *
 * Ziel:
 * - Nachvollziehbarkeit sicherheitsrelevanter Aktionen (ISO 27001 / OWASP ASVS)
 * - DSGVO-konform: keine unnötigen Daten; Metadata wird PII-redacted
 *
 * Hinweis: Audit-Logs sind keine Console-Logs. Sie liegen geschützt in der DB.
 */

import type { Request } from 'express';
import { query } from '../database/init.js';
import { redactPII } from './logger.js';

type AuditAction =
  | 'auth.register'
  | 'auth.login.success'
  | 'auth.login.failed'
  | 'auth.logout'
  | 'message.send'
  | 'user.profile.update'
  | 'user.account.delete.request'
  | 'user.data.export'
  | 'patient_material.download'
  | 'patient_material.share'
  | 'patient_material.delete'
  | 'system.retention.user_purged';

function truncate(value: string | undefined | null, max: number): string | null {
  if (!value) return null;
  if (value.length <= max) return value;
  return value.slice(0, max);
}

function minimizeIp(ip: string | undefined): string | null {
  if (!ip) return null;

  // Express kann IPv4 als ::ffff:1.2.3.4 liefern
  const normalized = ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;

  // IPv4: /24
  if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) {
    const [a, b, c] = normalized.split('.');
    return `${a}.${b}.${c}.0`;
  }

  // IPv6: grob /64 (erste 4 Hextets)
  if (normalized.includes(':')) {
    const parts = normalized.split(':').filter(Boolean);
    return parts.slice(0, 4).join(':') + '::';
  }

  return null;
}

export async function writeAuditLog(params: {
  userId: string | null;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  req?: Request;
  metadata?: unknown;
}): Promise<void> {
  const ip = params.req ? minimizeIp(params.req.ip) : null;
  const userAgent = params.req ? truncate(params.req.get('user-agent') || undefined, 200) : null;
  const metadata = params.metadata ? (redactPII(params.metadata) as any) : null;

  await query(
    `INSERT INTO audit_logs (
      user_id, action, resource_type, resource_id, ip_address, user_agent, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      params.userId,
      params.action,
      params.resourceType ?? null,
      params.resourceId ?? null,
      ip,
      userAgent,
      metadata,
    ]
  );
}
