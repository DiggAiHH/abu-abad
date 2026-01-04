/**
 * Globaler Error Handler
 * DSGVO-konform: Keine sensiblen Daten in Error-Messages
 * Robust: Unterscheidet zwischen Operational Errors (User-Feedback) und Bugs (Logs)
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const handleZodError = (err: ZodError) => {
  const errors = err.errors.map((e: any) => ({
    field: e.path.join('.'),
    message: e.message
  }));
  const message = `Validierungsfehler: ${errors[0]?.message}`;
  return new AppError(message, 400);
};

const handleCastErrorDB = (err: any) => {
  const message = `Ungültiger Wert ${err.value} für Feld ${err.path}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err: any) => {
  // Extrahiere den Wert aus dem Postgres Error Detail
  const match = err.detail?.match(/\((.*?)\)=\((.*?)\)/);
  const value = match ? match[2] : 'Unbekannt';
  const message = `Doppelter Eintrag: ${value}. Bitte verwenden Sie einen anderen Wert.`;
  return new AppError(message, 400);
};

const handleJWTError = () => new AppError('Ungültiger Token. Bitte melden Sie sich erneut an.', 401);

const handleJWTExpiredError = () => new AppError('Ihr Token ist abgelaufen. Bitte melden Sie sich erneut an.', 401);

const sendErrorDev = (err: any, res: Response) => {
  logger.error('DEV ERROR:', err);
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
    details: err.details // Falls vorhanden (z.B. Zod)
  });
};

const sendErrorProd = (err: any, res: Response) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      details: err.details
    });
  } 
  // Programming or other unknown error: don't leak details
  else {
    logger.error('ERROR 💥', err);
    res.status(500).json({
      status: 'error',
      message: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
    });
  }
};

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    // In Dev auch Zod Errors direkt anzeigen, aber vielleicht transformiert
    if (err instanceof ZodError) {
      const zodErr = handleZodError(err);
      // Behalte Original-Stack für Debugging
      zodErr.stack = err.stack;
      sendErrorDev(zodErr, res);
    } else {
      sendErrorDev(err, res);
    }
  } else {
    let error = { ...err };
    error.message = err.message;
    // Prototyp kopieren für instanceof Checks
    Object.setPrototypeOf(error, Object.getPrototypeOf(err));

    if (err instanceof ZodError) error = handleZodError(err);
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === '23505') error = handleDuplicateFieldsDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
}
