/**
 * KMS (Key Management Service) Interface
 * Abstraktion für externe Key Management Services (AWS KMS, HashiCorp Vault, etc.)
 * 
 * DSGVO Art. 32: Verschlüsselung mit professionellem Key Management
 * CRA (Cyber Resilience Act): Secure by Default - keine Hardcoded Keys in Production
 * 
 * @security This interface enables encryption key rotation without code changes
 */

export interface EncryptionContext {
  /** Patient/User ID für Context-gebundene Verschlüsselung */
  userId?: string;
  /** Datentyp (z.B. "medical_notes", "diagnosis") für Audit-Trails */
  dataType?: string;
  /** Verschlüsselungs-Key Version für Rotation Support */
  keyVersion?: string;
}

export interface DataKey {
  /** Plaintext Key (in-memory only, never persisted) */
  plaintext: Buffer;
  /** Encrypted Key (persisted alongside data) */
  encrypted: string;
  /** Key Version für Rotation */
  version: string;
}

/**
 * KMS Interface für Production-Grade Key Management
 * Default Implementation: Local (für Dev/Test)
 * Production: AWS KMS, Azure Key Vault, HashiCorp Vault
 */
export interface IKeyManagementService {
  /**
   * Generiert einen neuen Data Encryption Key (DEK)
   * KEK (Key Encryption Key) bleibt im KMS, DEK wird per-Record verwendet
   */
  generateDataKey(context: EncryptionContext): Promise<DataKey>;

  /**
   * Entschlüsselt einen Data Key via KMS
   */
  decryptDataKey(encryptedKey: string, context: EncryptionContext): Promise<Buffer>;

  /**
   * Rotiert Keys (re-encrypt mit neuem Master Key)
   */
  rotateKey?(oldVersion: string, newVersion: string): Promise<void>;
}

/**
 * Local Development KMS (NOT for production)
 * Simuliert KMS-Verhalten mit lokalem Master Key
 */
export class LocalKMS implements IKeyManagementService {
  private masterKey: Buffer;
  private version: string;

  constructor(masterKey: Buffer, version: string = 'v1') {
    if (masterKey.length !== 32) {
      throw new Error('Master Key must be 32 bytes for AES-256');
    }
    this.masterKey = masterKey;
    this.version = version;
  }

  async generateDataKey(context: EncryptionContext): Promise<DataKey> {
    // Generiere zufälligen 32-Byte DEK
    const crypto = await import('crypto');
    const plaintext = crypto.randomBytes(32);
    
    // Verschlüssele DEK mit Master Key (simuliert KMS encrypt)
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    
    // Optional: Add context as AAD (Additional Authenticated Data)
    if (context.userId || context.dataType) {
      const aad = JSON.stringify({ userId: context.userId, dataType: context.dataType });
      cipher.setAAD(Buffer.from(aad, 'utf8'));
    }
    
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    // Format: version:iv:tag:ciphertext (alle Base64)
    const encrypted = `${this.version}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
    
    return {
      plaintext,
      encrypted,
      version: context.keyVersion || this.version
    };
  }

  async decryptDataKey(encryptedKey: string, context: EncryptionContext): Promise<Buffer> {
    const crypto = await import('crypto');
    const parts = encryptedKey.split(':');
    
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted key format');
    }
    
    const [version, ivB64, tagB64, cipherB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(cipherB64, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(tag);
    
    // Wenn AAD verwendet wurde, muss es identisch sein
    if (context.userId || context.dataType) {
      const aad = JSON.stringify({ userId: context.userId, dataType: context.dataType });
      decipher.setAAD(Buffer.from(aad, 'utf8'));
    }
    
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}

/**
 * AWS KMS Implementation (Skeleton für Production)
 * Requires: AWS SDK v3 (@aws-sdk/client-kms)
 */
export class AWSKMS implements IKeyManagementService {
  // private kmsClient: KMSClient;
  // private keyId: string;

  constructor(keyId: string, region: string = 'eu-central-1') {
    // this.kmsClient = new KMSClient({ region });
    // this.keyId = keyId;
    throw new Error('AWS KMS not implemented - install @aws-sdk/client-kms first');
  }

  async generateDataKey(context: EncryptionContext): Promise<DataKey> {
    // Implementation with AWS SDK
    // const command = new GenerateDataKeyCommand({
    //   KeyId: this.keyId,
    //   KeySpec: 'AES_256',
    //   EncryptionContext: { userId: context.userId || '', dataType: context.dataType || '' }
    // });
    // const response = await this.kmsClient.send(command);
    throw new Error('Not implemented');
  }

  async decryptDataKey(encryptedKey: string, context: EncryptionContext): Promise<Buffer> {
    throw new Error('Not implemented');
  }
}
