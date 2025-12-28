/**
 * Environment Variable Validation
 * SECURITY: Server crasht beim Start wenn kritische ENV-Variablen fehlen
 * DSGVO: Verhindert Produktion mit unsicheren Default-Werten
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';

const envSchema = z.object({
  // Server
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database (CRITICAL: keine Defaults erlaubt)
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL ist erforderlich'),
  
  // JWT (CRITICAL: Secret muss mindestens 32 Zeichen haben)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET muss mindestens 32 Zeichen lang sein'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET muss mindestens 32 Zeichen lang sein'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  
  // Encryption (CRITICAL: Key muss AES-256 kompatibel sein)
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY muss mindestens 32 Zeichen lang sein'),
  
  // Stripe (CRITICAL: keine Test-Keys in Produktion)
  STRIPE_SECRET_KEY: z.string()
    .startsWith('sk_', 'STRIPE_SECRET_KEY muss mit sk_ beginnen')
    .refine(
      (val) => {
        const isProd = process.env.NODE_ENV === 'production';
        const isTestKey = val.startsWith('sk_test_');
        // In Produktion MÜSSEN Live-Keys verwendet werden
        return !isProd || !isTestKey;
      },
      { message: 'Stripe Test-Keys sind in Produktion nicht erlaubt' }
    ),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // CORS
  ALLOWED_ORIGINS: z.string().transform((val) => val.split(',')),
  
  // PeerJS
  PEER_PORT: z.string().default('3001').transform(Number),
  PEER_PATH: z.string().default('/peerjs'),
});

type Env = z.infer<typeof envSchema>;

/**
 * Validiert alle ENV-Variablen beim Server-Start
 * @throws {Error} Wenn kritische ENV-Variablen fehlen oder ungültig sind
 */
function validateEnv(): Env {
  try {
    const validatedEnv = envSchema.parse(process.env);
    logger.info('✅ ENV-Variablen erfolgreich validiert');
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => 
        `  - ${issue.path.join('.')}: ${issue.message}`
      ).join('\n');
      
      logger.error('❌ ENV-Validierung fehlgeschlagen:\n' + issues);
      
      // Server crasht absichtlich (Fail-Fast Principle)
      throw new Error(
        'Kritische ENV-Variablen fehlen oder sind ungültig. ' +
        'Bitte .env Datei überprüfen:\n' + issues
      );
    }
    throw error;
  }
}

// Lazy Loading: Validierung erfolgt erst beim ersten Zugriff
let _env: Env | null = null;
const getEnv = (): Env => {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
};

// Export als Proxy für lazy loading
export default new Proxy({} as Env, {
  get(_target, prop) {
    return getEnv()[prop as keyof Env];
  }
});

