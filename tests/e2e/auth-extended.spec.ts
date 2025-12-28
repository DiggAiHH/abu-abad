/**
 * Erweiterte Authentication-Tests mit Screenshot-Dokumentation
 * =============================================================
 * 
 * Evidenz-Basis:
 *   - OWASP ASVS 4.0: Authentication Verification Standard
 *     https://owasp.org/www-project-application-security-verification-standard/
 *   - NIST SP 800-63B: Digital Identity Guidelines (Authentication)
 *     https://doi.org/10.6028/NIST.SP.800-63b
 *   - DSGVO Art. 32: Sicherheit der Verarbeitung
 * 
 * Abrufdatum: 2025-12-28
 * 
 * Test-Abdeckung:
 *   1. Registrierung (Therapist + Patient)
 *   2. Login (Erfolg + Fehler-Cases)
 *   3. JWT Token Handling
 *   4. Refresh Token Flow
 *   5. Logout
 *   6. Session Management
 *   7. Password Security
 */

import { test, expect, Page } from '@playwright/test';
import { generateRandomEmail, takeScreenshot } from './helpers';

// Test-Konfiguration
test.use({
  viewport: { width: 1920, height: 1080 },
  screenshot: 'on',  // Screenshots bei jedem Fehler
  video: 'retain-on-failure',
});

/**
 * Hilfsfunktion: Wartet auf API-Response und macht Screenshot
 */
async function waitForApiAndScreenshot(
  page: Page, 
  apiPath: string, 
  screenshotName: string
): Promise<void> {
  await page.waitForResponse(response => 
    response.url().includes(apiPath) && response.status() < 400
  );
  await page.waitForTimeout(500);  // UI-Update abwarten
  await takeScreenshot(page, screenshotName);
}

