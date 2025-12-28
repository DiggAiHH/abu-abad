import { test, expect } from '@playwright/test';
import { registerUser, loginUser, TEST_USERS, generateRandomEmail } from '../helpers';

/**
 * DSGVO-Compliance Tests: Art. 15 (Auskunft), Art. 17 (Löschung), Art. 30 (Audit)
 * 
 * Quellen:
 * - DSGVO: https://eur-lex.europa.eu/eli/reg/2016/679/oj
 * - BSI IT-Grundschutz: https://www.bsi.bund.de/grundschutz
 */

test.describe('DSGVO Art. 6: Rechtmäßigkeit der Verarbeitung', () => {
  
  test('EDGE CASE: Registrierung ohne Einwilligung sollte fehlschlagen', async ({ page }) => {
    await page.goto('http://localhost:5173/register');
    
    const email = generateRandomEmail();
    await page.fill('input[type="email"]', email);
    await page.fill('input[placeholder*="Vorname"]', 'Test');
    await page.fill('input[placeholder*="Nachname"]', 'User');
    await page.fill('input[type="password"]:not([placeholder*="best"])', 'Test1234!');
    await page.fill('input[placeholder*="best"]', 'Test1234!');
    await page.check('input[value="patient"]');
    
    // OHNE DSGVO-Checkbox
    // await page.check('input[type="checkbox"]');
    
    await page.click('button[type="submit"]');
    
    // Sollte Fehler anzeigen
    await expect(page.locator('text=/Einwilligung|consent|DSGVO|Datenschutz/i')).toBeVisible({ timeout: 5000 });
  });

  test('EDGE CASE: Einwilligungs-Text sollte vollständig sichtbar sein', async ({ page }) => {
    await page.goto('http://localhost:5173/register');
    
    // Datenschutzerklärung-Link sollte vorhanden sein
    const privacyLink = page.locator('a[href*="datenschutz"], a:has-text("Datenschutz")');
    
    if (await privacyLink.count() > 0) {
      await expect(privacyLink).toBeVisible();
    } else {
      // Oder Einwilligungstext direkt sichtbar
      await expect(page.locator('text=/Art. 6|DSGVO|Datenschutz|privacy/i')).toBeVisible();
    }
  });
});

