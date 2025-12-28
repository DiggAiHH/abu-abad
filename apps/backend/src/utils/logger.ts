/**
 * Logger-Utility mit strukturierten Logs
 * Production-ready: JSON-Format für Log-Aggregation
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

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
      ...(meta && { meta }),
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
      const meta = error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error;
        // Fehler zusätzlich an externen Service senden (z.B. Sentry)
        if (process.env.NODE_ENV === 'production' && typeof fetch === 'function') {
          try {
            fetch('/api/log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ level: 'error', message, meta }),
            });
          } catch (e) { /* ignore */ }
        }
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
