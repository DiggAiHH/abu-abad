type AnalyticsEvent = {
  event: string;
  ts: string;
  props?: Record<string, unknown>;
};

function safeProps(props: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!props) return undefined;

  // Privacy-by-default: avoid accidentally shipping secrets/PII.
  const blockedKeys = new Set(['email', 'password', 'token', 'accessToken', 'refreshToken']);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!blockedKeys.has(k)) out[k] = v;
  }
  return out;
}

export function track(event: string, props?: Record<string, unknown>): void {
  try {
    const rawApiUrl = import.meta.env.VITE_API_URL || '';
    const apiOrigin = rawApiUrl.replace(/\/$/, '').replace(/\/api$/, '');
    // In Production ohne Backend-Origin: nicht senden.
    if (import.meta.env.PROD && !apiOrigin) return;

    const payload: AnalyticsEvent = {
      event,
      ts: new Date().toISOString(),
      props: safeProps(props),
    };

    // Self-hosted: send to backend. If offline/unreachable, fail silently.
    const url = apiOrigin ? `${apiOrigin}/api/analytics/events` : '/api/analytics/events';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'include',
    }).catch(() => undefined);
  } catch {
    // No-op
  }
}
