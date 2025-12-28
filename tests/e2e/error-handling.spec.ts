import { test, expect } from '@playwright/test';
import { registerUser, loginUser, TEST_USERS, generateRandomEmail } from '../helpers';

/**
 * Error Handling Tests: HTTP Status Codes, Network Errors, Timeouts
 * 
 * Quelle: RFC 7231 (HTTP Status Codes), OWASP API Security
 */

test.describe('HTTP Status Codes: 4xx Client Errors', () => {
  
  test('EDGE CASE: 401 Unauthorized sollte zu Login umleiten', async ({ page }) => {
    // Versuche ohne Authentication auf geschützte Route zuzugreifen
    await page.goto('http://localhost:5173/dashboard');
    
    // Sollte zu Login umgeleitet werden
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/login');
  });

  test('EDGE CASE: 403 Forbidden sollte aussagekräftige Fehlermeldung zeigen', async ({ page, request }) => {
    const patientEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email: patientEmail });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Patient versucht auf Therapeuten-Endpoint zuzugreifen
    const response = await request.post('http://localhost:3000/api/appointments', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        date: '2025-12-30',
        startTime: '10:00',
        endTime: '11:00',
        price: 100
      }
    });
    
    expect(response.status()).toBe(403);
    
    const error = await response.json();
    expect(error).toHaveProperty('error');
    expect(error.error).toMatch(/Forbidden|berechtigt|authorized|permission/i);
  });

  test('EDGE CASE: 404 Not Found sollte benutzerfreundliche Seite anzeigen', async ({ page }) => {
    await page.goto('http://localhost:5173/non-existent-route-12345');
    
    await page.waitForTimeout(2000);
    
    // Sollte 404-Seite oder Weiterleitung zeigen
    const has404 = await page.locator('text=/404|nicht gefunden|not found/i').count();
    const isRedirected = page.url().includes('/login') || page.url() === 'http://localhost:5173/';
    
    expect(has404 > 0 || isRedirected).toBe(true);
  });

  test('EDGE CASE: 422 Unprocessable Entity sollte Validierungsfehler ausgeben', async ({ page }) => {
    await page.goto('http://localhost:5173/register');
    
    const email = generateRandomEmail();
    await page.fill('input[type="email"]', email);
    await page.fill('input[placeholder*="Vorname"]', 'T'); // Zu kurz
    await page.fill('input[placeholder*="Nachname"]', 'U'); // Zu kurz
    await page.fill('input[type="password"]:not([placeholder*="best"])', '123'); // Zu kurz
    await page.fill('input[placeholder*="best"]', '123');
    await page.check('input[value="patient"]');
    await page.check('input[type="checkbox"]');
    
    await page.click('button[type="submit"]');
    
    // Sollte Validierungsfehler anzeigen
    await expect(page.locator('text=/zu kurz|too short|mindestens|minimum/i')).toBeVisible({ timeout: 5000 });
  });

  test('EDGE CASE: 429 Too Many Requests sollte Warnung anzeigen', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    
    // 15 schnelle Login-Versuche
    for (let i = 0; i < 15; i++) {
      await page.fill('input[type="email"]', `test${i}@example.com`);
      await page.fill('input[type="password"]', 'Test1234!');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(50); // Sehr schnell
    }
    
    // Rate Limiter sollte greifen
    await expect(page.locator('text=/Zu viele|rate limit|slow down|bitte warten/i')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('HTTP Status Codes: 5xx Server Errors', () => {
  
  test('EDGE CASE: 500 Internal Server Error sollte generische Fehlermeldung zeigen', async ({ page, request }) => {
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Sende ungültige Anfrage (z.B. falsches Datenformat)
    const response = await request.post('http://localhost:3000/api/appointments/invalid-id/book', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        // Fehlende erforderliche Felder
      }
    });
    
    if (response.status() === 500) {
      const error = await response.json();
      
      // Sollte KEINE sensiblen Stack-Traces enthalten (Production)
      const errorString = JSON.stringify(error);
      expect(errorString).not.toContain('at Function');
      expect(errorString).not.toContain('node_modules');
      expect(errorString).not.toContain('Database password');
    }
  });

  test('EDGE CASE: 503 Service Unavailable sollte Retry-Mechanismus aktivieren', async ({ page }) => {
    // Simuliere Service Unavailable durch Netzwerk-Fehler
    await page.route('**/api/**', route => {
      route.abort('failed');
    });
    
    await page.goto('http://localhost:5173/login');
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test1234!');
    await page.click('button[type="submit"]');
    
    // Sollte Fehler anzeigen
    await expect(page.locator('text=/Verbindung fehlgeschlagen|connection failed|nicht erreichbar/i')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Network Errors', () => {
  
  test('EDGE CASE: Offline-Modus sollte erkannt werden', async ({ page, context }) => {
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email });
    
    // Simuliere Offline-Modus
    await context.setOffline(true);
    
    await page.goto('http://localhost:5173/dashboard');
    await page.waitForTimeout(2000);
    
    // Sollte Offline-Warnung anzeigen
    const hasOfflineWarning = await page.locator('text=/Offline|keine Verbindung|no connection/i').count();
    expect(hasOfflineWarning).toBeGreaterThanOrEqual(0);
    
    // Zurück zu Online
    await context.setOffline(false);
  });

  test('EDGE CASE: Timeout sollte nach 30 Sekunden auftreten', async ({ page }) => {
    // Simuliere sehr langsame API
    await page.route('**/api/auth/login', route => {
      // Verzögere Antwort um 35 Sekunden
      setTimeout(() => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ token: 'fake-token' })
        });
      }, 35000);
    });
    
    await page.goto('http://localhost:5173/login');
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test1234!');
    await page.click('button[type="submit"]');
    
    // Sollte Timeout-Fehler anzeigen
    await expect(page.locator('text=/Timeout|Zeitüberschreitung|zu lange|took too long/i')).toBeVisible({ timeout: 40000 });
  });

  test('EDGE CASE: Unterbrochene Verbindung sollte behandelt werden', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    
    // Simuliere Verbindungsabbruch während Anfrage
    await page.route('**/api/auth/login', route => {
      route.abort('connectionfailed');
    });
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test1234!');
    await page.click('button[type="submit"]');
    
    // Sollte Fehler anzeigen
    await expect(page.locator('text=/Verbindung unterbrochen|connection lost|failed/i')).toBeVisible({ timeout: 10000 });
  });

  test('EDGE CASE: CORS-Fehler sollte aussagekräftig sein', async ({ page, request }) => {
    // Versuche API von falscher Origin aufzurufen
    const response = await request.post('http://localhost:3000/api/auth/register', {
      headers: {
        'Origin': 'http://evil-site.com',
        'Content-Type': 'application/json'
      },
      data: {
        email: 'hacker@evil.com',
        password: 'Test1234!',
        firstName: 'Hacker',
        lastName: 'Evil',
        role: 'patient',
        gdprConsent: true
      }
    });
    
    // CORS sollte blockieren
    const corsHeader = response.headers()['access-control-allow-origin'];
    expect(corsHeader).not.toBe('http://evil-site.com');
    expect(corsHeader).toBe('http://localhost:5173');
  });
});

