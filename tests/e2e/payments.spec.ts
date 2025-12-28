import { test, expect } from '@playwright/test';
import { registerUser, loginUser, TEST_USERS, generateRandomEmail, createAppointment } from '../helpers';

/**
 * Payment Tests: Stripe Integration, Webhook Verification, Error Handling
 * 
 * Tests für Stripe Checkout, Webhook-Verifizierung und Payment-Fehlerbehandlung
 */

test.describe('Payments: Stripe Checkout Flow', () => {
  
  test('EDGE CASE: Negative Preise sollten abgelehnt werden', async ({ page }) => {
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    // Registriere Therapeut und Patient
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.goto('/logout');
    await registerUser(page, { ...TEST_USERS.patient, email: patientEmail });
    
    // Therapeut erstellt Slot mit negativem Preis (durch DevTools-Manipulation)
    await page.goto('/logout');
    await loginUser(page, { email: therapistEmail, password: TEST_USERS.therapist.password });
    
    await page.waitForTimeout(2000);
    
    // Öffne Slot-Modal
    await page.click('button:has-text("Neuen Slot erstellen")');
    
    // Manipuliere Preis-Input zu negativem Wert
    await page.evaluate(() => {
      const priceInput = document.querySelector('input[type="number"][placeholder*="Preis"]') as HTMLInputElement;
      if (priceInput) {
        priceInput.value = '-50';
        priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    
    // Versuche zu speichern
    const saveButton = page.locator('button:has-text("Speichern")');
    await saveButton.click();
    
    // API sollte ablehnen
    await expect(page.locator('text=/Preis muss|invalid price|positive/i')).toBeVisible({ timeout: 5000 });
  });

  test('EDGE CASE: Preis = 0 sollte behandelt werden', async ({ page }) => {
    const therapistEmail = generateRandomEmail();
    
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.waitForTimeout(2000);
    
    // Erstelle Slot mit Preis = 0
    await page.click('button:has-text("Neuen Slot erstellen")');
    
    await page.fill('input[type="datetime-local"]', new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    await page.fill('input[type="number"][placeholder*="Preis"]', '0');
    
    await page.click('button:has-text("Speichern")');
    
    // Sollte entweder ablehnen oder als "kostenlos" markieren
    await page.waitForTimeout(2000);
    
    const hasError = await page.locator('text=/Preis muss|mindestens/i').count();
    const hasFreeLabel = await page.locator('text=/kostenlos|free/i').count();
    
    // Einer der beiden sollte auftreten
    expect(hasError + hasFreeLabel).toBeGreaterThan(0);
  });

  test('EDGE CASE: Extrem hoher Preis (>100000€) sollte validiert werden', async ({ page }) => {
    const therapistEmail = generateRandomEmail();
    
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.waitForTimeout(2000);
    
    await page.click('button:has-text("Neuen Slot erstellen")');
    
    await page.fill('input[type="datetime-local"]', new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    await page.fill('input[type="number"][placeholder*="Preis"]', '999999');
    
    await page.click('button:has-text("Speichern")');
    
    // Sollte Warnung zeigen oder max-Attribut haben
    const maxAttr = await page.locator('input[type="number"][placeholder*="Preis"]').getAttribute('max');
    const hasWarning = await page.locator('text=/zu hoch|maximum|unrealistic/i').count();
    
    expect(maxAttr || hasWarning > 0).toBeTruthy();
  });
});

test.describe('Payments: Webhook Verification', () => {
  
  test('EDGE CASE: Webhook ohne Stripe-Signatur sollte abgelehnt werden', async ({ request }) => {
    // Versuche Webhook ohne Stripe-Signature-Header zu senden
    const response = await request.post('http://localhost:3000/api/webhooks/stripe', {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_fake',
            payment_status: 'paid',
            metadata: {
              appointmentId: '123'
            }
          }
        }
      }
    });
    
    // Sollte 400 oder 401 zurückgeben
    expect([400, 401, 403]).toContain(response.status());
  });

  test('EDGE CASE: Webhook mit falscher Signatur sollte abgelehnt werden', async ({ request }) => {
    const response = await request.post('http://localhost:3000/api/webhooks/stripe', {
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'fake_signature_12345'
      },
      data: {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_fake',
            payment_status: 'paid'
          }
        }
      }
    });
    
    // Sollte Webhook ablehnen
    expect([400, 401, 403]).toContain(response.status());
  });
});

