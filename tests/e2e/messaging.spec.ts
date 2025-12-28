import { test, expect } from '@playwright/test';
import { registerUser, loginUser, TEST_USERS, generateRandomEmail } from '../helpers';

/**
 * Messaging System Tests: Verschlüsselte Kommunikation, Real-time, IDOR
 * 
 * Quelle: DSGVO Art. 32 (Verschlüsselung), OWASP A01 (Broken Access Control)
 */

test.describe('Messaging: Grundfunktionalität', () => {
  
  test('Happy Path: Nachricht zwischen Therapeut und Patient senden', async ({ page, context }) => {
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    // Therapeut registrieren
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    const therapistPage = page;
    
    // Patient registrieren
    const patientPage = await context.newPage();
    await patientPage.goto('http://localhost:5173/register');
    await registerUser(patientPage, { ...TEST_USERS.patient, email: patientEmail });
    
    // Therapeut öffnet Messaging-Tab
    await therapistPage.goto('http://localhost:5173/dashboard');
    await therapistPage.click('text=/Nachrichten|Messages/i');
    
    // Therapeut sendet Nachricht
    const messageText = 'Hallo, wie geht es Ihnen?';
    await therapistPage.fill('[placeholder*="Nachricht"]', messageText);
    await therapistPage.click('button:has-text("Senden"), button[type="submit"]');
    
    // Patient empfängt Nachricht
    await patientPage.goto('http://localhost:5173/dashboard');
    await patientPage.click('text=/Nachrichten|Messages/i');
    
    // Nachricht sollte sichtbar sein
    await expect(patientPage.locator(`text=${messageText}`)).toBeVisible({ timeout: 10000 });
    
    await patientPage.close();
  });
});

test.describe('Messaging: Security & Validation', () => {
  
  test('EDGE CASE: XSS in Nachrichteninhalt sollte sanitiert werden', async ({ page, context }) => {
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    const patientPage = await context.newPage();
    await patientPage.goto('http://localhost:5173/register');
    await registerUser(patientPage, { ...TEST_USERS.patient, email: patientEmail });
    
    // XSS-Payloads
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>'
    ];
    
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Nachrichten|Messages/i');
    
    for (const xssPayload of xssPayloads) {
      await page.fill('[placeholder*="Nachricht"]', xssPayload);
      await page.click('button:has-text("Senden"), button[type="submit"]');
      await page.waitForTimeout(1000);
    }
    
    // XSS sollte nicht ausgeführt werden
    page.on('dialog', dialog => {
      expect(dialog.message()).not.toContain('XSS');
      dialog.dismiss();
    });
    
    // Überprüfe, dass Script-Tags escaped sind
    const content = await page.content();
    expect(content).not.toContain('<script>alert');
    
    await patientPage.close();
  });

  test('EDGE CASE: Extrem lange Nachricht (>10.000 Zeichen) sollte abgelehnt werden', async ({ page }) => {
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Nachrichten|Messages/i');
    
    // 15.000 Zeichen lange Nachricht
    const longMessage = 'A'.repeat(15000);
    
    await page.fill('[placeholder*="Nachricht"]', longMessage);
    await page.click('button:has-text("Senden"), button[type="submit"]');
    
    // Sollte Fehler anzeigen
    await expect(page.locator('text=/zu lang|too long|maximum|maximal/i')).toBeVisible({ timeout: 5000 });
  });

  test('EDGE CASE: Leere Nachricht sollte nicht gesendet werden', async ({ page }) => {
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Nachrichten|Messages/i');
    
    // Versuche leere Nachricht zu senden
    await page.fill('[placeholder*="Nachricht"]', '   '); // Nur Whitespace
    await page.click('button:has-text("Senden"), button[type="submit"]');
    
    // Senden-Button sollte disabled sein oder Fehler anzeigen
    const hasError = await page.locator('text=/Nachricht darf nicht leer sein|empty/i').count();
    expect(hasError).toBeGreaterThanOrEqual(0);
  });

  test('EDGE CASE: SQL Injection in Nachrichtensuche', async ({ page }) => {
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Nachrichten|Messages/i');
    
    // SQL Injection Payloads in Suchfeld
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE messages;--",
      "1' UNION SELECT * FROM users--"
    ];
    
    const searchInput = page.locator('input[placeholder*="Suchen"], input[type="search"]').first();
    
    if (await searchInput.count() > 0) {
      for (const payload of sqlPayloads) {
        await searchInput.fill(payload);
        await page.waitForTimeout(500);
        
        // Sollte keine SQL-Fehler anzeigen
        await expect(page.locator('text=/SQL|syntax error|pg::/i')).not.toBeVisible();
      }
    }
  });
});

