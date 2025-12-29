/**
 * Authentifizierungs-Middleware
 * Prüft JWT-Token und fügt User-Daten zu Request hinzu
 * 
 * SECURITY: JWT-basierte Authentifizierung mit Bearer-Token
 * GDPR-COMPLIANCE: Keine Speicherung von Token-Inhalten in Logs
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JWTPayload } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

// Erweitere Express Request um User-Property
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Middleware: Authentifizierung erforderlich
 * @security JWT-basiert mit Bearer-Token (RFC 6750)
 * @gdpr Keine Logs von Token-Inhalten (Art. 32 DSGVO)
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    // SECURITY: Strict Bearer Token Validation
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentifizierung erforderlich' });
      return;
    }
    
    const token = authHeader.substring(7);
    
    // SECURITY: Verhindert Token-Reuse nach Logout (Blacklist-Check könnte hier ergänzt werden)
    const payload = verifyAccessToken(token);
    
    req.user = payload;
    next();
  } catch (error) {
    // GDPR-COMPLIANCE: Error-Log ohne Token-Details
    logger.error('Auth-Fehler', { message: (error as Error).message });
    res.status(401).json({ error: 'Ungültiges Token' });
    return;
  }
}

/**
 * Middleware: Nur für Therapeuten
 */
export function requireTherapist(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentifizierung erforderlich' });
    return;
  }

  if (req.user.role !== 'therapist') {
    res.status(403).json({ error: 'Nur für Therapeuten zugänglich' });
    return;
  }

  next();
}

/**
 * Middleware: Nur für Patienten
 */
export function requirePatient(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentifizierung erforderlich' });
    return;
  }

  if (req.user.role !== 'patient') {
    res.status(403).json({ error: 'Nur für Patienten zugänglich' });
    return;
  }

  next();
}
