/**
 * Authentifizierungs-Middleware
 * Prüft JWT-Token und fügt User-Daten zu Request hinzu
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
 * @security JWT-basiert mit Bearer-Token
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentifizierung erforderlich' });
      return;
    }
    
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    
    req.user = payload;
    next();
  } catch (error) {
    logger.error('Auth-Fehler', error);
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
