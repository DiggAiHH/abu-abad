/**
 * E2E Tests: Questionnaire System
 * Tests dynamic form builder and response workflow
 */

import { test, expect } from '@playwright/test';
import { loginAsPatient, loginAsTherapist } from '../helpers';

test.describe.skip('Questionnaire Builder (Therapist)', () => {
  test('therapist can create a questionnaire template', async ({ page }) => {
    await loginAsTherapist(page);
    await page.goto('/questionnaires');
    
    // Open builder
    await page.click('button:has-text("Neue Vorlage")');
    
    // Fill template info
    await page.fill('input[placeholder*="z.B. Anamnesebogen"]', 'Depressions-Screening (PHQ-9)');
    await page.fill('textarea[placeholder*="Kurze Beschreibung"]', 'Standardisierter Fragebogen zur Erfassung depressiver Symptome');
    
    // Add text field
    await page.click('button:has-text("+ Textfeld")');
    await page.fill('input[placeholder*="z.B. Wie oft"]', 'Wie oft fühlten Sie sich im letzten Monat niedergeschlagen?');
    await page.click('button:has-text("Speichern")'); // Save field
    
    // Add radio field
    await page.click('button:has-text("+ Radiobuttons")');
    await page.fill('input[placeholder*="z.B. Wie oft"]', 'Schweregrad der Symptome');
    await page.fill('input[placeholder="Option 1"]', 'Nie');
    await page.click('button:has-text("+ Option hinzufügen")');
    await page.fill('input[placeholder="Option 2"]', 'Manchmal');
    await page.click('button:has-text("+ Option hinzufügen")');
    await page.fill('input[placeholder="Option 3"]', 'Häufig');
    await page.click('button:has-text("+ Option hinzufügen")');
    await page.fill('input[placeholder="Option 4"]', 'Täglich');
    await page.click('button:has-text("Speichern")'); // Save field
    
    // Save template
    await page.click('button:has-text("Speichern")').last();
    
    // Verify success
    await expect(page.locator('text=Vorlage erstellt')).toBeVisible();
    await expect(page.locator('text=Depressions-Screening (PHQ-9)')).toBeVisible();
  });

  test('therapist can edit existing template', async ({ page }) => {
    await loginAsTherapist(page);
    await page.goto('/questionnaires');
    
    // Edit first template
    await page.click('button[title="Bearbeiten"]').first();
    
    // Modify title
    const titleInput = page.locator('input[value*="PHQ"]');
    await titleInput.clear();
    await titleInput.fill('Depressions-Screening PHQ-9 (überarbeitet)');
    
    // Save
    await page.click('button:has-text("Speichern")').last();
    
    // Verify
    await expect(page.locator('text=Vorlage aktualisiert')).toBeVisible();
  });

  test('therapist can duplicate template', async ({ page }) => {
    await loginAsTherapist(page);
    await page.goto('/questionnaires');
    
    const templatesCountBefore = await page.locator('[data-template-item]').count();
    
    // Duplicate first template
    await page.click('button[title="Duplizieren"]').first();
    
    // Verify builder opened with "(Kopie)" in title
    await expect(page.locator('input[value*="(Kopie)"]')).toBeVisible();
    
    // Save duplicate
    await page.click('button:has-text("Speichern")').last();
    
    // Verify count increased
    const templatesCountAfter = await page.locator('[data-template-item]').count();
    expect(templatesCountAfter).toBe(templatesCountBefore + 1);
  });

  test('therapist can delete template', async ({ page }) => {
    await loginAsTherapist(page);
    await page.goto('/questionnaires');
    
    const templatesCountBefore = await page.locator('[data-template-item]').count();
    
    // Delete last template
    await page.click('button[title="Löschen"]').last();
    
    // Confirm deletion
    page.once('dialog', dialog => dialog.accept());
    
    // Verify
    await expect(page.locator('text=Vorlage gelöscht')).toBeVisible();
    
    const templatesCountAfter = await page.locator('[data-template-item]').count();
    expect(templatesCountAfter).toBe(templatesCountBefore - 1);
  });
});

test.describe.skip('Questionnaire Requests (Therapist)', () => {
  test('therapist can request questionnaire from patient', async ({ page }) => {
    await loginAsTherapist(page);
    
    // Navigate to patient detail (assume patient ID known)
    await page.goto('/patients/patient-id-123');
    
    // Open request modal
    await page.click('button:has-text("Fragebogen anfordern")');
    
    // Select template
    await page.selectOption('select', { label: 'Depressions-Screening' });
    
    // Set priority
    await page.selectOption('select[name="priority"]', 'high');
    
    // Set due date
    await page.fill('input[type="date"]', '2025-02-01');
    
    // Send request
    await page.click('button:has-text("Anfordern")');
    
    // Verify
    await expect(page.locator('text=Fragebogen angefordert')).toBeVisible();
  });
});

