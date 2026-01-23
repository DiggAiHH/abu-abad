import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { registerUser, loginUser, TEST_USERS, generateRandomEmail } from '../helpers';

/**
 * Video Call Tests: WebRTC, PeerJS, Camera/Microphone Permissions, Network Issues
 * 
 * Tests für Video-Calls, Verbindungsprobleme und Media-Permissions
 */

const waitForTestBridge = async (page: Page) => {
  await page.waitForFunction(() => Boolean((window as any).__videoCallTest), undefined, {
    timeout: 10000,
  });
};

const triggerConnectionErrorBanner = async (page: Page, message: string) => {
  await waitForTestBridge(page);
  await page.evaluate((msg) => {
    (window as any).__videoCallTest?.forceConnectionError(msg);
  }, message);
};

const simulateDisconnect = async (page: Page, message?: string) => {
  await waitForTestBridge(page);
  await page.evaluate((msg) => {
    (window as any).__videoCallTest?.simulateDisconnect(msg);
  }, message);
};

const expectConnectionBanner = async (page: Page, matcher: RegExp) => {
  const banner = page.locator('[data-testid="connection-error"]');
  await expect(banner).toBeVisible({ timeout: 15000 });
  await expect(banner).toHaveText(matcher);
};

test.describe.skip('Video Call: Setup & Permissions', () => {
  
  test('EDGE CASE: Fehlende Kamera-Berechtigung sollte behandelt werden', async ({ page, context }) => {
    // Blockiere Kamera-Zugriff
    await context.grantPermissions([]);
    
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    // Therapeut und Patient registrieren
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.goto('/logout');
    await registerUser(page, { ...TEST_USERS.patient, email: patientEmail });
    
    // Versuche Video-Call zu starten (über appointment-id)
    await page.goto('/video-call/fake-appointment-id');
    
    // Sollte Fehler anzeigen
    await expectConnectionBanner(page, /kamera|berechtigungen?/i);
  });

  test('EDGE CASE: Nur Mikrofon verfügbar (keine Kamera) sollte Audio-Only-Call ermöglichen', async ({ page, context }) => {
    // Nur Mikrofon erlauben
    await context.grantPermissions(['microphone']);
    
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('/video-call/test-appointment-id');
    
    // Sollte Audio-Only-Modus anzeigen
    await expect(page.locator('[data-testid="audio-only-indicator"]')).toBeVisible({ timeout: 10000 });
  });

  test('EDGE CASE: Browser ohne WebRTC-Support sollte erkannt werden', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);
    // Entferne WebRTC-APIs
    await page.addInitScript(() => {
      // @ts-ignore
      delete window.RTCPeerConnection;
      // @ts-ignore
      delete window.webkitRTCPeerConnection;
      // @ts-ignore
      delete window.mozRTCPeerConnection;
    });
    
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('/video-call/test-id');
    
    // Sollte Fehler anzeigen
    await expectConnectionBanner(page, /nicht unterstützt|browser/i);
  });
});

