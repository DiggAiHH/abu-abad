/**
 * Enhanced Encryption Service with KMS Support
 * Production-Ready mit Key Rotation, Audit Logging, GDPR Compliance
 * 
 * DSGVO Art. 32: State-of-the-Art Encryption
 * BSI TR-02102-1: AEAD (GCM) bevorzugt
 * CRA: Keine Hardcoded Keys, externe KMS-Integration
 * 
 * @security Trennung von Data Keys (DEK) und Key Encryption Keys (KEK)
 */

import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { 
  IKeyManagementService, 
  LocalKMS, 
  EncryptionContext 
} from './kms.service.js';
import env from '../config/env.js';

// Format-Prefix für versionierte Verschlüsselung
const FORMAT_PREFIX = 'kms:v2:';

/**
 * Encrypted Data Container
 * Enthält verschlüsselte Daten + verschlüsselten DEK
 */
interface EncryptedData {
  /** Verschlüsselter Ciphertext */
  ciphertext: string;
  /** Verschlüsselter Data Key (via KMS) */
  encryptedKey: string;
  /** Key Version für Rotation Support */
  keyVersion: string;
  /** Initialization Vector (Base64) */
  iv: string;
  /** Authentication Tag (Base64) */
  tag: string;
}

/**
 * Enhanced Encryption Service
 * Verwendet Envelope Encryption Pattern (wie AWS S3, Google Cloud)
 */
export class EnhancedEncryptionService {
  private kms: IKeyManagementService;
  private readonly ALGORITHM = 'aes-256-gcm';

  constructor(kms?: IKeyManagementService) {
    // Default: LocalKMS für Dev/Test
    // Production: Inject AWS KMS oder Vault
    if (!kms) {
      const masterKey = this.getMasterKeyFromEnv();
      this.kms = new LocalKMS(masterKey, env.ENCRYPTION_KEY_VERSION || 'v1');
    } else {
      this.kms = kms;
    }
  }

  /**
   * Verschlüsselt Daten mit Envelope Encryption
   * 1. Generiere DEK via KMS
   * 2. Verschlüssele Daten mit DEK
   * 3. Speichere verschlüsselten DEK alongside data
   * 
   * @param plaintext Klartext
   * @param context Encryption Context für Audit & Access Control
   * @returns Verschlüsselte Daten mit verschlüsseltem Key
   */
  async encrypt(plaintext: string, context: EncryptionContext = {}): Promise<string> {
    if (!plaintext) return '';

    try {
      // 1. Generiere Data Encryption Key via KMS
      const dataKey = await this.kms.generateDataKey(context);

      // 2. Verschlüssele Daten mit DEK (AES-256-GCM)
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(this.ALGORITHM, dataKey.plaintext, iv);
      
      const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      const tag = cipher.getAuthTag();

      // 3. Erstelle strukturiertes Encrypted Data Objekt
      const encrypted: EncryptedData = {
        ciphertext: ciphertext.toString('base64'),
        encryptedKey: dataKey.encrypted,
        keyVersion: dataKey.version,
        iv: iv.toString('base64'),
        tag: tag.toString('base64')
      };

      // 4. Serialisiere als versionierter String
      const payload = JSON.stringify(encrypted);
      return `${FORMAT_PREFIX}${Buffer.from(payload, 'utf8').toString('base64')}`;

    } catch (error) {
      logger.error('Enhanced encryption failed:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Entschlüsselt Daten mit KMS
   * 1. Extrahiere verschlüsselten DEK
   * 2. Entschlüssele DEK via KMS
   * 3. Entschlüssele Daten mit DEK
   */
  async decrypt(encryptedText: string, context: EncryptionContext = {}): Promise<string> {
    if (!encryptedText) return '';

    try {
      // Check Format Version
      if (!encryptedText.startsWith(FORMAT_PREFIX)) {
        // Fallback zu legacy encryption.ts (backward compatibility)
        const legacyEncryption = await import('../utils/encryption.js');
        return legacyEncryption.decrypt(encryptedText);
      }

      // 1. Parse Encrypted Data
      const payload = encryptedText.slice(FORMAT_PREFIX.length);
      const decoded = Buffer.from(payload, 'base64').toString('utf8');
      const data: EncryptedData = JSON.parse(decoded);

      // 2. Entschlüssele DEK via KMS
      const dataKey = await this.kms.decryptDataKey(data.encryptedKey, context);

      // 3. Entschlüssele Daten mit DEK
      const iv = Buffer.from(data.iv, 'base64');
      const tag = Buffer.from(data.tag, 'base64');
      const ciphertext = Buffer.from(data.ciphertext, 'base64');

      const decipher = crypto.createDecipheriv(this.ALGORITHM, dataKey, iv);
      decipher.setAuthTag(tag);

      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]).toString('utf8');

      return plaintext;

    } catch (error) {
      logger.error('Enhanced decryption failed:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Rotate Encryption Keys (re-encrypt mit neuem Master Key)
   * GDPR Best Practice: Regelmäßige Key Rotation (z.B. jährlich)
   */
  async rotateKey(encryptedText: string, context: EncryptionContext = {}): Promise<string> {
    // 1. Decrypt with old key
    const plaintext = await this.decrypt(encryptedText, context);
    
    // 2. Encrypt with new key
    const newContext = { ...context, keyVersion: 'latest' };
    return this.encrypt(plaintext, newContext);
  }

  /**
   * Helper: Master Key aus Environment Variable
   */
  private getMasterKeyFromEnv(): Buffer {
    const key = env.ENCRYPTION_KEY;
    
    // Prefer Base64-encoded 32-byte key
    if (key.length >= 43 && /^[A-Za-z0-9+/=]+$/.test(key)) {
      try {
        const buf = Buffer.from(key, 'base64');
        if (buf.length === 32) return buf;
      } catch {
        // fall through
      }
    }
    
    // Fallback: SHA-256 Hash von String
    return crypto.createHash('sha256').update(key, 'utf8').digest();
  }
}

// Singleton Instance
let encryptionService: EnhancedEncryptionService | null = null;

/**
 * Factory Function für Dependency Injection
 */
export function getEncryptionService(kms?: IKeyManagementService): EnhancedEncryptionService {
  if (!encryptionService) {
    encryptionService = new EnhancedEncryptionService(kms);
  }
  return encryptionService;
}

/**
 * Convenience Wrapper für bestehenden Code (Drop-in Replacement)
 */
export async function encryptWithKMS(plaintext: string, context: EncryptionContext = {}): Promise<string> {
  const service = getEncryptionService();
  return service.encrypt(plaintext, context);
}

export async function decryptWithKMS(encryptedText: string, context: EncryptionContext = {}): Promise<string> {
  const service = getEncryptionService();
  return service.decrypt(encryptedText, context);
}
