/**
 * JWT-basierte Authentifizierung
 * Sicherheit: Access Token (kurz) + Refresh Token (lang)
 * ENV: Validiert durch env.ts (kein Fallback auf unsichere Defaults)
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/init.js';
import { logger } from './logger.js';
import env from '../config/env.js';

// ENV-Variablen sind durch env.ts garantiert vorhanden und sicher
const JWT_SECRET = env.JWT_SECRET;
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;

// Für zukünftige Refresh-Token Features (vorbereitet)
// const REFRESH_TOKEN_SECRET = env.REFRESH_TOKEN_SECRET;
// const REFRESH_TOKEN_EXPIRES_IN = env.REFRESH_TOKEN_EXPIRES_IN;

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'therapist' | 'patient';
}

/**
 * Erstellt ein Access Token (JWT)
 * @security JWT mit issuer/audience Validation (RFC 7519)
 */
export function generateAccessToken(payload: JWTPayload): string {
  // Workaround für @types/jsonwebtoken overload resolution
  // JWT library accepts string for expiresIn ("15m", "1h", "7d")
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'therapist-platform',
    audience: 'therapist-platform-users'
  } as jwt.SignOptions);
}

/**
 * Erstellt ein Refresh Token und speichert es in DB
 */
export async function generateRefreshToken(userId: string): Promise<string> {
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 Tage

  await query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );

  return token;
}

/**
 * Verifiziert ein Access Token
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'therapist-platform',
      audience: 'therapist-platform-users'
    }) as JWTPayload;
    
    return decoded;
  } catch (error) {
    logger.warn('Token-Verifikation fehlgeschlagen:', error);
    throw new Error('Ungültiges Token');
  }
}

/**
 * Verifiziert ein Refresh Token
 */
export async function verifyRefreshToken(token: string): Promise<string | null> {
  const result = await query<{ user_id: string; expires_at: Date; revoked_at: Date | null }>(
    `SELECT user_id, expires_at, revoked_at 
     FROM refresh_tokens 
     WHERE token = $1`,
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const { user_id, expires_at, revoked_at } = result.rows[0];

  if (revoked_at || new Date() > new Date(expires_at)) {
    return null;
  }

  return user_id;
}

/**
 * Widerruft ein Refresh Token
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  await query(
    'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token = $1',
    [token]
  );
}

/**
 * Löscht abgelaufene Refresh Tokens (Cleanup-Funktion)
 */
export async function cleanupExpiredTokens(): Promise<void> {
  await query(
    'DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP OR revoked_at IS NOT NULL'
  );
  logger.info('Abgelaufene Tokens gelöscht');
}