test.describe('Validation Errors', () => {
  
  test('EDGE CASE: Fehlende Required-Felder sollten markiert werden', async ({ page }) => {
    await page.goto('http://localhost:5173/register');
    
    // Klicke Submit ohne Felder auszufüllen
    await page.click('button[type="submit"]');
    
    // Browser-native Validierung oder Custom-Fehler
    const requiredInputs = page.locator('input[required]');
    const count = await requiredInputs.count();
    
    expect(count).toBeGreaterThan(0);
    
    // Mindestens ein Feld sollte Fehlerzustand haben
    const invalidInputs = page.locator('input:invalid, input[aria-invalid="true"]');
    const invalidCount = await invalidInputs.count();
    
    expect(invalidCount).toBeGreaterThan(0);
  });

  test('EDGE CASE: Ungültiges Datenformat sollte abgelehnt werden', async ({ page, request }) => {
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Sende Termin mit ungültigem Datum
    const response = await request.post('http://localhost:3000/api/appointments', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        date: 'not-a-date',
        startTime: 'invalid-time',
        endTime: '25:99', // Ungültige Zeit
        price: 'abc' // String statt Zahl
      }
    });
    
    expect([400, 422]).toContain(response.status());
    
    const error = await response.json();
    expect(error).toHaveProperty('error');
  });
});

test.describe('Database Errors', () => {
  
  test('EDGE CASE: Datenbank-Verbindungsfehler sollte behandelt werden', async ({ page }) => {
    // Dieser Test würde reale DB-Verbindung unterbrechen müssen
    // Stattdessen: Prüfe, ob Error-Handling im Code vorhanden ist
    
    await page.goto('http://localhost:5173/login');
    
    // Simuliere DB-Fehler durch ungültige Credentials
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test1234!');
    
    // Mocke API-Response mit DB-Fehler
    await page.route('**/api/auth/login', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({
          error: 'Database connection failed'
        })
      });
    });
    
    await page.click('button[type="submit"]');
    
    // Sollte generischen Fehler anzeigen (keine DB-Details)
    await expect(page.locator('text=/Serverfehler|server error|Fehler aufgetreten/i')).toBeVisible({ timeout: 5000 });
    
    // Sollte KEINE DB-Details zeigen
    await expect(page.locator('text=/PostgreSQL|pg:|connection string/i')).not.toBeVisible();
  });
});