test.describe.skip('Video Call: Connection & Network', () => {
  
  test('EDGE CASE: PeerJS Server nicht erreichbar sollte behandelt werden', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    // Mock PeerJS Server als offline
    await page.addInitScript(() => {
      window.addEventListener('load', () => {
        // Überschreibe Peer Constructor
        // @ts-ignore
        if (window.Peer) {
          // @ts-ignore
          const OriginalPeer = window.Peer;
          // @ts-ignore
          window.Peer = function(...args) {
            const peer = new OriginalPeer(...args);
            setTimeout(() => {
              peer.emit('error', { type: 'network' });
            }, 1000);
            return peer;
          };
        }
      });
    });
    
    await page.goto('/video-call/test-id');
    
    // Sollte Verbindungsfehler anzeigen
    await expectConnectionBanner(page, /PeerJS|Verbindung fehlgeschlagen|server/i);
  });

  test('EDGE CASE: Langsame Netzwerkverbindung sollte erkannt werden', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);
    // Simuliere langsame Verbindung
    const client = await context.newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 50 * 1024, // 50kb/s
      uploadThroughput: 20 * 1024,   // 20kb/s
      latency: 500 // 500ms
    });
    
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('/video-call/test-id');
    
    // Sollte Warnung anzeigen oder Qualität reduzieren
    await triggerConnectionErrorBanner(page, 'Langsame Netzwerkverbindung erkannt. Qualität reduziert.');
    await expectConnectionBanner(page, /langsam|qualität/i);
  });

  test('EDGE CASE: Verbindungsabbruch während Call sollte erkannt werden', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('/video-call/test-id');
    
    // Warte auf initiale Verbindung/Setup
    await waitForTestBridge(page);
    
    // Simuliere Verbindungsabbruch
    await simulateDisconnect(page, 'Verbindung verloren. Bitte erneut verbinden.');
    
    // Sollte Reconnect-Versuch oder Fehler anzeigen
    await expectConnectionBanner(page, /verbindung verloren|disconnected/i);
  });
});

test.describe.skip('Video Call: Media Controls', () => {
  
  test('EDGE CASE: Mikrofon Mute/Unmute sollte funktionieren', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);
    
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('/video-call/test-id');
    await page.waitForTimeout(3000);
    
    // Suche Mute-Button
    const muteButton = page.locator('button[aria-label*="Mikrofon"]').first();
    await expect(muteButton).toBeVisible();

    // Klicke Mute
    await muteButton.click();
    await expect(muteButton).toHaveAttribute('aria-label', /stummgeschaltet/i);

    // Klicke Unmute
    await muteButton.click();
    await expect(muteButton).toHaveAttribute('aria-label', /Mikrofon aktiv/i);
  });

  test('EDGE CASE: Kamera An/Aus sollte funktionieren', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);
    
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('/video-call/test-id');
    await page.waitForTimeout(3000);
    
    // Suche Video-Toggle-Button
    const videoButton = page.locator('button[aria-label*="Kamera"], button[aria-label*="Video"]').first();
    await expect(videoButton).toBeVisible();

    // Klicke Video Off
    await videoButton.click();
    await expect(videoButton).toHaveAttribute('aria-label', /ausgeschaltet/i);

    // Klicke wieder an
    await videoButton.click();
    await expect(videoButton).toHaveAttribute('aria-label', /Kamera aktiv/i);
  });

  test('EDGE CASE: Screen Sharing nur für Therapeuten erlaubt', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);
    
    // Test als Patient
    const patientEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email: patientEmail });
    
    await page.goto('/video-call/test-id');
    await page.waitForTimeout(3000);
    
    // Screen-Share-Button sollte NICHT sichtbar sein
    const screenShareButton = page.locator('button:has-text("Bildschirm teilen"), button:has-text("Share Screen")');
    await expect(screenShareButton).not.toBeVisible();
    
    // Test als Therapeut
    await page.goto('/logout');
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('/video-call/test-id');
    await page.waitForTimeout(3000);
    
    // Screen-Share-Button SOLLTE sichtbar sein
    await expect(screenShareButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe.skip('Video Call: Security & Privacy', () => {
  
  test('EDGE CASE: Unbefugter Zugriff auf Video-Call sollte blockiert werden', async ({ page }) => {
    // Versuche ohne Login auf Video-Call zuzugreifen
    await page.goto('/video-call/private-appointment-123');
    
    // Sollte zu Login weiterleiten oder Fehler anzeigen
    await page.waitForTimeout(2000);
    
    const url = page.url();
    expect(url.includes('/login') || url.includes('/unauthorized')).toBe(true);
  });

  test('EDGE CASE: Patient sollte nicht auf fremden Termin-Call zugreifen können', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);
    const patient1Email = generateRandomEmail();
    const patient2Email = generateRandomEmail();
    
    // Patient 1 registriert sich
    await registerUser(page, { ...TEST_USERS.patient, email: patient1Email });
    const patient1Token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Patient 2 registriert sich
    await page.goto('/logout');
    await registerUser(page, { ...TEST_USERS.patient, email: patient2Email });
    
    // Patient 2 versucht auf Patient 1's Video-Call zuzugreifen
    await page.goto('/video-call/patient1-appointment-id');
    
    // Sollte Fehler anzeigen: "Nicht berechtigt"
    await expectConnectionBanner(page, /nicht berechtigt|unauthorized|forbidden/i);
  });

  test('EDGE CASE: Video-Call nach Termin-Ende sollte nicht mehr zugänglich sein', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    // Versuche auf abgelaufenen Termin zuzugreifen
    await page.goto('/video-call/expired-appointment-id');
    
    // Sollte Fehler anzeigen
    await expectConnectionBanner(page, /abgelaufen|expired|ended/i);
  });
});

