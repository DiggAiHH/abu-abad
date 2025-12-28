/**
 * Globaler Error Handler
 * DSGVO-konform: Keine sensiblen Daten in Error-Messages
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod Validation Errors
  if (err instanceof ZodError) {
    const errors = err.errors.map((e: any) => ({
      field: e.path.join('.'),
      message: e.message
    }));

    res.status(400).json({
      error: 'Validierungsfehler',
      details: errors
    });
    return;
  }

  // App Errors (bekannte Fehler)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message
    });
    return;
  }

  // Unbekannte Fehler - Log für Debugging
  logger.error('Unbehandelter Fehler:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Keine Details an Client (Sicherheit)
  res.status(500).json({
    error: 'Ein interner Fehler ist aufgetreten'
  });
}
