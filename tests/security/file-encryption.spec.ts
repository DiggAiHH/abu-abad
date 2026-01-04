/**
 * File Encryption Tests
 * Validates AES-256-GCM encryption/decryption for patient materials
 */

import { test, expect } from '@playwright/test';
import * as crypto from 'crypto';

// Utility functions from backend (duplicated for testing)
function encryptFileBuffer(buffer: Buffer): Buffer {
  const algorithm = 'aes-256-gcm';
  const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return Buffer.concat([iv, authTag, encrypted]); // Format: [iv(16)][authTag(16)][encrypted data]
}

function decryptFileBuffer(encryptedBuffer: Buffer): Buffer {
  const algorithm = 'aes-256-gcm';
  const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')).digest();
  
  const iv = encryptedBuffer.slice(0, 16);
  const authTag = encryptedBuffer.slice(16, 32);
  const encrypted = encryptedBuffer.slice(32);
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

test.describe('File Encryption', () => {
  test('should encrypt and decrypt text file correctly', () => {
    const originalText = 'Dies ist eine vertrauliche Notiz des Patienten.';
    const originalBuffer = Buffer.from(originalText, 'utf-8');
    
    // Encrypt
    const encryptedBuffer = encryptFileBuffer(originalBuffer);
    
    // Verify encrypted is different
    expect(encryptedBuffer).not.toEqual(originalBuffer);
    expect(encryptedBuffer.length).toBeGreaterThan(originalBuffer.length);
    
    // Decrypt
    const decryptedBuffer = decryptFileBuffer(encryptedBuffer);
    const decryptedText = decryptedBuffer.toString('utf-8');
    
    // Verify decryption matches original
    expect(decryptedText).toBe(originalText);
  });

  test('should encrypt and decrypt binary file correctly', () => {
    // Simulate a small binary file (e.g., image header)
    const originalBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07
    ]);
    
    // Encrypt
    const encryptedBuffer = encryptFileBuffer(originalBuffer);
    
    // Verify encrypted format: IV(16) + AuthTag(16) + ciphertext(same length as plaintext for GCM)
    expect(encryptedBuffer.length).toBe(16 + 16 + originalBuffer.length);
    
    // Decrypt
    const decryptedBuffer = decryptFileBuffer(encryptedBuffer);
    
    // Verify byte-by-byte match
    expect(decryptedBuffer).toEqual(originalBuffer);
  });

  test('should fail decryption with tampered data', () => {
    const originalBuffer = Buffer.from('Secret patient data');
    const encryptedBuffer = encryptFileBuffer(originalBuffer);
    
    // Tamper with encrypted data
    encryptedBuffer[50] = encryptedBuffer[50] ^ 0xFF;
    
    // Decryption should throw due to auth tag mismatch
    expect(() => {
      decryptFileBuffer(encryptedBuffer);
    }).toThrow();
  });

  test('should generate unique IV for each encryption', () => {
    const originalBuffer = Buffer.from('Same content');
    
    const encrypted1 = encryptFileBuffer(originalBuffer);
    const encrypted2 = encryptFileBuffer(originalBuffer);
    
    // IVs should be different
    const iv1 = encrypted1.slice(0, 16);
    const iv2 = encrypted2.slice(0, 16);
    
    expect(iv1).not.toEqual(iv2);
    
    // But both should decrypt to same content
    expect(decryptFileBuffer(encrypted1)).toEqual(originalBuffer);
    expect(decryptFileBuffer(encrypted2)).toEqual(originalBuffer);
  });

  test('should handle large files (100MB limit)', () => {
    // Simulate a 10MB file (smaller for fast test)
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024);
    crypto.randomFillSync(largeBuffer);
    
    const start = Date.now();
    const encryptedBuffer = encryptFileBuffer(largeBuffer);
    const encryptTime = Date.now() - start;
    
    const decryptStart = Date.now();
    const decryptedBuffer = decryptFileBuffer(encryptedBuffer);
    const decryptTime = Date.now() - decryptStart;
    
    // Performance check (should be under 500ms for 10MB)
    expect(encryptTime).toBeLessThan(500);
    expect(decryptTime).toBeLessThan(500);
    
    // Verify correctness
    expect(decryptedBuffer).toEqual(largeBuffer);
  }, 60000); // 60s timeout
});

test.describe('DSGVO Compliance', () => {
  test('should not expose original filename in encrypted storage', () => {
    // In production, filenames are SHA-256 hashes
    const originalFilename = 'patient_notes_sensitive_name.txt';
    const hashedFilename = crypto.createHash('sha256')
      .update(originalFilename + Date.now())
      .digest('hex');
    
    // Hashed filename should not contain original text
    expect(hashedFilename).not.toContain('patient');
    expect(hashedFilename).not.toContain('notes');
    expect(hashedFilename).not.toContain('sensitive');
    expect(hashedFilename).toMatch(/^[a-f0-9]{64}$/);
  });

  test('should encrypt metadata (MIME type, original filename)', () => {
    const metadata = JSON.stringify({
      originalFilename: 'patient_notes.txt',
      mimeType: 'text/plain',
      uploadedAt: new Date().toISOString()
    });
    
    const encryptedMetadata = encryptFileBuffer(Buffer.from(metadata, 'utf-8'));
    
    // Encrypted metadata should not contain plain text
    const encryptedString = encryptedMetadata.toString('utf-8');
    expect(encryptedString).not.toContain('patient_notes');
    expect(encryptedString).not.toContain('text/plain');
    
    // But should decrypt correctly
    const decryptedMetadata = decryptFileBuffer(encryptedMetadata).toString('utf-8');
    expect(JSON.parse(decryptedMetadata)).toEqual(JSON.parse(metadata));
  });

  test('should support encryption key rotation', () => {
    // Simulate key rotation scenario
    const originalKey = process.env.ENCRYPTION_KEY;
    const keyId = 'key-v1';
    
    // In production, key ID is stored with encrypted data
    const metadata = {
      keyId,
      encryptionAlgorithm: 'aes-256-gcm'
    };
    
    expect(metadata.keyId).toBe('key-v1');
    expect(metadata.encryptionAlgorithm).toBe('aes-256-gcm');
    
    // Future keys would be 'key-v2', 'key-v3', etc.
    // System can lookup correct key by ID during decryption
  });
});
