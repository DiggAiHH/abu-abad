/**
 * DB Migration Entry-Point (idempotent)
 *
 * Diese App nutzt ein idempotentes Schema-Setup via initDatabase().
 * Damit sind "Migrations" in Dev/Test reproduzierbar, ohne zwei konkurrierende Systeme.
 */

import { initDatabase } from './init.js';
import { logger } from '../utils/logger.js';

async function main(): Promise<void> {
  try {
    await initDatabase();
    logger.info('✓ DB migrate: Schema/Extensions angewendet');
    process.exit(0);
  } catch (error) {
    logger.error('❌ DB migrate fehlgeschlagen:', error);
    process.exit(1);
  }
}

main();
