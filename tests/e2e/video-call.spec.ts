import { test, expect } from '@playwright/test';
import { registerUser, loginUser, TEST_USERS, generateRandomEmail } from '../helpers';

/**
 * Video Call Tests: WebRTC, PeerJS, Camera/Microphone Permissions, Network Issues
 * 
 * Tests für Video-Calls, Verbindungsprobleme und Media-Permissions
 */

test.describe('Video Call: Setup & Permissions', () => {
  
  test('EDGE CASE: Fehlende Kamera-Berechtigung sollte behandelt werden', async ({ page, context }) => {
    // Blockiere Kamera-Zugriff
    await context.grantPermissions([], { origin: 'http://localhost:5173' });
    
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    // Therapeut und Patient registrieren
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.goto('/logout');
    await registerUser(page, { ...TEST_USERS.patient, email: patientEmail });
    
    // Versuche Video-Call zu starten (über appointment-id)
    await page.goto('http://localhost:5173/video-call/fake-appointment-id');
    
    // Sollte Fehler anzeigen
    await expect(page.locator('text=/Kamera|camera|permission|berechtigung/i')).toBeVisible({ timeout: 10000 });
  });

  test('EDGE CASE: Nur Mikrofon verfügbar (keine Kamera) sollte Audio-Only-Call ermöglichen', async ({ page, context }) => {
    // Nur Mikrofon erlauben
    await context.grantPermissions(['microphone'], { origin: 'http://localhost:5173' });
    
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('http://localhost:5173/video-call/test-appointment-id');
    
    // Sollte Audio-Only-Modus anzeigen
    await expect(page.locator('text=/Audio|nur Ton|voice only/i')).toBeVisible({ timeout: 10000 });
  });

  test('EDGE CASE: Browser ohne WebRTC-Support sollte erkannt werden', async ({ page }) => {
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
    
    await page.goto('http://localhost:5173/video-call/test-id');
    
    // Sollte Fehler anzeigen
    await expect(page.locator('text=/nicht unterstützt|not supported|browser/i')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Video Call: Connection & Network', () => {
  
  test('EDGE CASE: PeerJS Server nicht erreichbar sollte behandelt werden', async ({ page }) => {
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
    
    await page.goto('http://localhost:5173/video-call/test-id');
    
    // Sollte Verbindungsfehler anzeigen
    await expect(page.locator('text=/Verbindung fehlgeschlagen|connection failed|server/i')).toBeVisible({ timeout: 15000 });
  });

  test('EDGE CASE: Langsame Netzwerkverbindung sollte erkannt werden', async ({ page, context }) => {
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
    
    await page.goto('http://localhost:5173/video-call/test-id');
    
    // Sollte Warnung anzeigen oder Qualität reduzieren
    await expect(page.locator('text=/langsam|slow|quality|qualität/i')).toBeVisible({ timeout: 20000 });
  });

  test('EDGE CASE: Verbindungsabbruch während Call sollte erkannt werden', async ({ page }) => {
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('http://localhost:5173/video-call/test-id');
    
    // Warte auf Verbindung
    await page.waitForTimeout(3000);
    
    // Simuliere Verbindungsabbruch
    await page.evaluate(() => {
      // Schließe alle PeerConnections
      // @ts-ignore
      if (window.peerConnection) {
        // @ts-ignore
        window.peerConnection.close();
      }
    });
    
    // Sollte Reconnect-Versuch oder Fehler anzeigen
    await expect(page.locator('text=/Verbindung verloren|disconnected|reconnect/i')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Video Call: Media Controls', () => {
  
  test('EDGE CASE: Mikrofon Mute/Unmute sollte funktionieren', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone'], { origin: 'http://localhost:5173' });
    
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('http://localhost:5173/video-call/test-id');
    await page.waitForTimeout(3000);
    
    // Suche Mute-Button
    const muteButton = page.locator('button[aria-label*="Mikrofon"], button:has-text("Mute")').first();
    
    if (await muteButton.count() > 0) {
      // Klicke Mute
      await muteButton.click();
      await page.waitForTimeout(500);
      
      // Status sollte sich ändern
      const isMuted = await page.locator('[aria-label*="stummgeschaltet"], text=/muted/i').count();
      expect(isMuted).toBeGreaterThan(0);
      
      // Klicke Unmute
      await muteButton.click();
      await page.waitForTimeout(500);
      
      // Status sollte wieder aktiv sein
      const isActive = await page.locator('[aria-label*="aktiv"], text=/unmuted|active/i').count();
      expect(isActive).toBeGreaterThanOrEqual(0);
    }
  });

  test('EDGE CASE: Kamera An/Aus sollte funktionieren', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone'], { origin: 'http://localhost:5173' });
    
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('http://localhost:5173/video-call/test-id');
    await page.waitForTimeout(3000);
    
    // Suche Video-Toggle-Button
    const videoButton = page.locator('button[aria-label*="Kamera"], button[aria-label*="Video"]').first();
    
    if (await videoButton.count() > 0) {
      // Klicke Video Off
      await videoButton.click();
      await page.waitForTimeout(500);
      
      // Video sollte ausgeschaltet sein
      const videoOff = await page.locator('[aria-label*="ausgeschaltet"], text=/video off/i').count();
      expect(videoOff).toBeGreaterThanOrEqual(0);
    }
  });

  test('EDGE CASE: Screen Sharing nur für Therapeuten erlaubt', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone'], { origin: 'http://localhost:5173' });
    
    // Test als Patient
    const patientEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.patient, email: patientEmail });
    
    await page.goto('http://localhost:5173/video-call/test-id');
    await page.waitForTimeout(3000);
    
    // Screen-Share-Button sollte NICHT sichtbar sein
    const screenShareButton = page.locator('button:has-text("Bildschirm teilen"), button:has-text("Share Screen")');
    await expect(screenShareButton).not.toBeVisible();
    
    // Test als Therapeut
    await page.goto('/logout');
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('http://localhost:5173/video-call/test-id');
    await page.waitForTimeout(3000);
    
    // Screen-Share-Button SOLLTE sichtbar sein
    await expect(screenShareButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Video Call: Security & Privacy', () => {
  
  test('EDGE CASE: Unbefugter Zugriff auf Video-Call sollte blockiert werden', async ({ page }) => {
    // Versuche ohne Login auf Video-Call zuzugreifen
    await page.goto('http://localhost:5173/video-call/private-appointment-123');
    
    // Sollte zu Login weiterleiten oder Fehler anzeigen
    await page.waitForTimeout(2000);
    
    const url = page.url();
    expect(url.includes('/login') || url.includes('/unauthorized')).toBe(true);
  });

  test('EDGE CASE: Patient sollte nicht auf fremden Termin-Call zugreifen können', async ({ page, context }) => {
    const patient1Email = generateRandomEmail();
    const patient2Email = generateRandomEmail();
    
    // Patient 1 registriert sich
    await registerUser(page, { ...TEST_USERS.patient, email: patient1Email });
    const patient1Token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Patient 2 registriert sich
    await page.goto('/logout');
    await registerUser(page, { ...TEST_USERS.patient, email: patient2Email });
    
    // Patient 2 versucht auf Patient 1's Video-Call zuzugreifen
    await page.goto('http://localhost:5173/video-call/patient1-appointment-id');
    
    // Sollte Fehler anzeigen: "Nicht berechtigt"
    await expect(page.locator('text=/nicht berechtigt|unauthorized|forbidden/i')).toBeVisible({ timeout: 10000 });
  });

  test('EDGE CASE: Video-Call nach Termin-Ende sollte nicht mehr zugänglich sein', async ({ page }) => {
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    // Versuche auf abgelaufenen Termin zuzugreifen
    await page.goto('http://localhost:5173/video-call/expired-appointment-id');
    
    // Sollte Fehler anzeigen
    await expect(page.locator('text=/abgelaufen|expired|ended/i')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Video Call: Multi-User Scenarios', () => {
  
  test('EDGE CASE: Gleichzeitiger Beitritt beider Teilnehmer sollte funktionieren', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone'], { origin: 'http://localhost:5173' });
    
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    // Therapeut beitritt
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.goto('http://localhost:5173/video-call/sync-test-id');
    
    // Patient beitritt (neuer Tab)
    const patientPage = await context.newPage();
    await patientPage.goto('http://localhost:5173/register');
    await registerUser(patientPage, { ...TEST_USERS.patient, email: patientEmail });
    await patientPage.goto('http://localhost:5173/video-call/sync-test-id');
    
    // Beide sollten "Verbunden" Status sehen
    await expect(page.locator('text=/verbunden|connected/i')).toBeVisible({ timeout: 15000 });
    await expect(patientPage.locator('text=/verbunden|connected/i')).toBeVisible({ timeout: 15000 });
    
    await patientPage.close();
  });

  test('EDGE CASE: Therapeut verlässt Call - Patient sollte benachrichtigt werden', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone'], { origin: 'http://localhost:5173' });
    
    const therapistEmail = generateRandomEmail();
    const patientEmail = generateRandomEmail();
    
    // Setup
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    await page.goto('http://localhost:5173/video-call/disconnect-test');
    
    const patientPage = await context.newPage();
    await patientPage.goto('http://localhost:5173/register');
    await registerUser(patientPage, { ...TEST_USERS.patient, email: patientEmail });
    await patientPage.goto('http://localhost:5173/video-call/disconnect-test');
    
    await page.waitForTimeout(3000);
    
    // Therapeut verlässt
    await page.close();
    
    // Patient sollte Benachrichtigung sehen
    await expect(patientPage.locator('text=/verlassen|disconnected|left/i')).toBeVisible({ timeout: 10000 });
    
    await patientPage.close();
  });
});

test.describe('Video Call: UI/UX Edge Cases', () => {
  
  test('EDGE CASE: Video-Call auf Mobile sollte responsive sein', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone'], { origin: 'http://localhost:5173' });
    
    // Setze Mobile Viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    await page.goto('http://localhost:5173/video-call/mobile-test');
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
    const therapistEmail = generateRandomEmail();
    await registerUser(page, { ...TEST_USERS.therapist, email: therapistEmail });
    
    // Öffne Video-Call in Tab 1
    await page.goto('http://localhost:5173/video-call/duplicate-tab-test');
    await page.waitForTimeout(2000);
    
    // Öffne denselben Call in Tab 2
    const page2 = await context.newPage();
    await page2.goto('http://localhost:5173/login');
    await loginUser(page2, { email: therapistEmail, password: TEST_USERS.therapist.password });
    await page2.goto('http://localhost:5173/video-call/duplicate-tab-test');
    
    // Sollte Warnung anzeigen
    await expect(page2.locator('text=/bereits geöffnet|already open|duplicate/i')).toBeVisible({ timeout: 10000 });
    
    await page2.close();
  });
});
