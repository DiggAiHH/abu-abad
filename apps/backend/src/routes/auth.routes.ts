/**
 * Authentifizierungs-Routes
 * Endpoints: Register, Login, Refresh Token, Logout
 */

import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { rateLimit } from 'express-rate-limit';
import { query } from '../database/init.js';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyAccessToken,
  verifyRefreshToken, 
  revokeRefreshToken 
} from '../utils/jwt.js';
import { encrypt } from '../utils/encryption.js';
import { registerSchema, loginSchema } from '../utils/validation.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { writeAuditLog } from '../utils/audit.js';

const router = Router();

function setRefreshTokenCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshTokenCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/auth',
  });
}

// SECURITY: Strengeres Rate-Limiting für Login (verhindert Brute-Force)
// HISTORY-AWARE: E2E-Tests erwarten deterministisches Verhalten; daher secure-by-default.
const loginRateLimitMaxEnv = Number(process.env.LOGIN_RATE_LIMIT_MAX);
const loginRateLimitMax = Number.isFinite(loginRateLimitMaxEnv) ? loginRateLimitMaxEnv : 5;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // DSGVO-SAFE: Brute-Force-Schutz ist sicherheitskritisch (medizinische App)
  // Override nur explizit via ENV (z.B. lokale Lasttests).
  max: Number.isFinite(loginRateLimitMax) && loginRateLimitMax > 0 ? loginRateLimitMax : 5,
  message: { error: 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/auth/register
 * Registriert einen neuen Benutzer (Therapeut oder Patient)
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    // Prüfe ob E-Mail bereits existiert
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [validatedData.email]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('E-Mail existiert bereits', 409);
    }

    // Passwort hashen (bcrypt mit Salt Rounds = 12)
    const passwordHash = await bcrypt.hash(validatedData.password, 12);

    // Persönliche Daten verschlüsseln (DSGVO Art. 32)
    const firstNameEncrypted = encrypt(validatedData.firstName);
    const lastNameEncrypted = encrypt(validatedData.lastName);
    const phoneEncrypted = validatedData.phone ? encrypt(validatedData.phone) : null;

    // Benutzer erstellen
    const result = await query<{ id: string }>(
      `INSERT INTO users (
        email, password_hash, role, 
        first_name_encrypted, last_name_encrypted, phone_encrypted,
        gdpr_consent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING id`,
      [
        validatedData.email,
        passwordHash,
        validatedData.role,
        firstNameEncrypted,
        lastNameEncrypted,
        phoneEncrypted
      ]
    );

    const userId = result.rows[0].id;

    // JWT Tokens generieren
    const accessToken = generateAccessToken({
      userId,
      email: validatedData.email,
      role: validatedData.role
    });

    const refreshToken = await generateRefreshToken(userId);

    setRefreshTokenCookie(res, refreshToken);

    await writeAuditLog({
      userId,
      action: 'auth.register',
      req,
      metadata: { role: validatedData.role },
    });

    logger.info('Benutzer registriert', { userId, role: validatedData.role });

    res.status(201).json({
      message: 'Registrierung erfolgreich',
      token: accessToken, // Konsistent mit Frontend expectation
      // Secure-by-default: Refresh Token ist HttpOnly Cookie (Body optional nur für Dev/Tests)
      ...(process.env.RETURN_REFRESH_TOKEN_IN_BODY === 'true' || process.env.NODE_ENV !== 'production'
        ? { refreshToken }
        : {}),
      user: {
        id: userId,
        email: validatedData.email,
        role: validatedData.role
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Authentifiziert einen Benutzer
 */
router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = loginSchema.parse(req.body);

    // Benutzer suchen
    const result = await query<{
      id: string;
      email: string;
      password_hash: string;
      role: 'therapist' | 'patient';
      is_active: boolean;
    }>(
      'SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1',
      [validatedData.email]
    );

    // Defensive Check
    if (!result || !result.rows || result.rows.length === 0) {
      // Timing Attack Prevention: Immer gleiche Verzögerung
      await bcrypt.hash('dummy', 12);
      throw new AppError('Ungültige Anmeldedaten', 401);
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new AppError('Account deaktiviert. Bitte kontaktieren Sie den Support.', 403);
    }

    // Passwort prüfen
    const isPasswordValid = await bcrypt.compare(
      validatedData.password,
      user.password_hash
    );

    if (!isPasswordValid) {
      await writeAuditLog({
        userId: null,
        action: 'auth.login.failed',
        req,
        metadata: { reason: 'invalid_credentials' },
      });

      logger.warn('Fehlgeschlagener Login-Versuch', { reason: 'invalid_credentials' });
      throw new AppError('Ungültige Anmeldedaten', 401);
    }

    // Last Login aktualisieren (non-blocking)
    query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    ).catch(err => logger.error('Fehler beim Update last_login_at:', err));

    // Tokens generieren
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    const refreshToken = await generateRefreshToken(user.id);

    setRefreshTokenCookie(res, refreshToken);

    await writeAuditLog({
      userId: user.id,
      action: 'auth.login.success',
      req,
      metadata: { role: user.role },
    });

    logger.info('Benutzer angemeldet', { userId: user.id, role: user.role });

    res.json({
      message: 'Login erfolgreich',
      token: accessToken, // Konsistent mit Frontend expectation
      ...(process.env.RETURN_REFRESH_TOKEN_IN_BODY === 'true' || process.env.NODE_ENV !== 'production'
        ? { refreshToken }
        : {}),
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Erneuert Access Token mit Refresh Token
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = (req as any).cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      throw new AppError('Refresh Token erforderlich', 401);
    }

    const userId = await verifyRefreshToken(refreshToken);

    if (!userId) {
      throw new AppError('Ungültiges Refresh Token', 401);
    }

    // Benutzer-Daten holen
    const result = await query<{
      id: string;
      email: string;
      role: 'therapist' | 'patient';
    }>(
      'SELECT id, email, role FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Benutzer nicht gefunden', 404);
    }

    const user = result.rows[0];

    // Optional: Refresh Token Rotation (ASVS: Session Management)
    const rotate = process.env.REFRESH_TOKEN_ROTATION === 'true' || process.env.NODE_ENV === 'production';
    let nextRefreshToken: string | null = null;
    if (rotate) {
      await revokeRefreshToken(refreshToken);
      nextRefreshToken = await generateRefreshToken(user.id);
      setRefreshTokenCookie(res, nextRefreshToken);
    }

    // Neues Access Token generieren
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    res.json({
      accessToken,
      ...(process.env.RETURN_REFRESH_TOKEN_IN_BODY === 'true' || process.env.NODE_ENV !== 'production'
        ? { refreshToken: nextRefreshToken ?? refreshToken }
        : {})
    });
  } catch (error) {
    // IMPORTANT: never throw from an async express handler without next(),
    // otherwise it can crash the process (unhandled promise rejection).
    return next(error);
  }
});