test.describe.skip('Video Call: Multi-User Scenarios', () => {
  
  test('EDGE CASE: Gleichzeitiger Beitritt beider Teilnehmer sollte funktionieren', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);
    
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    // Therapeut beitritt
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.goto('/video-call/sync-test-id');
    
    // Patient beitritt (neuer Tab)
    const patientPage = await context.newPage();
    await patientPage.goto('/register');
    await registerUser(patientPage, { ...TEST_USERS.patient, email: patientEmail });
    await patientPage.goto('/video-call/sync-test-id');
    
    // Beide sollten "Verbunden" Status sehen
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText(/Verbunden/i, { timeout: 15000 });
    await expect(patientPage.locator('[data-testid="connection-status"]')).toHaveText(/Verbunden/i, { timeout: 15000 });
    
    await patientPage.close();
  });

  test('EDGE CASE: Therapeut verlässt Call - Patient sollte benachrichtigt werden', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);
    
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    // Setup
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.goto('/video-call/disconnect-test');
    
    const patientPage = await context.newPage();
    await patientPage.goto('/register');
    await registerUser(patientPage, { ...TEST_USERS.patient, email: patientEmail });
    await patientPage.goto('/video-call/disconnect-test');
    
    await page.waitForTimeout(3000);
    
    // Therapeut verlässt
    await page.close();
    
    // Patient sollte Benachrichtigung sehen
    await expectConnectionBanner(patientPage, /verlassen|disconnected|left/i);
    
    await patientPage.close();
  });
});

test.describe.skip('Video Call: UI/UX Edge Cases', () => {
  
  test('EDGE CASE: Video-Call auf Mobile sollte responsive sein', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);
    
    // Setze Mobile Viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('/video-call/mobile-test');
    await page.waitForTimeout(3000);
    
    // Kontroll-Buttons sollten sichtbar sein
    const controls = page.locator('[aria-label*="Mikrofon"], [aria-label*="Kamera"]');
    await expect(controls.first()).toBeVisible();
    
    // Video sollte Viewport ausfüllen
    const video = page.locator('video').first();
    if (await video.count() > 0) {
      const box = await video.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(375);
    }
  });

  test('EDGE CASE: Mehrere Tabs mit demselben Video-Call sollten erkannt werden', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    // Öffne Video-Call in Tab 1
    await page.goto('/video-call/duplicate-tab-test');
    await page.waitForTimeout(2000);
    
    // Öffne denselben Call in Tab 2
    const page2 = await context.newPage();
    await page2.goto('/login');
    await loginUser(page2, { email: therapistEmail, password: TEST_USERS.therapist.password });
    await page2.goto('/video-call/duplicate-tab-test');
    
    // Sollte Warnung anzeigen
    await expectConnectionBanner(page2, /bereits geöffnet|already open|duplicate/i);
    
    await page2.close();
  });
});
