/**
 * AES-256 Verschlüsselung für sensible Patientendaten
 * DSGVO Art. 32: "Stand der Technik" - AES-256 gilt als sicher
 * Quelle: BSI TR-02102-1 (2024) - Kryptographische Verfahren
 * ENV: Validiert durch env.ts (Key-Length ≥ 32 garantiert)
 */

import CryptoJS from 'crypto-js';
import { logger } from './logger.js';
import env from '../config/env.js';

// ENCRYPTION_KEY ist durch env.ts garantiert ≥32 Zeichen
const ENCRYPTION_KEY = env.ENCRYPTION_KEY;

/**
 * Verschlüsselt einen String mit AES-256
 * @param plainText Klartext
 * @returns Verschlüsselter Text (Base64)
 * @security Key-Length validated at startup, no runtime checks needed
 */
export function encrypt(plainText: string): string {
  if (!plainText) return '';
  
  try {
    // Type-Safe: ENCRYPTION_KEY ist garantiert non-undefined durch env.ts
    const encrypted = CryptoJS.AES.encrypt(plainText, ENCRYPTION_KEY).toString();
    return encrypted;
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
    // Type-Safe: ENCRYPTION_KEY ist garantiert non-undefined durch env.ts
    const decrypted = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
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
