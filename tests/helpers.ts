import { test, expect, Page } from '@playwright/test';

/**
 * Test-Hilfsfunktionen
 */

export const TEST_USERS = {
  therapist: {
    email: 'therapeut.test@example.com',
    password: 'Test1234!',
    firstName: 'Dr. Test',
    lastName: 'Therapeut',
    role: 'therapist' as const
  },
  patient: {
    email: 'patient.test@example.com',
    password: 'Test1234!',
    firstName: 'Test',
    lastName: 'Patient',
    role: 'patient' as const
  }
};

export async function registerUser(page: Page, user: typeof TEST_USERS.therapist | typeof TEST_USERS.patient) {
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
  await page.waitForURL('**/dashboard', { timeout: 5000 });
}

export async function loginUser(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/login');
  await page.fill('input[type="email"]', credentials.email);
  await page.fill('input[type="password"]', credentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 5000 });
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
