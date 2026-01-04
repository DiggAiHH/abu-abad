/**
 * Compatibility shim.
 *
 * Some TS server states / older references expect this file path.
 * Keep it as a thin re-export to avoid "file not found" diagnostics.
 */

export { errorHandler, AppError } from './errorHandler.js';