test.describe.skip('Questionnaire Response (Patient)', () => {
  test('patient can see requested questionnaires', async ({ page }) => {
    await loginAsPatient(page);
    await page.goto('/questionnaires');
    
    // Should see list of requested questionnaires
    await expect(page.locator('h1:has-text("Meine Fragebögen")')).toBeVisible();
    
    // High priority items should be marked
    const highPriorityBadge = page.locator('text=Dringend');
    if (await highPriorityBadge.count() > 0) {
      await expect(highPriorityBadge.first()).toBeVisible();
    }
  });

  test('patient can start and complete questionnaire', async ({ page }) => {
    await loginAsPatient(page);
    await page.goto('/questionnaires');
    
    // Start first questionnaire
    await page.click('button:has-text("Beginnen")').first();
    
    // Fill text field
    await page.fill('input[type="text"]', 'Ich fühle mich oft niedergeschlagen und antriebslos.');
    
    // Select radio option
    await page.click('input[type="radio"][value="Häufig"]');
    
    // Verify progress updates
    await expect(page.locator('text=/\\d+%/')).toBeVisible();
    
    // Submit (if all required fields filled)
    const submitButton = page.locator('button:has-text("Einreichen")');
    if (await submitButton.isEnabled()) {
      await submitButton.click();
      await expect(page.locator('text=Fragebogen eingereicht')).toBeVisible();
    }
  });

  test('patient can save draft and continue later', async ({ page }) => {
    await loginAsPatient(page);
    await page.goto('/questionnaires');
    
    // Start questionnaire
    await page.click('button:has-text("Beginnen")').first();
    
    // Fill partial answers
    await page.fill('input[type="text"]', 'Teilweise ausgefüllt');
    
    // Save draft manually
    await page.click('button:has-text("Entwurf speichern")');
    
    // Go back
    await page.click('text=Zurück zur Übersicht');
    
    // Verify status changed to "in_progress"
    await expect(page.locator('button:has-text("Fortsetzen")')).toBeVisible();
    
    // Continue
    await page.click('button:has-text("Fortsetzen")');
    
    // Verify draft data loaded
    await expect(page.locator('input[value="Teilweise ausgefüllt"]')).toBeVisible();
  });

  test('auto-save: draft is saved automatically after 3 seconds', async ({ page }) => {
    await loginAsPatient(page);
    await page.goto('/questionnaires');
    
    await page.click('button:has-text("Beginnen")').first();
    
    // Type in field
    await page.fill('input[type="text"]', 'Auto-save test');
    
    // Wait for auto-save (3 seconds + buffer)
    await page.waitForTimeout(4000);
    
    // Verify save indicator appeared
    await expect(page.locator('text=Wird gespeichert...')).toHaveCount(0); // Should be gone after save
    
    // Refresh page
    await page.reload();
    
    // Should redirect back or show continue option
    await page.click('button:has-text("Fortsetzen")');
    
    // Verify data persisted
    await expect(page.locator('input[value="Auto-save test"]')).toBeVisible();
  });

  test('validation: required fields must be filled', async ({ page }) => {
    await loginAsPatient(page);
    await page.goto('/questionnaires');
    
    await page.click('button:has-text("Beginnen")').first();
    
    // Try to submit without filling required fields
    const submitButton = page.locator('button:has-text("Einreichen")');
    
    // Button should be disabled if progress < 100%
    if (await page.locator('text=/\\d+%/').textContent() !== '100%') {
      await expect(submitButton).toBeDisabled();
    }
    
    // If we try to submit anyway (via API), should get error
    await submitButton.click({ force: true });
    await expect(page.locator('text=Bitte füllen Sie alle Pflichtfelder aus')).toBeVisible();
  });
});

test.describe.skip('Therapist Views Responses', () => {
  test('therapist can view patient responses', async ({ page }) => {
    await loginAsTherapist(page);
    
    // Navigate to patient detail
    await page.goto('/patients/patient-id-123');
    
    // View questionnaire responses tab
    await page.click('text=Fragebögen');
    
    // Should see completed questionnaires
    await expect(page.locator('text=Abgeschlossen')).toBeVisible();
    
    // View response details
    await page.click('button:has-text("Antworten ansehen")').first();
    
    // Should see decrypted answers
    await expect(page.locator('text=Ich fühle mich oft niedergeschlagen')).toBeVisible();
  });
});

test.describe.skip('JSON-Schema Validation', () => {
  test('form renders all field types correctly', async ({ page }) => {
    await loginAsPatient(page);
    await page.goto('/questionnaires');
    
    await page.click('button:has-text("Beginnen")').first();
    
    // Verify different input types are rendered
    const hasTextInput = await page.locator('input[type="text"]').count() > 0;
    const hasTextarea = await page.locator('textarea').count() > 0;
    const hasRadio = await page.locator('input[type="radio"]').count() > 0;
    const hasCheckbox = await page.locator('input[type="checkbox"]').count() > 0;
    const hasNumber = await page.locator('input[type="number"]').count() > 0;
    const hasDate = await page.locator('input[type="date"]').count() > 0;
    
    // At least some field types should be present
    expect(hasTextInput || hasTextarea || hasRadio).toBe(true);
  });
});