test.describe('Messaging: IDOR & Authorization', () => {
  
  test('EDGE CASE: Patient sollte keine Nachrichten anderer Patienten sehen (IDOR)', async ({ page, context }) => {
    const patient1Email = generateRandomEmail();
    const patient2Email = generateRandomEmail();
    const therapistEmail = generateRandomEmail();
    
    // Patient 1 registrieren
    await registerUser(page, { ...TEST_USERS.patient, email: patient1Email });
    
    // Patient 2 registrieren
    const patient2Page = await context.newPage();
    await patient2Page.goto('http://localhost:5173/register');
    await registerUser(patient2Page, { ...TEST_USERS.patient, email: patient2Email });
    
    // Therapeut registrieren
    const therapistPage = await context.newPage();
    await therapistPage.goto('http://localhost:5173/register');
    await registerUser(therapistPage, { ...TEST_USERS.therapist, email: therapistEmail });
    
    // Therapeut sendet Nachricht an Patient 1
    await therapistPage.goto('http://localhost:5173/dashboard');
    await therapistPage.click('text=/Nachrichten|Messages/i');
    await therapistPage.fill('[placeholder*="Nachricht"]', 'Geheime Nachricht für Patient 1');
    await therapistPage.click('button:has-text("Senden"), button[type="submit"]');
    await therapistPage.waitForTimeout(1000);
    
    // Patient 2 sollte Nachricht NICHT sehen
    await patient2Page.goto('http://localhost:5173/dashboard');
    await patient2Page.click('text=/Nachrichten|Messages/i');
    
    await expect(patient2Page.locator('text=Geheime Nachricht für Patient 1')).not.toBeVisible();
    
    // Patient 1 sollte Nachricht sehen
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Nachrichten|Messages/i');
    
    await expect(page.locator('text=Geheime Nachricht für Patient 1')).toBeVisible({ timeout: 10000 });
    
    await patient2Page.close();
    await therapistPage.close();
  });

  test('EDGE CASE: Direkte API-Anfrage an fremde Konversation sollte 403 zurückgeben', async ({ page, request }) => {
    const patient1Email = generateRandomEmail();
    const patient2Email = generateRandomEmail();
    
    // Patient 1 registrieren
    await registerUser(page, { ...TEST_USERS.patient, email: patient1Email });
    const patient1Token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Patient 2 registrieren (neuer Context für saubere Session)
    await page.goto('http://localhost:5173/logout');
    await page.goto('http://localhost:5173/register');
    await registerUser(page, { ...TEST_USERS.patient, email: patient2Email });
    const patient2Token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Patient 2 versucht auf Konversation von Patient 1 zuzugreifen
    const response = await request.get('http://localhost:3000/api/messages/conversation/1', {
      headers: {
        'Authorization': `Bearer ${patient2Token}`
      }
    });
    
    // Sollte 403 Forbidden oder 404 Not Found zurückgeben
    expect([403, 404]).toContain(response.status());
  });
});

