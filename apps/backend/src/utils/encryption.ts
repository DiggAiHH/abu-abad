/**
 * Verschlüsselung für sensible Patientendaten
 * - Neu: AES-256-GCM (authentifiziert) mit zufälligem IV, versioniertem Format
 * - Alt: CryptoJS AES(passphrase) wird NUR für Legacy-Decrypt weiter unterstützt
 *
 * DSGVO Art. 32: Stand der Technik
 * BSI TR-02102-1: AEAD (z.B. GCM) bevorzugt; Integrität muss gewährleistet sein.
 */

import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import { logger } from './logger.js';
import env from '../config/env.js';

const FORMAT_PREFIX = 'gcm:v1:';

function getKeyBytes(): Buffer {
  // env.ENCRYPTION_KEY ist mind. 32 Zeichen (env.ts). Wir leiten deterministisch 32 Bytes ab.
  // Empfehlung: In Produktion ENCRYPTION_KEY als 32-Byte random secret (z.B. base64) setzen.
  const key = env.ENCRYPTION_KEY;
  const maybeBase64 = key.length >= 43 && /^[A-Za-z0-9+/=]+$/.test(key);
  if (maybeBase64) {
    try {
      const buf = Buffer.from(key, 'base64');
      if (buf.length === 32) return buf;
    } catch {
      // fall through
    }
  }
  return crypto.createHash('sha256').update(key, 'utf8').digest();
}

const KEY_BYTES = getKeyBytes();

/**
 * Verschlüsselt einen String mit AES-256
 * @param plainText Klartext
 * @returns Verschlüsselter Text (Base64)
 * @security Key-Length validated at startup, no runtime checks needed
 */
export function encrypt(plainText: string): string {
  if (!plainText) return '';
  
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY_BYTES, iv);
    const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${FORMAT_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
  } catch (error) {
    logger.error('Verschlüsselungsfehler:', error);
    throw new Error('Verschlüsselung fehlgeschlagen');
  }
}

/**
 * Entschlüsselt einen verschlüsselten String
 * @param encryptedText Verschlüsselter Text (Base64)
 * @returns Klartext
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  
  try {
    // Neuformat: gcm:v1:<ivB64>:<tagB64>:<cipherB64>
    if (encryptedText.startsWith(FORMAT_PREFIX)) {
      const payload = encryptedText.slice(FORMAT_PREFIX.length);
      const parts = payload.split(':');
      if (parts.length !== 3) throw new Error('Ungültiges Ciphertext-Format');

      const [ivB64, tagB64, cipherB64] = parts;
      const iv = Buffer.from(ivB64, 'base64');
      const tag = Buffer.from(tagB64, 'base64');
      const ciphertext = Buffer.from(cipherB64, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_BYTES, iv);
      decipher.setAuthTag(tag);
      const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
      return plain;
    }

    // Legacy: CryptoJS AES(passphrase)
    const decrypted = CryptoJS.AES.decrypt(encryptedText, env.ENCRYPTION_KEY);
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    logger.error('Entschlüsselungsfehler:', error);
    throw new Error('Entschlüsselung fehlgeschlagen');
  }
}

/**
 * Verschlüsselt ein komplettes Objekt (alle String-Werte)
 */
export function encryptObject<T extends Record<string, any>>(obj: T): T {
  const encrypted: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      encrypted[key] = encrypt(value);
    } else {
      encrypted[key] = value;
    }
  }
  
  return encrypted as T;
}

/**
 * Entschlüsselt ein komplettes Objekt
 */
export function decryptObject<T extends Record<string, any>>(obj: T): T {
  const decrypted: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && key.endsWith('_encrypted')) {
      const originalKey = key.replace('_encrypted', '');
      decrypted[originalKey] = decrypt(value);
    } else {
      decrypted[key] = value;
    }
  }
  
  return decrypted as T;
}
