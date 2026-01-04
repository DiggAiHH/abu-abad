/**
 * Logger-Utility mit strukturierten Logs
 * Production-ready: JSON-Format für Log-Aggregation
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const DEFAULT_REDACT_KEYS = [
  'password',
  'pass',
  'pwd',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'set-cookie',
  'email',
  'ip',
  'ip_address',
  'phone',
  'firstName',
  'lastName',
  'name',
  'street',
  'postal',
  'city',
  'address',
  'user_agent',
  'userAgent',
  // OCR/PDF imports can contain sensitive health data (DSGVO Art. 9)
  'pdfText',
  'extractedText',
  'ocrText',
  'documentText'
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function redactPII(meta: unknown, extraKeys: string[] = []): unknown {
  const redactKeySet = new Set(
    [...DEFAULT_REDACT_KEYS, ...extraKeys].map((k) => k.toLowerCase())
  );

  const visit = (value: unknown, keyHint?: string): unknown => {
    if (value == null) return value;

    if (Array.isArray(value)) {
      return value.map((v) => visit(v));
    }

    if (isPlainObject(value)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        const lower = k.toLowerCase();
        if (redactKeySet.has(lower) || lower.includes('token') || lower.includes('password')) {
          out[k] = '[redacted]';
        } else {
          out[k] = visit(v, k);
        }
      }
      return out;
    }

    if (typeof value === 'string') {
      if (keyHint && redactKeySet.has(keyHint.toLowerCase())) return '[redacted]';
      return value;
    }

    return value;
  };

  return visit(meta);
}

class Logger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatMessage(level: LogLevel, message: string, meta?: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta && { meta: redactPII(meta) }),
      env: process.env.NODE_ENV || 'development'
    };

    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify(logEntry);
    }
    
    // Development: Lesbareres Format
    const prefix = `[${logEntry.timestamp}] [${level.toUpperCase()}]`;
    return meta ? `${prefix} ${message} ${JSON.stringify(meta)}` : `${prefix} ${message}`;
  }

  info(message: string, meta?: any) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: any) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, error?: any) {
    if (this.shouldLog('error')) {
      const meta = error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            // Production: kein Stack in Logs (kann sensitive enthalten)
            ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
          }
        : error;

      console.error(this.formatMessage('error', message, meta));
    }
  }

  debug(message: string, meta?: any) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }
}

export const logger = new Logger();