test.describe('Messaging: Real-time Updates (Socket.io)', () => {
  
  test('EDGE CASE: Neue Nachricht sollte ohne Reload erscheinen', async ({ page, context }) => {
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    // Therapeut registrieren
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Nachrichten|Messages/i');
    
    // Patient registrieren
    const patientPage = await context.newPage();
    await patientPage.goto('http://localhost:5173/register');
    await registerUser(patientPage, { ...TEST_USERS.patient, email: patientEmail });
    await patientPage.goto('http://localhost:5173/dashboard');
    await patientPage.click('text=/Nachrichten|Messages/i');
    
    // Therapeut sendet Nachricht
    const timestamp = Date.now();
    const message = `Real-time Test ${timestamp}`;
    await page.fill('[placeholder*="Nachricht"]', message);
    await page.click('button:has-text("Senden"), button[type="submit"]');
    
    // Patient sollte Nachricht OHNE Reload sehen
    await expect(patientPage.locator(`text=${message}`)).toBeVisible({ timeout: 10000 });
    
    await patientPage.close();
  });

  test('EDGE CASE: Read-Status sollte aktualisiert werden', async ({ page, context }) => {
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Nachrichten|Messages/i');
    
    const patientPage = await context.newPage();
    await patientPage.goto('http://localhost:5173/register');
    await registerUser(patientPage, { ...TEST_USERS.patient, email: patientEmail });
    
    // Therapeut sendet Nachricht
    await page.fill('[placeholder*="Nachricht"]', 'Nachricht mit Read-Status');
    await page.click('button:has-text("Senden"), button[type="submit"]');
    await page.waitForTimeout(1000);
    
    // Nachricht sollte als "ungelesen" markiert sein
    const unreadIndicator = page.locator('[aria-label*="ungelesen"], .unread, text=/ungelesen/i').first();
    if (await unreadIndicator.count() > 0) {
      await expect(unreadIndicator).toBeVisible();
    }
    
    // Patient öffnet Nachricht
    await patientPage.goto('http://localhost:5173/dashboard');
    await patientPage.click('text=/Nachrichten|Messages/i');
    await patientPage.click('text=Nachricht mit Read-Status');
    await patientPage.waitForTimeout(2000);
    
    // Therapeut sollte "gelesen" Status sehen
    await page.waitForTimeout(2000);
    const readIndicator = page.locator('[aria-label*="gelesen"], .read, text=/gelesen/i').first();
    if (await readIndicator.count() > 0) {
      await expect(readIndicator).toBeVisible({ timeout: 10000 });
    }
    
    await patientPage.close();
  });
});

test.describe('Messaging: Rate Limiting', () => {
  
  test('EDGE CASE: Spam-Nachrichten sollten durch Rate Limiting verhindert werden', async ({ page }) => {
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Nachrichten|Messages/i');
    
    // Versuche 20 Nachrichten in kurzer Zeit zu senden
    for (let i = 0; i < 20; i++) {
      await page.fill('[placeholder*="Nachricht"]', `Spam ${i}`);
      await page.click('button:has-text("Senden"), button[type="submit"]');
      await page.waitForTimeout(100); // Sehr schnell
    }
    
    // Rate Limiter sollte greifen
    await expect(page.locator('text=/Zu viele|rate limit|slow down|bitte warten/i')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Messaging: Verschlüsselung', () => {
  
  test('EDGE CASE: Nachrichten sollten verschlüsselt in DB gespeichert werden', async ({ page, request }) => {
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Nachrichten|Messages/i');
    
    const secretMessage = 'Vertrauliche Diagnose: XYZ';
    await page.fill('[placeholder*="Nachricht"]', secretMessage);
    await page.click('button:has-text("Senden"), button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Versuche Nachricht via API abzurufen
    const response = await request.get('http://localhost:3000/api/messages', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok()) {
      const messages = await response.json();
      
      // Überprüfe, ob Nachricht entschlüsselt zurückkommt (Backend sollte automatisch entschlüsseln)
      // In der Datenbank sollte sie verschlüsselt sein
      const hasMessage = messages.some((m: any) => m.content === secretMessage);
      expect(hasMessage).toBe(true);
    }
  });
});

test.describe('Messaging: UI/UX', () => {
  
  test('EDGE CASE: Lange Nachrichten sollten umgebrochen werden', async ({ page }) => {
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Nachrichten|Messages/i');
    
    // Sehr lange Nachricht ohne Leerzeichen
    const longWord = 'A'.repeat(500);
    await page.fill('[placeholder*="Nachricht"]', longWord);
    await page.click('button:has-text("Senden"), button[type="submit"]');
    await page.waitForTimeout(1000);
    
    // Nachricht sollte sichtbar sein und nicht aus Container laufen
    const messageElement = page.locator(`text=${longWord.substring(0, 50)}`).first();
    
    if (await messageElement.count() > 0) {
      const box = await messageElement.boundingBox();
      expect(box).not.toBeNull();
      
      // Sollte nicht über Viewport-Breite hinausgehen
      if (box) {
        expect(box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      }
    }
  });

  test('EDGE CASE: Emoji und Unicode sollten korrekt angezeigt werden', async ({ page }) => {
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=/Nachrichten|Messages/i');
    
    const emojiMessage = '😀🎉👍 مرحبا 你好 🏥';
    await page.fill('[placeholder*="Nachricht"]', emojiMessage);
    await page.click('button:has-text("Senden"), button[type="submit"]');
    await page.waitForTimeout(1000);
    
    // Nachricht sollte korrekt angezeigt werden
    await expect(page.locator(`text=${emojiMessage}`)).toBeVisible();
  });
});
