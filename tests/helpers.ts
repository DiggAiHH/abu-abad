import { Page } from '@playwright/test';

/**
 * Test-Hilfsfunktionen
 */

export const TEST_USERS = {
  therapist: {
    email: 'therapeut@test.de',
    password: 'Test123!',
    firstName: 'Dr. Test',
    lastName: 'Therapeut',
    role: 'therapist' as const
  },
  patient: {
    email: 'patient@test.de',
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'Patient',
    role: 'patient' as const
  }
};

export async function registerUser(page: Page, user: typeof TEST_USERS.therapist | typeof TEST_USERS.patient) {
  // PERFORMANCE-OPTIMIERUNG: API-Call statt UI-Interaktion
  // Dies umgeht die Timeouts im Docker-Container bei langsamer UI
  const makeRequest = async () => page.request.post('/api/auth/register', {
    data: {
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      gdprConsent: true
    }
  });

  let response = await makeRequest();

  // Retry on Rate Limit (429)
  if (response.status() === 429) {
    console.log('⚠️ Rate limit hit during registration, waiting 2s...');
    await page.waitForTimeout(2000);
    response = await makeRequest();
  }

  // Falls User schon existiert (409), loggen wir uns einfach ein
  if (response.status() === 409) {
    await loginUser(page, { email: user.email, password: user.password });
    return;
  }

  if (!response.ok()) {
    const contentType = response.headers()['content-type'];
    if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(`Registration failed: ${JSON.stringify(error)}`);
    } else {
        const text = await response.text();
        throw new Error(`Registration failed (Status ${response.status()}): ${text}`);
    }
  }

  const { token } = await response.json();

  // Token in LocalStorage injizieren (simuliert Login)
  await page.goto('/'); // Context muss geladen sein
  await page.evaluate((t) => {
    localStorage.setItem('token', t);
  }, token);

  // Direkt zum Dashboard springen
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
}

export async function registerUserViaUI(page: Page, user: typeof TEST_USERS.therapist | typeof TEST_USERS.patient) {
  await page.goto('/register');
  
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[placeholder*="Vorname"]', user.firstName);
  await page.fill('input[placeholder*="Nachname"]', user.lastName);
  await page.fill('input[type="password"]:not([placeholder*="best"])', user.password);
  await page.fill('input[placeholder*="best"]', user.password);
  
  // Rolle auswählen
  await page.check(`input[value="${user.role}"]`);
  
  // DSGVO-Checkbox
  await page.check('input[type="checkbox"]');
  
  await page.click('button[type="submit"]');
  
  // Warte auf Redirect zum Dashboard
  // DOCKER-FIX: Timeout erhöht auf 20s für Container-Performance
  await page.waitForURL('**/dashboard', { timeout: 20000 });
  await page.waitForLoadState('networkidle');
}

export async function loginUser(page: Page, credentials: { email: string; password: string }) {
  // PERFORMANCE-OPTIMIERUNG: API-Call statt UI-Interaktion
  const makeRequest = async () => page.request.post('/api/auth/login', {
    data: {
      email: credentials.email,
      password: credentials.password
    }
  });

  let response = await makeRequest();

  // Retry on Rate Limit (429)
  if (response.status() === 429) {
    console.log('⚠️ Rate limit hit during login, waiting 2s...');
    await page.waitForTimeout(2000);
    response = await makeRequest();
  }

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Login failed: ${response.status()} ${response.statusText()} - ${text}`);
  }

  const { token } = await response.json();

  // Token in LocalStorage injizieren
  await page.goto('/'); 
  await page.evaluate((t) => {
    localStorage.setItem('token', t);
  }, token);

  // Zum Dashboard navigieren
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
}

export async function loginUserViaUI(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/login');
  await page.fill('input[type="email"]', credentials.email);
  await page.fill('input[type="password"]', credentials.password);
  await page.click('button[type="submit"]');
  // DOCKER-FIX: Timeout erhöht auf 20s und LoadState check
  await page.waitForURL(/\/(dashboard|patient-dashboard|therapist-dashboard)/, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
}

export async function loginAsPatient(page: Page) {
  await loginUser(page, { email: TEST_USERS.patient.email, password: TEST_USERS.patient.password });
}

export async function loginAsTherapist(page: Page) {
  await loginUser(page, { email: TEST_USERS.therapist.email, password: TEST_USERS.therapist.password });
}

export async function logoutUser(page: Page) {
  await page.click('button:has-text("Abmelden")');
  await page.waitForURL('**/login', { timeout: 3000 });
}

export function generateRandomEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
}

/**
 * Nimmt einen Screenshot für Dokumentationszwecke
 * @param page - Playwright Page-Objekt
 * @param name - Name des Screenshots
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ 
    path: `screenshots/${name}.png`,
    fullPage: true 
  });
}

export async function createAppointment(page: Page, startTime: string, endTime: string, price: number = 120) {
  await page.click('button:has-text("Slot erstellen")');
  
  await page.fill('input[type="datetime-local"]:first-of-type', startTime);
  await page.fill('input[type="datetime-local"]:last-of-type', endTime);
  await page.fill('input[type="number"]', price.toString());
  
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);
}

export function getDateTimeString(hoursFromNow: number): string {
  const date = new Date();
  date.setHours(date.getHours() + hoursFromNow);
  return date.toISOString().slice(0, 16);
}
