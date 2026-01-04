type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const isProd = import.meta.env.MODE === 'production';

function normalizeLogLevel(level: unknown): LogLevel {
  const value = String(level ?? '').toLowerCase();
  if (value === 'silent') return 'silent';
  if (value === 'error') return 'error';
  if (value === 'warn') return 'warn';
  if (value === 'info') return 'info';
  if (value === 'debug') return 'debug';
  return isProd ? 'error' : 'debug';
}

const configuredLevel = normalizeLogLevel(import.meta.env.VITE_CLIENT_LOG_LEVEL);
const levelOrder: Record<Exclude<LogLevel, 'silent'>, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function shouldLog(level: Exclude<LogLevel, 'silent'>): boolean {
  if (configuredLevel === 'silent') return false;
  return levelOrder[level] <= levelOrder[configuredLevel as Exclude<LogLevel, 'silent'>];
}

function stripQuery(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.search = '';
    return parsed.toString();
  } catch {
    const idx = url.indexOf('?');
    return idx >= 0 ? url.slice(0, idx) : url;
  }
}

function sanitizeError(error: unknown): unknown {
  try {
    if (!error || typeof error !== 'object') {
      return { message: String(error) };
    }

    const anyError = error as any;

    const message = typeof anyError.message === 'string' ? anyError.message : undefined;
    const code = typeof anyError.code === 'string' ? anyError.code : undefined;

    const status =
      typeof anyError?.response?.status === 'number'
        ? anyError.response.status
        : typeof anyError?.status === 'number'
          ? anyError.status
          : undefined;

    const method =
      typeof anyError?.config?.method === 'string'
        ? String(anyError.config.method).toUpperCase()
        : undefined;

    const urlRaw =
      typeof anyError?.config?.url === 'string'
        ? anyError.config.url
        : typeof anyError?.request?.responseURL === 'string'
          ? anyError.request.responseURL
          : undefined;

    const url = urlRaw ? stripQuery(urlRaw) : undefined;

    // Never include headers, request/response bodies, cookies, tokens, etc.
    return {
      name: typeof anyError.name === 'string' ? anyError.name : 'Error',
      message,
      code,
      status,
      method,
      url,
    };
  } catch {
    return { name: 'Error', message: 'Unknown error' };
  }
}

const recentErrors = new Map<string, { ts: number; count: number }>();
const DEDUPE_WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 2;

function allowErrorLog(signature: string): boolean {
  const now = Date.now();
  const record = recentErrors.get(signature);

  if (!record) {
    recentErrors.set(signature, { ts: now, count: 1 });
    return true;
  }

  if (now - record.ts > DEDUPE_WINDOW_MS) {
    recentErrors.set(signature, { ts: now, count: 1 });
    return true;
  }

  if (record.count >= MAX_PER_WINDOW) return false;

  record.count += 1;
  return true;
}

function makeSignature(context: string, sanitized: any): string {
  const parts = [
    context,
    sanitized?.name,
    sanitized?.message,
    sanitized?.code,
    sanitized?.status,
    sanitized?.method,
    sanitized?.url,
  ]
    .filter(Boolean)
    .map(String);
  return parts.join('|').slice(0, 400);
}

function formatPrefix(level: string): string {
  return `[client:${level}]`;
}

export const logger = {
  debug(context: string, meta?: unknown) {
    if (!shouldLog('debug')) return;
    // eslint-disable-next-line no-console
    console.debug(formatPrefix('debug'), context, meta ?? '');
  },

  info(context: string, meta?: unknown) {
    if (!shouldLog('info')) return;
    // eslint-disable-next-line no-console
    console.info(formatPrefix('info'), context, meta ?? '');
  },

  warn(context: string, meta?: unknown) {
    if (!shouldLog('warn')) return;
    const safeMeta = isProd ? sanitizeError(meta) : meta;
    // eslint-disable-next-line no-console
    console.warn(formatPrefix('warn'), context, safeMeta ?? '');
  },

  error(context: string, error?: unknown, meta?: unknown) {
    if (!shouldLog('error')) return;

    const safeError = isProd ? sanitizeError(error) : error;
    const safeMeta = isProd ? sanitizeError(meta) : meta;

    if (isProd) {
      const signature = makeSignature(context, safeError);
      if (!allowErrorLog(signature)) return;
    }

    // eslint-disable-next-line no-console
    console.error(formatPrefix('error'), context, safeError ?? '', safeMeta ?? '');
  },
};