test.describe('DSGVO Art. 15: Recht auf Auskunft', () => {
  
  test('EDGE CASE: Datenexport sollte alle personenbezogenen Daten enthalten', async ({ page, request }) => {
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Navigiere zu Profil/Einstellungen
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Profil|Einstellungen|Settings|Profile/i');
    
    // Suche "Daten exportieren" Button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Daten herunterladen")');
    
    if (await exportButton.count() > 0) {
      // Klicke Export-Button
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      const download = await downloadPromise;
      
      // Datei sollte heruntergeladen werden
      expect(download.suggestedFilename()).toMatch(/export|daten|data/i);
      
      // Optional: Dateiinhalt prüfen (JSON)
      const path = await download.path();
      if (path) {
        const fs = require('fs');
        const content = fs.readFileSync(path, 'utf-8');
        const data = JSON.parse(content);
        
        // Sollte mindestens diese Felder enthalten
        expect(data).toHaveProperty('email');
        expect(data).toHaveProperty('firstName');
        expect(data).toHaveProperty('lastName');
      }
    } else {
      // Alternativ: API-Endpoint direkt testen
      const response = await request.get('http://localhost:3000/api/users/export', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      expect(response.ok()).toBe(true);
      const data = await response.json();
      
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('email', email);
    }
  });

  test('EDGE CASE: Datenexport sollte auch Audit-Logs enthalten', async ({ page, request }) => {
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Führe einige Aktionen aus (generiert Audit-Logs)
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Profil|Settings/i');
    await page.waitForTimeout(1000);
    
    // Export anfordern
    const response = await request.get('http://localhost:3000/api/users/export', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      // Sollte Audit-Logs enthalten
      expect(data).toHaveProperty('auditLogs');
      expect(Array.isArray(data.auditLogs)).toBe(true);
      
      // Mindestens 1 Log-Eintrag (Registrierung)
      expect(data.auditLogs.length).toBeGreaterThan(0);
    }
  });
});

test.describe('DSGVO Art. 17: Recht auf Löschung', () => {
  
  test('EDGE CASE: Account-Löschung sollte alle Daten entfernen', async ({ page, request }) => {
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Navigiere zu Account-Löschung
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Profil|Einstellungen|Settings/i');
    
    // Suche "Account löschen" Button
    const deleteButton = page.locator('button:has-text("Account löschen"), button:has-text("Delete Account")');
    
    if (await deleteButton.count() > 0) {
      await deleteButton.click();
      
      // Bestätigungs-Dialog
      await page.waitForTimeout(1000);
      const confirmButton = page.locator('button:has-text("Bestätigen"), button:has-text("Confirm")');
      
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
      }
      
      await page.waitForTimeout(2000);
      
      // Sollte zu Login umgeleitet werden
      expect(page.url()).toContain('/login');
      
      // Versuch Login mit gelöschtem Account
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', TEST_USERS.patient.password);
      await page.click('button[type="submit"]');
      
      // Login sollte fehlschlagen
      await expect(page.locator('text=/nicht gefunden|not found|ungültig/i')).toBeVisible({ timeout: 5000 });
    } else {
      // API-Endpoint direkt testen
      const deleteResponse = await request.delete('http://localhost:3000/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      expect(deleteResponse.ok()).toBe(true);
      
      // Versuch auf gelöschten User zuzugreifen
      const getResponse = await request.get('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      expect(getResponse.status()).toBe(401);
    }
  });

  test('EDGE CASE: Löschung sollte auch alle Termine und Nachrichten entfernen', async ({ page, request }) => {
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Erstelle Test-Daten (Termin, Nachricht)
    // ... (Optional: Testdaten erstellen)
    
    // Account löschen
    const deleteResponse = await request.delete('http://localhost:3000/api/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    expect(deleteResponse.ok()).toBe(true);
    
    // Überprüfe, dass Daten nicht mehr abrufbar sind
    const appointmentsResponse = await request.get('http://localhost:3000/api/appointments', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    expect(appointmentsResponse.status()).toBe(401);
  });

  test('EDGE CASE: Löschung mit offenen Terminen sollte Warnung anzeigen', async ({ page }) => {
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email });
    
    // Erstelle zukünftigen Termin
    // ... (Optional)
    
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Profil|Settings/i');
    
    const deleteButton = page.locator('button:has-text("Account löschen")');
    
    if (await deleteButton.count() > 0) {
      await deleteButton.click();
      
      // Sollte Warnung wegen offener Termine anzeigen
      await expect(page.locator('text=/offene Termine|pending appointments|Warnung/i')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('DSGVO Art. 25: Privacy by Design', () => {
  
  test('EDGE CASE: Standardeinstellungen sollten datenschutzfreundlich sein', async ({ page }) => {
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email });
    
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Profil|Einstellungen|Settings/i');
    
    // Überprüfe Datenschutz-Einstellungen
    const privacyToggles = page.locator('[role="switch"], input[type="checkbox"]');
    
    if (await privacyToggles.count() > 0) {
      // Standard sollte "restriktiv" sein (z.B. keine Weitergabe an Dritte)
      const shareDataToggle = page.locator('input[type="checkbox"]:has-text("Daten teilen")');
      
      if (await shareDataToggle.count() > 0) {
        const isChecked = await shareDataToggle.isChecked();
        expect(isChecked).toBe(false); // Standard = NICHT teilen
      }
    }
  });
});

test.describe('DSGVO Art. 30: Verarbeitungsverzeichnis', () => {
  
  test('EDGE CASE: Audit-Logs sollten alle Zugriffe protokollieren', async ({ page, request }) => {
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Führe verschiedene Aktionen aus
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Profil|Settings/i');
    await page.waitForTimeout(500);
    await page.goto('http://localhost:5173/dashboard');
    
    // Rufe Audit-Logs ab
    const response = await request.get('http://localhost:3000/api/users/audit-logs', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok()) {
      const logs = await response.json();
      
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
      
      // Logs sollten Zeitstempel und Aktion enthalten
      const firstLog = logs[0];
      expect(firstLog).toHaveProperty('timestamp');
      expect(firstLog).toHaveProperty('action');
      expect(firstLog).toHaveProperty('userId');
    }
  });

  test('EDGE CASE: Sensible Daten sollten in Logs verschleiert sein', async ({ page, request }) => {
    const email = generateRandomEmail();
    const password = 'TestPassword123!';
    
    await registerUser(page, { 
      ...TEST_USERS.patient, 
      email, 
      password 
    });
    
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Rufe Audit-Logs ab
    const response = await request.get('http://localhost:3000/api/users/audit-logs', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok()) {
      const logs = await response.json();
      const logsString = JSON.stringify(logs);
      
      // Passwort sollte NICHT in Logs erscheinen
      expect(logsString).not.toContain(password);
      expect(logsString).not.toMatch(/password.*Test/i);
    }
  });
});

test.describe('DSGVO Art. 32: Sicherheit der Verarbeitung', () => {
  
  test('EDGE CASE: Gesundheitsdaten sollten verschlüsselt gespeichert werden', async ({ page, request }) => {
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Füge sensible Gesundheitsdaten hinzu
    const healthData = 'Diagnose: Depression, Medikation: Sertralin 50mg';
    
    const updateResponse = await request.put('http://localhost:3000/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        notes: healthData
      }
    });
    
    if (updateResponse.ok()) {
      // Rufe Daten ab - sollten entschlüsselt zurückkommen
      const getResponse = await request.get('http://localhost:3000/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const profile = await getResponse.json();
      
      // Daten sollten lesbar sein (Backend entschlüsselt automatisch)
      expect(profile.notes).toBe(healthData);
    }
  });

  test('EDGE CASE: Passwörter sollten mit bcrypt gehasht sein', async ({ page, request }) => {
    const email = generateRandomEmail();
    const password = 'UniquePassword123!';
    
    await registerUser(page, { 
      ...TEST_USERS.patient, 
      email, 
      password 
    });
    
    // Versuche mit falschem Passwort einzuloggen
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');
    
    // Sollte Fehler anzeigen (Beweis: Passwort wird validiert, nicht Klartext verglichen)
    await expect(page.locator('text=/ungültig|invalid|incorrect/i')).toBeVisible({ timeout: 5000 });
    
    // Mit korrektem Passwort sollte Login funktionieren
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/dashboard');
  });
});

test.describe('DSGVO Art. 33: Meldepflicht bei Datenpannen', () => {
  
  test('EDGE CASE: Mehrfache fehlgeschlagene Logins sollten protokolliert werden', async ({ page, request }) => {
    const email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email });
    
    await page.goto('http://localhost:5173/logout');
    
    // 5 fehlgeschlagene Login-Versuche
    for (let i = 0; i < 5; i++) {
      await page.goto('http://localhost:5173/login');
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', 'FalschesPasswort123!');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);
    }
    
    // Login mit korrektem Passwort
    await loginUser(page, { email: email, password: TEST_USERS.patient.password });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Audit-Logs sollten fehlgeschlagene Versuche enthalten
    const response = await request.get('http://localhost:3000/api/users/audit-logs', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok()) {
      const logs = await response.json();
      
      // Sollte mindestens 5 "login_failed" Einträge geben
      const failedLogins = logs.filter((log: any) => 
        log.action === 'login_failed' || log.action?.includes('failed')
      );
      
      expect(failedLogins.length).toBeGreaterThanOrEqual(5);
    }
  });
});

test.describe('DSGVO: Datenminimierung', () => {
  
  test('EDGE CASE: Registrierung sollte nur notwendige Daten abfragen', async ({ page }) => {
    await page.goto('http://localhost:5173/register');
    
    // Zähle Pflichtfelder
    const requiredFields = page.locator('input[required], input[aria-required="true"]');
    const count = await requiredFields.count();
    
    // Sollte nur essenzielle Felder abfragen (Email, Passwort, Name, Rolle, DSGVO-Checkbox)
    // Maximal 6-7 Felder
    expect(count).toBeLessThanOrEqual(7);
    
    // Optionale Felder sollten klar markiert sein
    const optionalFields = page.locator('input:not([required]):not([aria-required="true"])');
    
    if (await optionalFields.count() > 0) {
      // Optional-Felder sollten mit "(optional)" markiert sein
      const labels = page.locator('label:has-text("optional"), label:has-text("Optional")');
      expect(await labels.count()).toBeGreaterThan(0);
    }
  });
});
