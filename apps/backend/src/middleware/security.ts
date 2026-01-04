import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
if (isDev) {
  logger.info('⚠️ Security: Rate Limiting disabled for Development/Testing');
}

/**
 * Rate Limiting (OWASP: DoS Prevention)
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: isDev ? 100000 : 5, // High limit for Dev
  message: 'Zu viele Login-Versuche. Bitte versuchen Sie es später erneut.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100000 : 100, // High limit for Dev
  message: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * CORS Headers (nur erlaubte Origins)
 */
export function corsHeaders(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? process.env.CORS_ORIGIN)?.split(',') || ['http://localhost:5175'];
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  
  next();
}

/**
 * Input Sanitization (XSS Prevention)
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Trim whitespace
        req.body[key] = req.body[key].trim();
      }
    }
  }
  next();
}

/**
 * Error Handler (verhindert Information Disclosure)
 */
export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Error:', error);
  
  // In Production: keine Stack Traces
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'Interner Serverfehler',
    ...(isDevelopment && { details: error.message, stack: error.stack }),
  });
}