/**
 * POST /api/auth/logout
 * Widerruft Refresh Token (Logout)
 *
 * Stabilität: Logout muss auch ohne gültigen Access Token funktionieren,
 * damit ein "kaputter" Client-State (401) nicht das Löschen des Refresh-Cookies verhindert.
 */
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = (req as any).cookies?.refreshToken || req.body?.refreshToken;

    // Optional: Wenn ein Access Token vorhanden ist, für Audit-Log nutzen (ohne Logout davon abhängig zu machen).
    let userIdForAudit: string | null = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const payload = verifyAccessToken(authHeader.substring(7));
        userIdForAudit = payload.userId;
      }
    } catch {
      // ignore
    }

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    clearRefreshTokenCookie(res);

    await writeAuditLog({
      userId: userIdForAudit,
      action: 'auth.logout',
      req,
    });

    logger.info('Benutzer abgemeldet', { userId: userIdForAudit });

    res.json({ message: 'Abmeldung erfolgreich' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Gibt aktuelle Benutzer-Daten zurück
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT 
        id, email, role, is_verified, 
        first_name_encrypted, last_name_encrypted, 
        specialization, bio, hourly_rate,
        created_at
      FROM users 
      WHERE id = $1`,
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Benutzer nicht gefunden', 404);
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.is_verified,
      specialization: user.specialization,
      bio: user.bio,
      hourlyRate: user.hourly_rate,
      createdAt: user.created_at
    });
  } catch (error) {
    throw error;
  }
});

export default router;
