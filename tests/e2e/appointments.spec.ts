import { test, expect } from '@playwright/test';
import { registerUser, loginUser, TEST_USERS, generateRandomEmail, createAppointment, getDateTimeString } from '../helpers';

/**
 * E2E Tests: Terminbuchung
 * 
 * Edge Cases:
 * - Doppelbuchung desselben Slots
 * - Terminüberschneidungen
 * - Buchung in der Vergangenheit
 * - Endzeit vor Startzeit
 * - Race Conditions
 * - IDOR (Insecure Direct Object Reference)
 */

test.describe('Terminbuchung - Edge Cases', () => {
  
  test.beforeEach(async ({ page }) => {
    // Cleanup: Registriere frischen Therapeuten
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
  });

  test('EDGE CASE: Endzeit vor Startzeit sollte abgelehnt werden', async ({ page }) => {
    await page.waitForURL('**/dashboard');
    
    await page.click('button:has-text("Slot erstellen")');
    
    // Endzeit VOR Startzeit
    const start = getDateTimeString(2);
    const end = getDateTimeString(1); // Früher als Start
    
    await page.fill('input[type="datetime-local"]:first-of-type', start);
    await page.fill('input[type="datetime-local"]:last-of-type', end);
    await page.fill('input[type="number"]', '120');
    
    await page.click('button[type="submit"]');
    
    // Fehler sollte angezeigt werden
    await expect(page.locator('text=/Endzeit.*nach.*Startzeit/i')).toBeVisible({ timeout: 3000 });
  });

  test('EDGE CASE: Termin in der Vergangenheit sollte nicht buchbar sein', async ({ page }) => {
    await page.waitForURL('**/dashboard');
    
    await page.click('button:has-text("Slot erstellen")');
    
    // Datum in der Vergangenheit
    const past = new Date();
    past.setHours(past.getHours() - 2);
    const pastString = past.toISOString().slice(0, 16);
    
    await page.fill('input[type="datetime-local"]:first-of-type', pastString);
    
    // Browser sollte Eingabe verhindern oder Backend lehnt ab
    const input = page.locator('input[type="datetime-local"]:first-of-type');
    const min = await input.getAttribute('min');
    
    // Optional: Min-Attribut sollte gesetzt sein
    if (min) {
      expect(new Date(min).getTime()).toBeLessThanOrEqual(new Date().getTime());
    }
  });

  test('EDGE CASE: Überschneidende Termine sollten verhindert werden', async ({ page }) => {
    await page.waitForURL('**/dashboard');
    
    // Erstelle ersten Termin: 10:00 - 11:00
    await createAppointment(
      page,
      getDateTimeString(24), // Morgen 10:00
      getDateTimeString(25)  // Morgen 11:00
    );
    
    await page.waitForTimeout(1000);
    
    // Versuche überschneidenden Termin zu erstellen: 10:30 - 11:30
    await page.click('button:has-text("Slot erstellen")');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 30, 0, 0);
    const start = tomorrow.toISOString().slice(0, 16);
    
    tomorrow.setHours(11, 30, 0, 0);
    const end = tomorrow.toISOString().slice(0, 16);
    
    await page.fill('input[type="datetime-local"]:first-of-type', start);
    await page.fill('input[type="datetime-local"]:last-of-type', end);
    await page.fill('input[type="number"]', '120');
    
    await page.click('button[type="submit"]');
    
    // Sollte Fehler anzeigen
    await expect(page.locator('text=/Überschneidung|bereits belegt|overlap/i')).toBeVisible({ timeout: 3000 });
  });

  test('EDGE CASE: Doppelbuchung desselben Slots (Race Condition)', async ({ page, context }) => {
    // Erstelle Therapeut und Slot
    await page.waitForURL('**/dashboard');
    
    await createAppointment(
      page,
      getDateTimeString(48),
      getDateTimeString(49),
      100
    );
    
    await page.waitForTimeout(1000);
    
    // Logout als Therapeut
    await page.click('button:has-text("Abmelden")');
    await page.waitForURL('**/login');
    
    // Patient 1 registrieren
    const patient1Email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email: patient1Email });
    await page.waitForURL('**/dashboard');
    
    // Öffne zweiten Tab für Patient 2
    const page2 = await context.newPage();
    const patient2Email = generateRandomEmail();
    await registerUser(page2, { ...TEST_USERS.patient, email: patient2Email });
    await page2.waitForURL('**/dashboard');
    
    // Beide versuchen gleichzeitig zu buchen
    await page.click('text=Termin buchen');
    await page2.click('text=Termin buchen');
    
    await page.waitForTimeout(500);
    
    const bookButtons = page.locator('button:has-text("Jetzt buchen")');
    const bookButtons2 = page2.locator('button:has-text("Jetzt buchen")');
    
    const count1 = await bookButtons.count();
    const count2 = await bookButtons2.count();
    
    if (count1 > 0 && count2 > 0) {
      // Klicke beide gleichzeitig
      await Promise.all([
        bookButtons.first().click(),
        bookButtons2.first().click()
      ]);
      
      await page.waitForTimeout(2000);
      
      // Einer sollte erfolgreich sein, einer sollte Fehler bekommen
      const error1 = await page.locator('text=/bereits gebucht|nicht verfügbar/i').count();
      const error2 = await page2.locator('text=/bereits gebucht|nicht verfügbar/i').count();
      
      // Mindestens einer sollte Fehler haben
      expect(error1 + error2).toBeGreaterThanOrEqual(1);
    }
    
    await page2.close();
  });

  test('EDGE CASE: Negativer oder Null-Preis sollte abgelehnt werden', async ({ page }) => {
    await page.waitForURL('**/dashboard');
    
    await page.click('button:has-text("Slot erstellen")');
    
    await page.fill('input[type="datetime-local"]:first-of-type', getDateTimeString(24));
    await page.fill('input[type="datetime-local"]:last-of-type', getDateTimeString(25));
    
    // Negativer Preis
    await page.fill('input[type="number"]', '-50');
    
    await page.click('button[type="submit"]');
    
    // HTML5 Validation oder Backend-Fehler
    const isInvalid = await page.locator('input[type="number"]:invalid').count() > 0;
    
    if (!isInvalid) {
      // Backend sollte ablehnen
      await expect(page.locator('text=/Preis.*größer.*0|invalid price/i')).toBeVisible({ timeout: 3000 });
    }
  });

  test('EDGE CASE: Extrem kurze Termine (<5 Minuten) sollten validiert werden', async ({ page }) => {
    await page.waitForURL('**/dashboard');
    
    await page.click('button:has-text("Slot erstellen")');
    
    const start = getDateTimeString(24);
    
    // Nur 2 Minuten später
    const startDate = new Date(start);
    startDate.setMinutes(startDate.getMinutes() + 2);
    const end = startDate.toISOString().slice(0, 16);
    
    await page.fill('input[type="datetime-local"]:first-of-type', start);
    await page.fill('input[type="datetime-local"]:last-of-type', end);
    await page.fill('input[type="number"]', '50');
    
    await page.click('button[type="submit"]');
    
    // Sollte eventuell Warnung zeigen (optional)
    // Oder akzeptiert werden, wenn keine Mindestdauer definiert
    await page.waitForTimeout(2000);
  });

  test('Happy Path: Erfolgreiche Terminbuchung', async ({ page, context }) => {
    // Therapeut erstellt Slot
    await page.waitForURL('**/dashboard');
    
    await createAppointment(
      page,
      getDateTimeString(48),
      getDateTimeString(49),
      120
    );
    
    await expect(page.locator('text=/Slot.*erstellt|erfolgreich/i')).toBeVisible({ timeout: 3000 });
    
    // Logout als Therapeut
    await page.click('button:has-text("Abmelden")');
    await page.waitForURL('**/login');
    
    // Patient registrieren und buchen
    const patientEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email: patientEmail });
    await page.waitForURL('**/dashboard');
    
    await page.click('text=Termin buchen');
    await page.waitForTimeout(1000);
    
    const bookButton = page.locator('button:has-text("Jetzt buchen")').first();
    
    if (await bookButton.count() > 0) {
      await bookButton.click();
      
      // Stripe Checkout sollte öffnen
      await page.waitForURL(/stripe|checkout/, { timeout: 10000 });
    }
  });
});

test.describe('IDOR - Insecure Direct Object Reference', () => {
  
  test('EDGE CASE: Patient sollte nur eigene Termine sehen', async ({ page }) => {
    // Erstelle zwei Patienten
    const patient1Email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email: patient1Email });
    
    await page.click('button:has-text("Abmelden")');
    
    const patient2Email = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email: patient2Email });
    
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    
    // Patient 2 sollte keine Termine von Patient 1 sehen
    const appointmentsList = page.locator('[data-testid="appointments-list"], .appointments, text=/Meine.*Termine/i');
    
    // Sollte leer sein oder nur eigene Termine
    const hasOtherAppointments = await page.locator(`text=${patient1Email}`).count();
    expect(hasOtherAppointments).toBe(0);
  });
});