test.describe('Authentication - Vollständige User Journey', () => {
  
  test('F1.1: Therapeut-Registrierung mit vollständiger Validierung', async ({ page }) => {
    /**
     * Evidenz: OWASP ASVS V2.1.1 - Password-Based Authentication
     * Testet: Email-Validierung, Password-Stärke, DSGVO-Consent
     */
    
    await page.goto('http://localhost:5173/register');
    await takeScreenshot(page, 'auth-01-register-page-initial');
    
    const testEmail = generateRandomEmail();
    const testPassword = 'SecurePass123!@#';  // NIST SP 800-63B: Min. 8 Zeichen
    
    // Schritt 1: Rolle auswählen
    await page.click('[data-testid="role-therapist"]');
    await takeScreenshot(page, 'auth-02-register-role-selected');
    
    // Schritt 2: Persönliche Daten
    await page.fill('[data-testid="input-email"]', testEmail);
    await page.fill('[data-testid="input-password"]', testPassword);
    await page.fill('[data-testid="input-password-confirm"]', testPassword);
    await page.fill('[data-testid="input-first-name"]', 'Dr. Max');
    await page.fill('[data-testid="input-last-name"]', 'Mustermann');
    await takeScreenshot(page, 'auth-03-register-personal-data-filled');
    
    // Schritt 3: Therapeuten-spezifische Daten
    await page.fill('[data-testid="input-license-number"]', 'DE-PSY-12345');
    await page.fill('[data-testid="input-specialization"]', 'Verhaltenstherapie');
    await page.fill('[data-testid="input-hourly-rate"]', '120');
    await takeScreenshot(page, 'auth-04-register-therapist-data-filled');
    
    // Schritt 4: DSGVO-Consent (PFLICHT nach Art. 7 DSGVO)
    await page.check('[data-testid="checkbox-gdpr-consent"]');
    await page.check('[data-testid="checkbox-terms-conditions"]');
    await takeScreenshot(page, 'auth-05-register-consent-given');
    
    // Schritt 5: Absenden
    await page.click('[data-testid="button-register"]');
    await waitForApiAndScreenshot(page, '/api/auth/register', 'auth-06-register-success');
    
    // Validierung: Erfolgs-Meldung
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('erfolgreich registriert');
    
    // Validierung: Redirect zu Login
    await page.waitForURL('**/login');
    await takeScreenshot(page, 'auth-07-redirect-to-login');
  });
  
  test('F1.2: Patient-Registrierung mit vereinfachtem Flow', async ({ page }) => {
    /**
     * Evidenz: DSGVO Art. 5 (1) c - Datenminimierung
     * Patienten brauchen keine Lizenz-Nummer
     */
    
    await page.goto('http://localhost:5173/register');
    
    const testEmail = generateRandomEmail();
    const testPassword = 'PatientPass123!';
    
    await page.click('[data-testid="role-patient"]');
    await takeScreenshot(page, 'auth-08-register-patient-role');
    
    await page.fill('[data-testid="input-email"]', testEmail);
    await page.fill('[data-testid="input-password"]', testPassword);
    await page.fill('[data-testid="input-password-confirm"]', testPassword);
    await page.fill('[data-testid="input-first-name"]', 'Anna');
    await page.fill('[data-testid="input-last-name"]', 'Schmidt');
    
    // Patienten-spezifisch: Geburtsdatum (für Altersverifikation)
    await page.fill('[data-testid="input-date-of-birth"]', '1990-05-15');
    await takeScreenshot(page, 'auth-09-register-patient-data');
    
    await page.check('[data-testid="checkbox-gdpr-consent"]');
    await page.check('[data-testid="checkbox-terms-conditions"]');
    
    await page.click('[data-testid="button-register"]');
    await waitForApiAndScreenshot(page, '/api/auth/register', 'auth-10-register-patient-success');
    
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });
  
  test('F1.3: Login mit korrekten Credentials', async ({ page }) => {
    /**
     * Evidenz: NIST SP 800-63B Section 5.1.1 - Memorized Secrets
     * Testet: Erfolgreicher Login, JWT Token Erhalt, Redirect zu Dashboard
     */
    
    // Setup: Registriere Test-User
    const testEmail = generateRandomEmail();
    const testPassword = 'TestPass123!';
    
    await page.goto('http://localhost:5173/register');
    await page.click('[data-testid="role-therapist"]');
    await page.fill('[data-testid="input-email"]', testEmail);
    await page.fill('[data-testid="input-password"]', testPassword);
    await page.fill('[data-testid="input-password-confirm"]', testPassword);
    await page.fill('[data-testid="input-first-name"]', 'Login');
    await page.fill('[data-testid="input-last-name"]', 'Test');
    await page.check('[data-testid="checkbox-gdpr-consent"]');
    await page.click('[data-testid="button-register"]');
    
    await page.waitForURL('**/login');
    await takeScreenshot(page, 'auth-11-login-page-initial');
    
    // Login
    await page.fill('[data-testid="input-login-email"]', testEmail);
    await page.fill('[data-testid="input-login-password"]', testPassword);
    await takeScreenshot(page, 'auth-12-login-credentials-filled');
    
    // Capture JWT Token aus Response
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/auth/login') && response.status() === 200
    );
    
    await page.click('[data-testid="button-login"]');
    
    const response = await responsePromise;
    const responseData = await response.json();
    
    // Validierung: JWT Token vorhanden
    expect(responseData.accessToken).toBeTruthy();
    expect(responseData.refreshToken).toBeTruthy();
    expect(responseData.user.email).toBe(testEmail);
    expect(responseData.user.role).toBe('therapist');
    
    await takeScreenshot(page, 'auth-13-login-success');
    
    // Validierung: Redirect zu Dashboard
    await page.waitForURL('**/dashboard/therapist');
    await takeScreenshot(page, 'auth-14-therapist-dashboard');
    
    // Validierung: User-Info im Header sichtbar
    await expect(page.locator('[data-testid="user-name"]')).toContainText('Login Test');
  });
  
  test('F1.4: Login mit falschen Credentials - Brute-Force Protection', async ({ page }) => {
    /**
     * Evidenz: OWASP ASVS V2.2.1 - Anti-Automation
     * Testet: Fehlermeldungen, Rate Limiting nach 5 Versuchen
     */
    
    await page.goto('http://localhost:5173/login');
    
    const fakeEmail = 'notexist@example.com';
    const fakePassword = 'WrongPassword123!';
    
    // Versuch 1-3: Normale Fehlermeldung
    for (let i = 1; i <= 3; i++) {
      await page.fill('[data-testid="input-login-email"]', fakeEmail);
      await page.fill('[data-testid="input-login-password"]', fakePassword);
      await page.click('[data-testid="button-login"]');
      
      await page.waitForResponse(response => 
        response.url().includes('/api/auth/login') && response.status() === 401
      );
      
      await takeScreenshot(page, `auth-15-login-failed-attempt-${i}`);
      
      // Validierung: Generische Fehlermeldung (kein "Email nicht gefunden" - Security Best Practice)
      await expect(page.locator('[data-testid="toast-error"]')).toContainText('Ungültige Anmeldedaten');
      
      await page.waitForTimeout(500);
    }
    
    // Versuch 4-5: Rate Limit Warnung
    for (let i = 4; i <= 5; i++) {
      await page.fill('[data-testid="input-login-email"]', fakeEmail);
      await page.fill('[data-testid="input-login-password"]', fakePassword);
      await page.click('[data-testid="button-login"]');
      
      if (i === 5) {
        // Nach 5 Versuchen: Rate Limit aktiv (OWASP ASVS V2.2.2)
        await page.waitForResponse(response => 
          response.url().includes('/api/auth/login') && response.status() === 429
        );
        
        await takeScreenshot(page, 'auth-16-login-rate-limited');
        
        await expect(page.locator('[data-testid="toast-error"]')).toContainText('Zu viele Anfragen');
      }
    }
  });
  
  test('F1.5: JWT Token Refresh Flow', async ({ page }) => {
    /**
     * Evidenz: RFC 6749 Section 6 - Refreshing an Access Token
     * Testet: Access Token läuft ab (15min), Refresh Token erneuert automatisch
     */
    
    // Login
    const testEmail = generateRandomEmail();
    await registerAndLogin(page, testEmail, 'TokenTest123!', 'therapist');
    
    // Warte auf Dashboard
    await page.waitForURL('**/dashboard/therapist');
    await takeScreenshot(page, 'auth-17-dashboard-after-login');
    
    // Simuliere abgelaufenen Access Token (via Browser DevTools)
    await page.evaluate(() => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid';
      localStorage.setItem('accessToken', expiredToken);
    });
    
    // Mache API-Request (sollte automatisch refreshen)
    await page.goto('http://localhost:5173/dashboard/therapist/appointments');
    
    // Capture Refresh-Request
    const refreshResponse = await page.waitForResponse(response => 
      response.url().includes('/api/auth/refresh') && response.status() === 200
    );
    
    const refreshData = await refreshResponse.json();
    expect(refreshData.accessToken).toBeTruthy();
    
    await takeScreenshot(page, 'auth-18-token-refreshed-successfully');
    
    // Validierung: Seite lädt normal (kein Logout)
    await expect(page.locator('[data-testid="appointments-list"]')).toBeVisible();
  });
  
  test('F1.6: Logout - Session Cleanup', async ({ page }) => {
    /**
     * Evidenz: OWASP Session Management Cheat Sheet
     * Testet: Tokens werden gelöscht, Refresh Token revoked, Redirect zu Login
     */
    
    // Login
    const testEmail = generateRandomEmail();
    await registerAndLogin(page, testEmail, 'LogoutTest123!', 'patient');
    
    await page.waitForURL('**/dashboard/patient');
    await takeScreenshot(page, 'auth-19-dashboard-before-logout');
    
    // Logout
    await page.click('[data-testid="button-logout"]');
    
    await page.waitForResponse(response => 
      response.url().includes('/api/auth/logout') && response.status() === 200
    );
    
    await takeScreenshot(page, 'auth-20-logout-success');
    
    // Validierung: Redirect zu Login
    await page.waitForURL('**/login');
    
    // Validierung: Tokens aus localStorage entfernt
    const tokensRemoved = await page.evaluate(() => {
      return !localStorage.getItem('accessToken') && !localStorage.getItem('refreshToken');
    });
    expect(tokensRemoved).toBe(true);
    
    // Validierung: Geschützte Routen nicht mehr zugänglich
    await page.goto('http://localhost:5173/dashboard/patient');
    await page.waitForURL('**/login');  // Sollte redirecten
    await takeScreenshot(page, 'auth-21-protected-route-blocked');
  });
  
  test('F1.7: Password Strength Validation', async ({ page }) => {
    /**
     * Evidenz: NIST SP 800-63B Section 5.1.1.2 - Memorized Secret Verifiers
     * Testet: Min. 8 Zeichen, Groß/Klein, Zahlen, Sonderzeichen
     */
    
    await page.goto('http://localhost:5173/register');
    await page.click('[data-testid="role-patient"]');
    
    const weakPasswords = [
      { pwd: '123456', reason: 'Zu kurz (< 8 Zeichen)' },
      { pwd: 'password', reason: 'Keine Zahlen/Sonderzeichen' },
      { pwd: 'Password', reason: 'Keine Zahlen' },
      { pwd: 'Password1', reason: 'Keine Sonderzeichen' },
    ];
    
    for (let i = 0; i < weakPasswords.length; i++) {
      const { pwd, reason } = weakPasswords[i];
      
      await page.fill('[data-testid="input-email"]', generateRandomEmail());
      await page.fill('[data-testid="input-password"]', pwd);
      await page.fill('[data-testid="input-password-confirm"]', pwd);
      await page.fill('[data-testid="input-first-name"]', 'Test');
      await page.fill('[data-testid="input-last-name"]', 'User');
      
      // Blur-Event auslösen für Live-Validierung
      await page.locator('[data-testid="input-password"]').blur();
      
      await takeScreenshot(page, `auth-22-weak-password-${i + 1}`);
      
      // Validierung: Fehler-Nachricht sichtbar
      await expect(page.locator('[data-testid="password-strength-error"]')).toContainText(reason);
    }
    
    // Starkes Passwort testen
    await page.fill('[data-testid="input-password"]', 'StrongP@ss123!');
    await page.locator('[data-testid="input-password"]').blur();
    await takeScreenshot(page, 'auth-23-strong-password');
    
    await expect(page.locator('[data-testid="password-strength-indicator"]')).toContainText('Stark');
  });
  
  test('F1.8: Email Verification Flow', async ({ page }) => {
    /**
     * Evidenz: OWASP ASVS V2.1.12 - Email Verification
     * Testet: Verification-Email gesendet, Token-Validierung, Account-Aktivierung
     */
    
    const testEmail = generateRandomEmail();
    await registerAndLogin(page, testEmail, 'VerifyTest123!', 'therapist');
    
    await page.waitForURL('**/dashboard/therapist');
    
    // Banner: Email-Verifizierung ausstehend
    await expect(page.locator('[data-testid="email-verification-banner"]')).toBeVisible();
    await takeScreenshot(page, 'auth-24-email-verification-pending');
    
    // Klick auf "Email erneut senden"
    await page.click('[data-testid="button-resend-verification"]');
    
    await page.waitForResponse(response => 
      response.url().includes('/api/auth/resend-verification') && response.status() === 200
    );
    
    await takeScreenshot(page, 'auth-25-verification-email-sent');
    
    // Simuliere Klick auf Verification-Link (in Realität aus Email)
    // Token würde normalerweise per Email kommen
    const mockToken = 'mock-verification-token-12345';
    
    await page.goto(`http://localhost:5173/verify-email?token=${mockToken}`);
    
    await page.waitForResponse(response => 
      response.url().includes('/api/auth/verify-email') && response.status() === 200
    );
    
    await takeScreenshot(page, 'auth-26-email-verified-success');
    
    // Validierung: Banner verschwindet
    await page.goto('http://localhost:5173/dashboard/therapist');
    await expect(page.locator('[data-testid="email-verification-banner"]')).not.toBeVisible();
  });
});

/**
 * Hilfsfunktion: Registriere und logge User ein
 */
async function registerAndLogin(
  page: Page, 
  email: string, 
  password: string, 
  role: 'therapist' | 'patient'
): Promise<void> {
  await page.goto('http://localhost:5173/register');
  await page.click(`[data-testid="role-${role}"]`);
  await page.fill('[data-testid="input-email"]', email);
  await page.fill('[data-testid="input-password"]', password);
  await page.fill('[data-testid="input-password-confirm"]', password);
  await page.fill('[data-testid="input-first-name"]', 'Test');
  await page.fill('[data-testid="input-last-name"]', 'User');
  
  if (role === 'therapist') {
    await page.fill('[data-testid="input-license-number"]', 'TEST-LIC-001');
  }
  
  await page.check('[data-testid="checkbox-gdpr-consent"]');
  await page.click('[data-testid="button-register"]');
  
  await page.waitForURL('**/login');
  
  await page.fill('[data-testid="input-login-email"]', email);
  await page.fill('[data-testid="input-login-password"]', password);
  await page.click('[data-testid="button-login"]');
}
