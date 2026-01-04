/**
 * Access-Token Handling (Client)
 *
 * Ziele:
 * - Kein Refresh Token im Storage (Refresh läuft via HttpOnly Cookie)
 * - Access Token möglichst kurzlebig; optional Session-Storage für Tab-Persistenz
 *
 * DSGVO/ASVS: Tokens sind sicherheitsrelevant; niemals in Logs ausgeben.
 */

const ACCESS_TOKEN_KEY = 'accessToken';

let inMemoryToken: string | null = null;

export function getAccessToken(): string | null {
  return inMemoryToken || sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  inMemoryToken = token;
  if (!token) {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    return;
  }
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  setAccessToken(null);
}
