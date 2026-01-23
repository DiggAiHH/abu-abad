import { test, expect } from '@playwright/test';

/**
 * E2E Tests für i18n (Internationalisierung)
 * Tests für 20 Sprachen mit RTL-Unterstützung
 */

// Alle unterstützten Sprachen
const SUPPORTED_LANGUAGES = [
  { code: 'de', name: 'Deutsch', rtl: false },
  { code: 'en', name: 'English', rtl: false },
  { code: 'tr', name: 'Türkçe', rtl: false },
  { code: 'ar', name: 'العربية', rtl: true },
  { code: 'ru', name: 'Русский', rtl: false },
  { code: 'fa', name: 'فارسی', rtl: true },
  { code: 'uk', name: 'Українська', rtl: false },
  { code: 'pl', name: 'Polski', rtl: false },
  { code: 'ro', name: 'Română', rtl: false },
  { code: 'bg', name: 'Български', rtl: false },
  { code: 'sr', name: 'Српски', rtl: false },
  { code: 'hr', name: 'Hrvatski', rtl: false },
  { code: 'bs', name: 'Bosanski', rtl: false },
  { code: 'sq', name: 'Shqip', rtl: false },
  { code: 'el', name: 'Ελληνικά', rtl: false },
  { code: 'kmr', name: 'Kurmancî', rtl: false },
  { code: 'ckb', name: 'کوردی', rtl: true },
  { code: 'es', name: 'Español', rtl: false },
  { code: 'fr', name: 'Français', rtl: false },
  { code: 'pt', name: 'Português', rtl: false },
];

