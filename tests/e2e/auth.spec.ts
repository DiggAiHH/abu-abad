import { test, expect } from '@playwright/test';
import { registerUser, loginUser, TEST_USERS, generateRandomEmail } from '../helpers';

/**
 * E2E Tests: Authentifizierung & Autorisierung
 * 
 * Edge Cases:
 * - Schwache Passwörter
 * - Rate Limiting
 * - Token-Expiration
 * - Fehlende DSGVO-Einwilligung
 * - Rollenbasierte Zugriffskontrolle
 */

test.describe('Authentifizierung', () => {
  
  test('EDGE CASE: Registrierung mit schwachem Passwort sollte fehlschlagen', async ({ page }) => {
    await page.goto('/register');
    
    await page.fill('input[type="email"]', generateRandomEmail());
    await page.fill('input[placeholder*="Vorname"]', 'Test');
    await page.fill('input[placeholder*="Nachname"]', 'User');
    
    // Schwaches Passwort (nur Kleinbuchstaben)
    await page.fill('input[type="password"]:not([placeholder*="best"])', 'password');
    await page.fill('input[placeholder*="best"]', 'password');
    
    await page.check('input[value="patient"]');
    await page.check('input[type="checkbox"]');
    
    await page.click('button[type="submit"]');
    
    // Sollte Fehler anzeigen
    await expect(page.locator('text=/Passwort muss/i')).toBeVisible({ timeout: 3000 });
  });

  test('EDGE CASE: Registrierung ohne DSGVO-Einwilligung sollte fehlschlagen', async ({ page }) => {
    await page.goto('/register');
    
    await page.fill('input[type="email"]', generateRandomEmail());
    await page.fill('input[placeholder*="Vorname"]', 'Test');
    await page.fill('input[placeholder*="Nachname"]', 'User');
    await page.fill('input[type="password"]:not([placeholder*="best"])', 'Test1234!');
    await page.fill('input[placeholder*="best"]', 'Test1234!');
    await page.check('input[value="patient"]');
    
    // DSGVO-Checkbox NICHT aktivieren
    
    await page.click('button[type="submit"]');
    
    // Sollte nicht zum Dashboard weiterleiten
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/register');
  });

  test('EDGE CASE: Login mit falschen Credentials sollte Rate-Limiting auslösen', async ({ page }) => {
    await page.goto('/login');
    
    const wrongPassword = 'WrongPass123!';
    
    // 6 fehlgeschlagene Versuche (Rate Limit: 5)
    for (let i = 0; i < 6; i++) {
      await page.fill('input[type="email"]', 'nonexistent@example.com');
      await page.fill('input[type="password"]', wrongPassword);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    }
    
    // Nach 6 Versuchen sollte Rate Limiting greifen
    await expect(page.locator('text=/Zu viele.*Versuche/i')).toBeVisible({ timeout: 3000 });
  });

  test('EDGE CASE: Passwörter müssen übereinstimmen', async ({ page }) => {
    await page.goto('/register');
    
    await page.fill('input[type="email"]', generateRandomEmail());
    await page.fill('input[placeholder*="Vorname"]', 'Test');
    await page.fill('input[placeholder*="Nachname"]', 'User');
    
    // Unterschiedliche Passwörter
    await page.fill('input[type="password"]:not([placeholder*="best"])', 'Test1234!');
    await page.fill('input[placeholder*="best"]', 'Different5678!');
    
    await page.check('input[value="patient"]');
    await page.check('input[type="checkbox"]');
    
    await page.click('button[type="submit"]');
    
    // Fehler anzeigen
    await expect(page.locator('text=/Passwörter.*nicht.*überein/i')).toBeVisible({ timeout: 3000 });
  });

  test('EDGE CASE: Email-Format-Validierung', async ({ page }) => {
    await page.goto('/register');
    
    // Ungültige Email
    await page.fill('input[type="email"]', 'invalid-email-format');
    await page.fill('input[placeholder*="Vorname"]', 'Test');
    await page.fill('input[placeholder*="Nachname"]', 'User');
    await page.fill('input[type="password"]:not([placeholder*="best"])', 'Test1234!');
    await page.fill('input[placeholder*="best"]', 'Test1234!');
    
    await page.check('input[value="patient"]');
    await page.check('input[type="checkbox"]');
    
    await page.click('button[type="submit"]');
    
    // Browser-native Validierung oder Custom-Error
    const isInvalid = await page.locator('input[type="email"]:invalid').count() > 0;
    expect(isInvalid).toBe(true);
  });

  test('EDGE CASE: Doppelte Email-Registrierung sollte fehlschlagen', async ({ page }) => {
    const email = generateRandomEmail();
    
    // Erste Registrierung
    await page.goto('/register');
    await page.fill('input[type="email"]', email);
    await page.fill('input[placeholder*="Vorname"]', 'Test');
    await page.fill('input[placeholder*="Nachname"]', 'User');
    await page.fill('input[type="password"]:not([placeholder*="best"])', 'Test1234!');
    await page.fill('input[placeholder*="best"]', 'Test1234!');
    await page.check('input[value="patient"]');
    await page.check('input[type="checkbox"]');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    
    // Logout
    await page.click('button:has-text("Abmelden")');
    await page.waitForURL('**/login');
    
    // Zweite Registrierung mit gleicher Email
    await page.goto('/register');
    await page.fill('input[type="email"]', email);
    await page.fill('input[placeholder*="Vorname"]', 'Test2');
    await page.fill('input[placeholder*="Nachname"]', 'User2');
    await page.fill('input[type="password"]:not([placeholder*="best"])', 'Test5678!');
    await page.fill('input[placeholder*="best"]', 'Test5678!');
    await page.check('input[value="patient"]');
    await page.check('input[type="checkbox"]');
    await page.click('button[type="submit"]');
    
    // Sollte Fehler anzeigen
    await expect(page.locator('text=/existiert bereits|already exists/i')).toBeVisible({ timeout: 3000 });
  });

  test('Happy Path: Erfolgreiche Registrierung und Login', async ({ page }) => {
    const email = generateRandomEmail();
    
    await page.goto('/register');
    await page.fill('input[type="email"]', email);
    await page.fill('input[placeholder*="Vorname"]', 'Test');
    await page.fill('input[placeholder*="Nachname"]', 'User');
    await page.fill('input[type="password"]:not([placeholder*="best"])', 'Test1234!');
    await page.fill('input[placeholder*="best"]', 'Test1234!');
    await page.check('input[value="patient"]');
    await page.check('input[type="checkbox"]');
    await page.click('button[type="submit"]');
    
    // Sollte zum Dashboard weiterleiten
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
    
    // Logout
    await page.click('button:has-text("Abmelden")');
    await expect(page).toHaveURL(/\/login/);
    
    // Re-login
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Test1234!');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Autorisierung', () => {
  
  test('EDGE CASE: Patient sollte nicht auf Therapeuten-Endpunkte zugreifen können', async ({ page, request }) => {
    // Registriere Patient
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email });
    
    // Versuche Therapeuten-Endpunkt aufzurufen
    const createSlotButton = page.locator('button:has-text("Slot erstellen")');
    
    // Sollte nicht existieren
    await expect(createSlotButton).not.toBeVisible();
  });

  test('EDGE CASE: Nicht-authentifizierte User sollten auf Login umgeleitet werden', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Sollte auf Login-Seite umleiten
    await expect(page).toHaveURL(/\/login/, { timeout: 3000 });
  });

  test('EDGE CASE: Abgelaufene Session sollte Logout erzwingen', async ({ page, context }) => {
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email });
    
    // Lösche Token aus LocalStorage
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    
    // Versuche Dashboard zu laden
    await page.goto('/dashboard');
    
    // Sollte auf Login umleiten
    await expect(page).toHaveURL(/\/login/, { timeout: 3000 });
  });
});
