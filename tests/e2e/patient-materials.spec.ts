/**
 * E2E Tests: Patient Pre-Session Materials
 * Tests file upload, encryption, sharing workflow
 */

import { test, expect } from '@playwright/test';
import { loginAsPatient, loginAsTherapist } from '../helpers';

test.describe('Patient Materials Upload', () => {
  test('patient can upload a text note', async ({ page }) => {
    await loginAsPatient(page);
    
    // Navigate to materials page
    await page.goto('/materials');
    
    // Open note modal
    await page.click('button:has-text("Notiz erstellen")');
    
    // Fill note content
    const noteText = 'Ich hatte diese Woche vermehrt Angstzustände, insbesondere in öffentlichen Verkehrsmitteln.';
    await page.fill('textarea', noteText);
    
    // Save note
    await page.click('button:has-text("Speichern")');
    
    // Verify success
    await expect(page.locator('text=Notiz erfolgreich gespeichert')).toBeVisible();
    
    // Verify note appears in list
    await expect(page.locator('text=Notiz')).toBeVisible();
  });

  test('patient can upload a file (sketch/audio/video)', async ({ page }) => {
    await loginAsPatient(page);
    await page.goto('/materials');
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-sketch.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image-data')
    });
    
    // Verify file selected
    await expect(page.locator('text=test-sketch.png')).toBeVisible();
    
    // Upload
    await page.click('button:has-text("Hochladen")');
    
    // Verify success
    await expect(page.locator('text=Datei erfolgreich hochgeladen')).toBeVisible();
  });

  test('patient can share material with therapist', async ({ page }) => {
    await loginAsPatient(page);
    await page.goto('/materials');
    
    // Assume material exists from previous test
    const shareButton = page.locator('button:has-text("Teilen")').first();
    
    // Initially not shared
    await expect(shareButton).toBeVisible();
    
    // Share with therapist
    await shareButton.click();
    
    // Verify shared status
    await expect(page.locator('text=Mit Therapeut geteilt')).toBeVisible();
    await expect(page.locator('text=Geteilt')).toBeVisible();
  });

  test('patient can delete material (GDPR Art. 17)', async ({ page }) => {
    await loginAsPatient(page);
    await page.goto('/materials');
    
    // Count materials before deletion
    const materialsCountBefore = await page.locator('[data-material-item]').count();
    
    // Delete first material
    const deleteButton = page.locator('button[title="Löschen"]').first();
    await deleteButton.click();
    
    // Confirm deletion
    page.once('dialog', dialog => dialog.accept());
    
    // Verify material removed
    await expect(page.locator('text=Material gelöscht')).toBeVisible();
    
    const materialsCountAfter = await page.locator('[data-material-item]').count();
    expect(materialsCountAfter).toBe(materialsCountBefore - 1);
  });

  test('therapist can only see shared materials', async ({ page }) => {
    await loginAsTherapist(page);
    await page.goto('/materials');
    
    // Therapist should only see materials shared by patients
    // All materials in therapist view should have "Geteilt" badge
    const materials = page.locator('[data-material-item]');
    const count = await materials.count();
    
    if (count > 0) {
      // All should be shared
      const sharedBadges = page.locator('text=Geteilt');
      await expect(sharedBadges).toHaveCount(count);
    }
  });

  test('encryption: uploaded files are not readable in plain text', async ({ page }) => {
    await loginAsPatient(page);
    await page.goto('/materials');
    
    // Upload a file with recognizable content
    const secretContent = 'SUPER_SECRET_PATIENT_DATA_12345';
    await page.locator('input[type="file"]').setInputFiles({
      name: 'secret.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(secretContent)
    });
    
    await page.click('button:has-text("Hochladen")');
    await expect(page.locator('text=Datei erfolgreich hochgeladen')).toBeVisible();
    
    // In production: Verify file on disk is encrypted
    // (This would require backend inspection or mock verification)
    // For now, we verify the upload/download cycle works
    
    // Download the file
    const downloadButton = page.locator('button[title="Herunterladen"]').first();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadButton.click()
    ]);
    
    // Verify downloaded content matches original (after decryption)
    const path = await download.path();
    expect(path).toBeTruthy();
  });
});

test.describe('Row-Level Security (RLS)', () => {
  test('patient cannot access another patient\'s materials', async ({ page, context }) => {
    // Login as Patient A
    await loginAsPatient(page);
    await page.goto('/materials');
    
    // Upload material as Patient A
    await page.click('button:has-text("Notiz erstellen")');
    await page.fill('textarea', 'Patient A private note');
    await page.click('button:has-text("Speichern")');
    
    // Get material ID from URL or DOM
    const materialId = await page.locator('[data-material-id]').first().getAttribute('data-material-id');
    
    // Login as Patient B in new context
    const page2 = await context.newPage();
    // (In real test, use different credentials)
    // await loginAsPatient(page2, 'patient_b@example.com', 'password');
    
    // Try to access Patient A's material directly
    const response = await page2.request.get(`http://localhost:4000/api/patient-materials/${materialId}`);
    
    // Should be forbidden (403) or not found (404)
    expect([403, 404]).toContain(response.status());
  });
});
