/**
 * Page Object Pattern: Login Page
 * 
 * WHY: Isoliert UI-Changes von Test-Logic
 * PREVENTS: Fehler B (Tests brechen bei UI-Refactoring)
 */

import { Page, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // DEFENSIVE: data-testid statt CSS-Selektoren (Breaking-Change-Proof)
  get emailInput() {
    return this.page.getByTestId('login-email');
  }

  get passwordInput() {
    return this.page.getByTestId('login-password');
  }

  get submitButton() {
    return this.page.getByTestId('login-submit');
  }

  get testCredentialsBox() {
    return this.page.locator('.bg-blue-50').filter({ hasText: 'Test-Zugangsdaten' });
  }

  /**
   * Navigate to Login Page
   * PREVENTS: Fehler Z (URL-Typos in jedem Test)
   */
  async goto() {
    await this.page.goto('/login');
    // DEFENSIVE: Wait for Page Load (nicht nur Navigation)
    await expect(this.page.locator('h1')).toContainText('Abu-Abbad Login');
  }

  /**
   * Perform Login Action
   * 
   * @param email - User email
   * @param password - User password
   * 
   * PREVENTS: 
   * - Fehler X: Navigation before Token Set (explizites waitForURL)
   * - Fehler Y: Race Condition (waitForLoadState)
   */
  async login(email: string, password: string) {
    // DEFENSIVE: Input Validation
    if (!email || !password) {
      throw new Error('LoginPage.login(): email and password required');
    }

    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    
    // ANTI-PATTERN AVOIDED: Sleep(1000) → stattdessen explicit wait
    await this.submitButton.click();
    
    // PREVENTS: Fehler X (Assertion before Navigation completes)
    await this.page.waitForURL(/\/(dashboard|patient-dashboard|therapist-dashboard)/, { 
      timeout: 10000 
    });
    
    // DEFENSIVE: Wait for React Hydration
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Assert Login Failed with Error Message
   * PREVENTS: False Positives (Test passes but Login succeeded)
   */
  async expectLoginError(expectedMessage?: string) {
    // Toast error should appear (react-hot-toast)
    // FIX: Use .first() to handle multiple toast messages (Backend error + Frontend error)
    const toast = this.page.locator('[role="status"], .react-hot-toast').first();
    await expect(toast).toBeVisible({ timeout: 5000 });
    
    if (expectedMessage) {
      await expect(toast).toContainText(expectedMessage);
    }
  }

  /**
   * Assert Test Credentials Visible
   * PREVENTS: Regression (Credentials-Box versehentlich removed)
   */
  async expectTestCredentialsVisible() {
    await expect(this.testCredentialsBox).toBeVisible();
    await expect(this.testCredentialsBox).toContainText('patient@test.de');
    await expect(this.testCredentialsBox).toContainText('Test123!');
  }
}
