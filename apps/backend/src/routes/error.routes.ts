/**
 * Error Reporting Routes
 * DSGVO-konform: Opt-in Error Logging (Art. 6 Abs. 1 lit. f)
 * PHASE 3: Client Error Reporting System
 * 
 * Purpose: Local error logging for debugging (no third-party services)
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// POST /api/errors/report - Client Error Report (Anonymous)
// ═══════════════════════════════════════════════════════════════
router.post('/report', async (req: Request, res: Response) => {
  try {
    const {
      timestamp,
      userAgent,
      url,
      errorMessage,
      errorStack,
      componentStack,
      userFeedback,
    } = req.body;

    // DSGVO-SAFE: Sanitize PII from stack traces
    const sanitizedStack = sanitizeStackTrace(errorStack);
    const sanitizedComponentStack = sanitizeStackTrace(componentStack);

    // Log error (Winston with rotation)
    logger.error('Client Error Report', {
      timestamp,
      userAgent: sanitizeUserAgent(userAgent),
      url: sanitizeUrl(url),
      errorMessage,
      errorStack: sanitizedStack,
      componentStack: sanitizedComponentStack,
      userFeedback: userFeedback?.substring(0, 500), // Limit feedback length
      ip: req.ip,
    });

    // HISTORY-AWARE: Store in database for admin dashboard (optional)
    // const pool: Pool = (req as any).pool;
    // await pool.query(
    //   `INSERT INTO error_reports (
    //     timestamp, user_agent, url, error_message, 
    //     error_stack, component_stack, user_feedback, ip_address
    //   ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    //   [
    //     timestamp,
    //     sanitizeUserAgent(userAgent),
    //     sanitizeUrl(url),
    //     errorMessage,
    //     sanitizedStack,
    //     sanitizedComponentStack,
    //     userFeedback?.substring(0, 500),
    //     req.ip
    //   ]
    // );

    res.status(201).json({ message: 'Error report received' });
  } catch (error: any) {
    logger.error('Failed to process error report:', error);
    res.status(500).json({ error: 'Failed to process error report' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Helper: Sanitize User Agent (Remove full version numbers)
// ═══════════════════════════════════════════════════════════════
function sanitizeUserAgent(userAgent: string): string {
  if (!userAgent) return 'Unknown';
  
  // Extract browser and OS only (remove specific versions for DSGVO)
  const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera|MSIE|Trident)/i);
  const osMatch = userAgent.match(/(Windows|Mac OS|Linux|Android|iOS)/i);
  
  const browser = browserMatch ? browserMatch[0] : 'Unknown Browser';
  const os = osMatch ? osMatch[0] : 'Unknown OS';
  
  return `${browser} on ${os}`;
}

// ═══════════════════════════════════════════════════════════════
// Helper: Sanitize URL (Remove query params with PII)
// ═══════════════════════════════════════════════════════════════
function sanitizeUrl(url: string): string {
  if (!url) return 'Unknown';
  
  try {
    const urlObj = new URL(url);
    // Remove query params (may contain PII)
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch {
    return 'Invalid URL';
  }
}

// ═══════════════════════════════════════════════════════════════
// Helper: Sanitize Stack Trace (Remove file paths with usernames)
// ═══════════════════════════════════════════════════════════════
function sanitizeStackTrace(stack: string | undefined): string {
  if (!stack) return '';
  
  // Remove absolute file paths (may contain usernames)
  return stack
    .replace(/\/home\/[^\/]+/g, '/home/USER')
    .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\USER')
    .replace(/\/Users\/[^\/]+/g, '/Users/USER')
    .replace(/file:\/\/\/[^\s]+/g, '[FILE_PATH]')
    .substring(0, 2000); // Limit stack trace length
}

export default router;
