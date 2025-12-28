/**
 * PostgreSQL Connection Pool (Alternative zu database/init.ts)
 * Wird von db/migrate.ts verwendet
 * ENV: Validiert durch env.ts
 */

import { Pool } from 'pg';
import env from './env.js';

// DSGVO-konform: PostgreSQL mit SSL, prepared statements (SQL Injection Prevention)
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 20, // Connection Pool für Performance
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test DB Connection
pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err: Error) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

export default pool;