test.describe.skip('i18n Language Switching', () => {
  test.beforeEach(async ({ page }) => {
    // Start auf Landing Page
    await page.goto('/');
  });

  test('Landing page loads with default language', async ({ page }) => {
    // Prüfe ob Seite geladen hat
    await expect(page).toHaveTitle(/Abu-Abbad|Teletherapie|Therapy/i);
    
    // LanguageSwitcher sollte sichtbar sein
    const languageSwitcher = page.locator('[data-testid="language-switcher"]');
    await expect(languageSwitcher.or(page.locator('button:has-text("🇩🇪")'))).toBeVisible();
  });

  test('Language switcher dropdown opens and shows all languages', async ({ page }) => {
    // Klicke auf Language Switcher
    const switcherButton = page.locator('button:has-text("🇩🇪"), button:has-text("🇬🇧"), [data-testid="language-switcher"]').first();
    await switcherButton.click();
    
    // Dropdown sollte öffnen
    const dropdown = page.locator('[role="menu"], .language-dropdown, ul[class*="absolute"]');
    await expect(dropdown).toBeVisible();
    
    // Mindestens 10 Sprachen sollten sichtbar sein
    const languageItems = dropdown.locator('button, li, a');
    const count = await languageItems.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('Switching to English changes UI text', async ({ page }) => {
    // Klicke auf Language Switcher
    const switcherButton = page.locator('button:has-text("🇩🇪"), [data-testid="language-switcher"]').first();
    await switcherButton.click();
    
    // Wähle Englisch
    await page.locator('button:has-text("English"), button:has-text("🇬🇧 English")').click();
    
    // Warte auf Sprachwechsel
    await page.waitForTimeout(500);
    
    // Prüfe englischen Text (Login/Try Free/etc)
    await expect(page.getByText(/Login|Sign in|Try Free|Get Started/i).first()).toBeVisible();
  });

  test('Switching to Arabic activates RTL layout', async ({ page }) => {
    // Klicke auf Language Switcher
    const switcherButton = page.locator('button:has-text("🇩🇪"), button:has-text("🇬🇧"), [data-testid="language-switcher"]').first();
    await switcherButton.click();
    
    // Wähle Arabisch
    await page.locator('button:has-text("العربية"), button:has-text("🇸🇦")').click();
    
    // Warte auf Sprachwechsel
    await page.waitForTimeout(500);
    
    // Prüfe RTL
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
    
    // Arabischer Text sollte sichtbar sein
    await expect(page.getByText(/تسجيل الدخول|العربية|الدخول/i).first()).toBeVisible();
  });

  test('Switching to Turkish shows Turkish text', async ({ page }) => {
    // Klicke auf Language Switcher
    const switcherButton = page.locator('button:has-text("🇩🇪"), button:has-text("🇬🇧"), [data-testid="language-switcher"]').first();
    await switcherButton.click();
    
    // Wähle Türkisch
    await page.locator('button:has-text("Türkçe"), button:has-text("🇹🇷")').click();
    
    // Warte auf Sprachwechsel
    await page.waitForTimeout(500);
    
    // Prüfe türkischen Text
    await expect(page.getByText(/Giriş|Ücretsiz Dene|Kayıt/i).first()).toBeVisible();
  });

  test('Language preference persists after page reload', async ({ page }) => {
    // Wechsle zu Englisch
    const switcherButton = page.locator('button:has-text("🇩🇪"), [data-testid="language-switcher"]').first();
    await switcherButton.click();
    await page.locator('button:has-text("English"), button:has-text("🇬🇧 English")').click();
    await page.waitForTimeout(500);
    
    // Reload Seite
    await page.reload();
    await page.waitForTimeout(500);
    
    // Sprache sollte noch Englisch sein
    await expect(page.getByText(/Login|Sign in|Try Free/i).first()).toBeVisible();
  });
});

test.describe.skip('Login Page i18n', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('Login page shows translated labels', async ({ page }) => {
    // Standardmäßig Deutsch
    await expect(page.getByLabel(/E-Mail|Email/i).or(page.locator('input[type="email"]'))).toBeVisible();
    await expect(page.getByLabel(/Passwort|Password/i).or(page.locator('input[type="password"]'))).toBeVisible();
  });

  test('Login validation errors are translated', async ({ page }) => {
    // Klicke Login ohne Eingabe
    await page.getByRole('button', { name: /Login|Anmelden|Sign in/i }).click();
    
    // Fehlermeldung sollte erscheinen (in aktueller Sprache)
    await expect(page.getByText(/erforderlich|required|Pflichtfeld|gültig/i).first()).toBeVisible();
  });
});

test.describe.skip('Register Page i18n', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('Register page shows all required fields', async ({ page }) => {
    // Vorname/Nachname Felder
    await expect(page.getByLabel(/Vorname|First name|Name/i).or(page.locator('input[name="firstName"]'))).toBeVisible();
    
    // Email Feld
    await expect(page.getByLabel(/E-Mail|Email/i).or(page.locator('input[type="email"]'))).toBeVisible();
    
    // Passwort Feld
    await expect(page.getByLabel(/Passwort|Password/i).first().or(page.locator('input[type="password"]').first())).toBeVisible();
  });

  test('DSGVO checkbox has translated text', async ({ page }) => {
    // DSGVO/GDPR/Privacy Checkbox sollte vorhanden sein
    const dsgvoCheckbox = page.getByText(/Datenschutz|Privacy|GDPR|DSGVO/i);
    await expect(dsgvoCheckbox.first()).toBeVisible();
  });
});

test.describe.skip('RTL Languages', () => {
  const rtlLanguages = SUPPORTED_LANGUAGES.filter(l => l.rtl);

  for (const lang of rtlLanguages) {
    test(`${lang.name} (${lang.code}) has correct RTL direction`, async ({ page }) => {
      await page.goto('/');
      
      // Öffne Language Switcher
      const switcherButton = page.locator('button:has-text("🇩🇪"), button:has-text("🇬🇧"), [data-testid="language-switcher"]').first();
      await switcherButton.click();
      
      // Wähle RTL Sprache
      await page.locator(`button:has-text("${lang.name}")`).click();
      await page.waitForTimeout(500);
      
      // Prüfe RTL
      const html = page.locator('html');
      await expect(html).toHaveAttribute('dir', 'rtl');
    });
  }
});

test.describe.skip('Privacy Page i18n', () => {
  test('Privacy page loads with translated content', async ({ page }) => {
    await page.goto('/privacy');
    
    // Überschrift sollte vorhanden sein
    await expect(page.getByRole('heading', { level: 1 }).or(page.locator('h1'))).toBeVisible();
    
    // Datenschutz-relevanter Content
    await expect(page.getByText(/Datenschutz|Privacy|حماية البيانات|Gizlilik/i).first()).toBeVisible();
  });
});