test.describe('Payments: Double Payment Prevention', () => {
  
  test('EDGE CASE: Doppelzahlung für denselben Termin sollte verhindert werden', async ({ page, context }) => {
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    // Setup: Therapeut erstellt Slot
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.goto('/logout');
    await registerUser(page, { ...TEST_USERS.patient, email: patientEmail });
    
    // Patient bucht Termin
    await page.waitForTimeout(2000);
    
    // Slot suchen und buchen
    const slotCard = page.locator('[data-testid="appointment-slot"]').first();
    if (await slotCard.count() > 0) {
      await slotCard.locator('button:has-text("Buchen")').click();
      
      // Stripe Checkout wird in neuem Tab geöffnet
      const [checkoutPage] = await Promise.all([
        context.waitForEvent('page'),
        page.waitForTimeout(2000)
      ]);
      
      if (checkoutPage) {
        // Zurück zum Dashboard ohne zu zahlen
        await page.bringToFront();
        await page.goto('/patient-dashboard');
        
        // Versuche NOCHMAL denselben Slot zu buchen
        await slotCard.locator('button:has-text("Buchen")').click();
        
        // Sollte Fehler anzeigen: "Bereits gebucht"
        await expect(page.locator('text=/bereits gebucht|already booked/i')).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

test.describe('Payments: Payment Failure Handling', () => {
  
  test('EDGE CASE: Abgebrochene Zahlung sollte Slot freigeben', async ({ page, context }) => {
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    // Setup
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.goto('/logout');
    await registerUser(page, { ...TEST_USERS.patient, email: patientEmail });
    
    await page.waitForTimeout(2000);
    
    // Patient bucht, bricht aber ab
    const slotCard = page.locator('[data-testid="appointment-slot"]').first();
    if (await slotCard.count() > 0) {
      const slotText = await slotCard.textContent();
      
      await slotCard.locator('button:has-text("Buchen")').click();
      await page.waitForTimeout(2000);
      
      // Zurück zum Dashboard (simuliert Abbruch)
      await page.goto('/patient-dashboard');
      await page.waitForTimeout(2000);
      
      // Slot sollte noch verfügbar sein
      const sameSlot = page.locator('[data-testid="appointment-slot"]', { hasText: slotText || '' }).first();
      await expect(sameSlot.locator('button:has-text("Buchen")')).toBeVisible({ timeout: 5000 });
    }
  });

  test('EDGE CASE: Expired Checkout Session sollte behandelt werden', async ({ request }) => {
    // Simuliere expired Stripe Session
    const response = await request.post('http://localhost:3000/api/payments/verify', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake_token'
      },
      data: {
        sessionId: 'cs_test_expired_12345'
      }
    });
    
    // Sollte Fehler zurückgeben
    expect([400, 404, 410]).toContain(response.status());
  });
});

test.describe('Payments: Refund & Cancellation', () => {
  
  test('EDGE CASE: Termin-Stornierung <24h vor Termin sollte unterschiedlich behandelt werden', async ({ page }) => {
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.goto('/logout');
    await registerUser(page, { ...TEST_USERS.patient, email: patientEmail });
    
    // Annahme: Patient hat bereits einen Termin gebucht
    await page.waitForTimeout(2000);
    
    const appointmentCard = page.locator('[data-testid="appointment-card"]').first();
    if (await appointmentCard.count() > 0) {
      // Versuche zu stornieren
      await appointmentCard.locator('button:has-text("Stornieren")').click();
      
      // Sollte Hinweis auf Stornierungsbedingungen anzeigen
      await expect(page.locator('text=/Stornierungsbedingungen|cancellation policy|24 Stunden/i')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Payments: Currency & Locale', () => {
  
  test('EDGE CASE: Währungsformatierung sollte korrekt sein', async ({ page }) => {
    const therapistEmail = generateRandomEmail();
    
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.waitForTimeout(2000);
    
    // Erstelle Slot mit Preis
    await page.click('button:has-text("Neuen Slot erstellen")');
    await page.fill('input[type="datetime-local"]', new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    await page.fill('input[type="number"][placeholder*="Preis"]', '99.99');
    await page.click('button:has-text("Speichern")');
    
    await page.waitForTimeout(2000);
    
    // Überprüfe Währungsformatierung
    const priceText = await page.locator('text=/99[.,]99|€/i').first().textContent();
    
    // Sollte Euro-Symbol enthalten
    expect(priceText).toMatch(/€|EUR/);
    
    // Sollte deutsches oder englisches Format haben (99,99 oder 99.99)
    expect(priceText).toMatch(/\d+[.,]\d{2}/);
  });
});

test.describe('Payments: Fraud Prevention', () => {
  
  test('EDGE CASE: Gleichzeitige Payment-Versuche sollten erkannt werden', async ({ page, context }) => {
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.goto('/logout');
    await registerUser(page, { ...TEST_USERS.patient, email: patientEmail });
    
    await page.waitForTimeout(2000);
    
    // Öffne zwei Tabs mit demselben Account
    const page2 = await context.newPage();
    await page2.goto('http://localhost:5173/login');
    await loginUser(page2, { email: patientEmail, password: TEST_USERS.patient.password });
    
    // Beide versuchen denselben Slot zu buchen
    const slotCard1 = page.locator('[data-testid="appointment-slot"]').first();
    const slotCard2 = page2.locator('[data-testid="appointment-slot"]').first();
    
    if (await slotCard1.count() > 0 && await slotCard2.count() > 0) {
      // Gleichzeitig klicken
      await Promise.all([
        slotCard1.locator('button:has-text("Buchen")').click(),
        slotCard2.locator('button:has-text("Buchen")').click()
      ]);
      
      await page.waitForTimeout(3000);
      
      // Nur einer sollte erfolgreich sein
      const error1 = await page.locator('text=/bereits gebucht|error/i').count();
      const error2 = await page2.locator('text=/bereits gebucht|error/i').count();
      
      // Mindestens einer sollte einen Fehler sehen
      expect(error1 + error2).toBeGreaterThan(0);
    }
    
    await page2.close();
  });
});