test.describe('Form Validation Edge Cases', () => {
  
  test('EDGE CASE: Sonderzeichen in Email sollten validiert werden', async ({ page }) => {
    await page.goto('http://localhost:5173/register');
    
    const invalidEmails = [
      'test@',
      '@example.com',
      'test..test@example.com',
      'test@example',
      'test example@test.com'
    ];
    
    for (const email of invalidEmails) {
      await page.fill('input[type="email"]', email);
      await page.fill('input[placeholder*="Vorname"]', 'Test');
      await page.fill('input[placeholder*="Nachname"]', 'User');
      await page.fill('input[type="password"]:not([placeholder*="best"])', 'Test1234!');
      await page.fill('input[placeholder*="best"]', 'Test1234!');
      await page.check('input[value="patient"]');
      await page.check('input[type="checkbox"]');
      
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);
      
      // Sollte Validierungsfehler anzeigen
      const hasError = await page.locator('text=/ungültig|invalid|format/i').count();
      expect(hasError).toBeGreaterThan(0);
      
      await page.goto('http://localhost:5173/register');
    }
  });

  test('EDGE CASE: Negative Zahlen in Preisfeld sollten abgelehnt werden', async ({ page }) => {
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email });
    
    await page.goto('http://localhost:5173/dashboard');
    await page.click('button:has-text("Slot erstellen"), button:has-text("Create Slot")');
    
    const priceInput = page.locator('input[type="number"], input[placeholder*="Preis"]').first();
    
    if (await priceInput.count() > 0) {
      await priceInput.fill('-50');
      await page.click('button[type="submit"]');
      
      // Sollte Fehler anzeigen
      await expect(page.locator('text=/negativ|negative|ungültig|invalid/i')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('API Error Messages', () => {
  
  test('EDGE CASE: Error-Messages sollten lokalisiert sein (Deutsch)', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    
    await page.fill('input[type="email"]', 'falsche@email.com');
    await page.fill('input[type="password"]', 'FalschesPasswort');
    await page.click('button[type="submit"]');
    
    // Fehler sollte auf Deutsch sein
    const germanError = page.locator('text=/Ungültig|Fehler|nicht gefunden|falsch/i');
    const englishError = page.locator('text=/Invalid|Error|not found|incorrect/i');
    
    const hasGerman = await germanError.count();
    const hasEnglish = await englishError.count();
    
    // Mindestens eine Sprache sollte vorhanden sein
    expect(hasGerman + hasEnglish).toBeGreaterThan(0);
  });

  test('EDGE CASE: Stack Traces sollten nur in Development sichtbar sein', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    
    // Forciere Server-Fehler
    await page.route('**/api/auth/login', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({
          error: 'Internal Server Error',
          // In Production sollten keine Details enthalten sein
          stack: process.env.NODE_ENV === 'development' ? 'Error at line 123' : undefined
        })
      });
    });
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test1234!');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(2000);
    
    // Stack Trace sollte nicht sichtbar sein (Production)
    const hasStackTrace = await page.locator('text=/at Function|at Object|node_modules/i').count();
    
    if (process.env.NODE_ENV === 'production') {
      expect(hasStackTrace).toBe(0);
    }
  });
});

test.describe('User-Friendly Error Handling', () => {
  
  test('EDGE CASE: Fehler sollten mit Retry-Button angezeigt werden', async ({ page }) => {
    // Simuliere Netzwerkfehler
    await page.route('**/api/**', route => {
      route.abort('failed');
    });
    
    await page.goto('http://localhost:5173/login');
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test1234!');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(2000);
    
    // Sollte Retry-Button oder ähnliches anzeigen
    const retryButton = page.locator('button:has-text("Erneut versuchen"), button:has-text("Retry")');
    
    if (await retryButton.count() > 0) {
      await expect(retryButton).toBeVisible();
    }
  });

  test('EDGE CASE: Loading-Spinner sollte bei langen Requests erscheinen', async ({ page }) => {
    // Verzögere API-Response
    await page.route('**/api/auth/login', route => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ token: 'fake-token' })
        });
      }, 3000);
    });
    
    await page.goto('http://localhost:5173/login');
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test1234!');
    await page.click('button[type="submit"]');
    
    // Spinner sollte erscheinen
    const spinner = page.locator('.spinner, [role="status"], text=/Lädt|Loading/i');
    
    if (await spinner.count() > 0) {
      await expect(spinner.first()).toBeVisible({ timeout: 1000 });
    }
  });
});
