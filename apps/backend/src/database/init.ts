/**
 * Datenbankinitialisierung mit PostgreSQL
 * Implementiert Connection Pooling für Performance
 * ACID-Garantien für Gesundheitsdaten
 * ENV: Validiert durch env.ts (DATABASE_URL required)
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { readFile } from 'node:fs/promises';
import { logger } from '../utils/logger.js';
import env from '../config/env.js';

// Lazy Loading: Pool wird erst erstellt wenn benötigt
let _pool: Pool | null = null;
export const getPool = (): Pool => {
  if (!_pool) {
    _pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Error Handler für Pool (Fail-Fast)
    _pool.on('error', (err) => {
      logger.error('❌ Unerwarteter Pool-Error:', err);
      process.exit(1);
    });
  }
  return _pool;
};

// Compatibility: Behält alten pool export für bestehenden Code
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    return getPool()[prop as keyof Pool];
  }
});

/**
 * Testet Datenbankverbindung und erstellt Schema
 */
export async function initDatabase(): Promise<void> {
  const client = await pool.connect();

  try {
    const result = await client.query('SELECT NOW()');
    logger.info(`Datenbank verbunden: ${result.rows[0].now}`);

    await createSchema(client);
  } catch (error) {
    logger.error('Datenbankinitialisierung fehlgeschlagen:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Erstellt/aktualisiert Schema (idempotent) aus SQL-Dateien.
 * Hinweis: Die SQL-Dateien werden beim Build nach dist/database kopiert.
 */
async function createSchema(client: PoolClient): Promise<void> {
  const schemaFiles = [
    new URL('./schema.sql', import.meta.url),
    new URL('./schema_extension_patient_prep.sql', import.meta.url)
  ];

  for (const schemaFileUrl of schemaFiles) {
    const sql = await readFile(schemaFileUrl, { encoding: 'utf8' });
    await client.query(sql);
  }

  logger.info('✓ Datenbankschema erstellt/aktualisiert (SQL-Dateien)');
}

/**
 * Query-Wrapper mit Performance-Logging
 * @returns PostgreSQL QueryResult mit typed rows
 */
export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;

  if (duration > 1000) {
    logger.warn(`Langsame Query (${duration}ms): ${text}`);
  }

  return result;
}
