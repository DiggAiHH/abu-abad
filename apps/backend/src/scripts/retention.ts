/**
 * Retention Cleanup (DSGVO Art. 17/25, ISO 27001)
 *
 * Aufgaben:
 * - Refresh Tokens: abgelaufen/widerrufen entfernen
 * - Patient Materials: auto_delete_after erzwingen (Datei + DB)
 * - Users: nach Ablauf data_retention_until PII final anonymisieren
 *
 * Ausführung (Beispiel Cron):
 * - täglich: npm run retention:run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../utils/logger.js';
import { query } from '../database/init.js';
import { cleanupExpiredTokens } from '../utils/jwt.js';
import { decrypt, encrypt } from '../utils/encryption.js';

const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.resolve(process.cwd(), '../../uploads/patient-materials');

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (err: any) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }
}

async function cleanupPatientMaterials(): Promise<{ deletedRows: number; deletedFiles: number }>{
  const batch = await query<{ id: string; file_path_encrypted: string | null }>(
    `SELECT id, file_path_encrypted
     FROM patient_materials
     WHERE auto_delete_after IS NOT NULL
       AND auto_delete_after <= CURRENT_TIMESTAMP
     ORDER BY auto_delete_after ASC
     LIMIT 500`
  );

  let deletedRows = 0;
  let deletedFiles = 0;

  for (const row of batch.rows) {
    try {
      if (row.file_path_encrypted) {
        const encryptedFileName = decrypt(row.file_path_encrypted);
        if (encryptedFileName) {
          const filePath = path.join(UPLOAD_DIR, encryptedFileName);
          await safeUnlink(filePath);
          deletedFiles += 1;
        }
      }

      await query('DELETE FROM patient_materials WHERE id = $1', [row.id]);
      deletedRows += 1;
    } catch (err) {
      logger.error('Retention: Fehler beim Löschen patient_material', { id: row.id, err });
    }
  }

  return { deletedRows, deletedFiles };
}

async function purgeExpiredUsers(): Promise<number> {
  const expired = await query<{ id: string }>(
    `SELECT id
     FROM users
     WHERE is_active = false
       AND data_retention_until IS NOT NULL
       AND data_retention_until <= CURRENT_TIMESTAMP
     ORDER BY data_retention_until ASC
     LIMIT 200`
  );

  let purged = 0;

  for (const row of expired.rows) {
    try {
      // Refresh Tokens entfernen
      await query('DELETE FROM refresh_tokens WHERE user_id = $1', [row.id]);

      // PII final anonymisieren (kein Hard-Delete wegen Accounting/Referenzen)
      await query(
        `UPDATE users
         SET
           first_name_encrypted = $2,
           last_name_encrypted = $3,
           phone_encrypted = NULL,
           date_of_birth = NULL,
           street_encrypted = NULL,
           city_encrypted = NULL,
           postal_code_encrypted = NULL,
           license_number = NULL,
           specialization = NULL,
           bio = NULL,
           hourly_rate = NULL,
           is_verified = FALSE,
           email_verified_at = NULL,
           last_login_at = NULL,
           gdpr_consent_at = NULL,
           data_retention_until = NULL
         WHERE id = $1`,
        [row.id, encrypt('[deleted]'), encrypt('[deleted]')]
      );

      // Optional: Audit Log minimal (DB)
      await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [row.id, 'system.retention.user_purged', 'user', row.id, { reason: 'data_retention_until' }]
      );

      purged += 1;
    } catch (err) {
      logger.error('Retention: Fehler beim Purge user', { id: row.id, err });
    }
  }

  return purged;
}

async function tryCleanupLegacyFunction(): Promise<void> {
  // Manche Deployments enthalten cleanup_expired_questionnaire_data() aus alten Migrations.
  // Wenn vorhanden, ausführen; wenn nicht, ignorieren.
  try {
    await query('SELECT cleanup_expired_questionnaire_data()');
  } catch {
    // ignore
  }
}

async function main(): Promise<void> {
  logger.info('Retention: Start');

  await cleanupExpiredTokens();

  const materials = await cleanupPatientMaterials();
  const purgedUsers = await purgeExpiredUsers();

  await tryCleanupLegacyFunction();

  logger.info('Retention: Done', {
    deletedPatientMaterials: materials.deletedRows,
    deletedPatientMaterialFiles: materials.deletedFiles,
    purgedUsers,
  });
}

main().catch((err) => {
  logger.error('Retention: Fatal', err);
  process.exit(1);
});
