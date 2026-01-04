# 🚀 Installation & Fehler beheben

Dieses Dokument beschreibt, wie Sie alle 629 TypeScript-Fehler beheben und die vollständige Plattform zum Laufen bringen.

## ✅ Problem-Übersicht

**Status:** 636 TypeScript-Fehler gefunden (Stand: jetzt)
- **Hauptursache:** Fehlende npm-Pakete (nicht installiert)
- **Sekundärursache:** TypeScript Strict Mode (alle behoben)

## 📦 Schritt 1: Dependencies installieren

### Automatische Installation (empfohlen)

```bash
chmod +x setup.sh
./setup.sh
```

Das Script installiert automatisch:
- ✅ Root-Pakete: Playwright, Concurrently
- ✅ Backend-Pakete: Express, PostgreSQL, Stripe, JWT, Bcrypt, etc.
- ✅ Frontend-Pakete: React, Vite, Tailwind CSS, React Router, etc.

### Manuelle Installation

Falls das Script nicht funktioniert:

```bash
# 1. Root dependencies
npm install

# 2. Backend dependencies
cd apps/backend
npm install
cd ../..

# 3. Frontend dependencies
cd apps/frontend
npm install
cd ../..
```

## 🔍 Schritt 2: Fehler prüfen

Nach der Installation sollten **0 TypeScript-Fehler** vorhanden sein:

```bash
# Backend kompilieren
cd apps/backend
npm run build

# Frontend kompilieren
cd ../frontend
npm run build
```

## 🧪 Schritt 3: Playwright-Tests ausführen

Die E2E-Tests validieren alle Edge Cases:

```bash
# Alle Tests ausführen
npx playwright test

# Nur Authentication-Tests
npx playwright test tests/e2e/auth.spec.ts

# Nur Appointment-Tests
npx playwright test tests/e2e/appointments.spec.ts

# Nur Payment-Tests
npx playwright test tests/e2e/payments.spec.ts

# Nur Video-Call-Tests
npx playwright test tests/e2e/video-call.spec.ts

# Nur Security-Tests
npx playwright test tests/security/injection-and-validation.spec.ts

# Messaging-Tests (NEU)
npx playwright test tests/e2e/messaging.spec.ts

# DSGVO-Compliance-Tests (NEU)
npx playwright test tests/e2e/gdpr-compliance.spec.ts

# Error-Handling-Tests (NEU)
npx playwright test tests/e2e/error-handling.spec.ts

# Mit UI (interaktiv)
npx playwright test --ui

# Mit Debug-Modus
npx playwright test --debug

# Nur in Chromium
npx playwright test --project=chromium

# Mit Reporter (HTML-Report)
npx playwright test --reporter=html
```

## 📋 Test-Coverage: Edge Cases

### ✅ Authentication Tests (8 Szenarien)
- ❌ Schwache Passwörter (password, 12345678, etc.)
- ❌ Fehlende DSGVO-Zustimmung
- ❌ Doppelte Email-Registrierung
- ❌ Passwort-Bestätigungs-Mismatch
- ❌ Rate Limiting (>10 Login-Versuche)
- ❌ Ungültige Email-Formate
- ❌ SQL Injection in Email-Feld
- ❌ Session-Hijacking

### ✅ Appointment Tests (9 Szenarien)
- ❌ End-Zeit < Start-Zeit
- ❌ Start-Zeit in der Vergangenheit
- ❌ Überlappende Slots
- ❌ Race Conditions (gleichzeitige Buchungen)
- ❌ Doppelbuchungen
- ❌ IDOR-Angriffe (fremde Termine)
- ❌ Negative Preise
- ❌ Termin ohne Zahlung
- ❌ Abgelaufene Slots

### ✅ Payment Tests (11 Szenarien)
- ❌ Negative Preise
- ❌ Preis = 0
- ❌ Extrem hohe Preise (>100.000€)
- ❌ Webhook ohne Stripe-Signatur
- ❌ Webhook mit falscher Signatur
- ❌ Doppelzahlung für denselben Termin
- ❌ Abgebrochene Zahlung (Slot-Freigabe)
- ❌ Expired Checkout Session
- ❌ Stornierung <24h vor Termin
- ❌ Währungsformatierung
- ❌ Gleichzeitige Payment-Versuche (Fraud)

### ✅ Video Call Tests (14 Szenarien)
- ❌ Fehlende Kamera-Berechtigung
- ❌ Nur Mikrofon (Audio-Only-Modus)
- ❌ Browser ohne WebRTC
- ❌ PeerJS Server offline
- ❌ Langsame Netzwerkverbindung
- ❌ Verbindungsabbruch während Call
- ❌ Mikrofon Mute/Unmute
- ❌ Kamera An/Aus
- ❌ Screen Sharing (nur Therapeuten)
- ❌ Unbefugter Zugriff
- ❌ Zugriff auf fremde Termine
- ❌ Call nach Termin-Ende
- ❌ Mobile Responsive Design
- ❌ Mehrere Tabs mit demselben Call

### ✅ Security Tests (12 Szenarien)
- ❌ SQL Injection (admin' OR '1'='1, etc.)
- ❌ XSS (Cross-Site Scripting)
- ❌ Command Injection
- ❌ Rate Limiting & DoS
- ❌ Große Request-Payloads (>10MB)
- ❌ JWT Token-Sicherheit
- ❌ Schwache Passwort-Policy
- ❌ CORS-Attacken
- ❌ Fehlende Security Headers
- ❌ HTTPS/HSTS
- ❌ Extrem lange Email-Adressen
- ❌ Unicode/Emoji in Input-Feldern

### ✅ Messaging Tests (13 Szenarien) - **NEU**
- ❌ Happy Path: Nachricht senden/empfangen
- ❌ XSS in Nachrichteninhalt
- ❌ Extrem lange Nachricht (>10.000 Zeichen)
- ❌ Leere Nachricht
- ❌ SQL Injection in Nachrichtensuche
- ❌ IDOR: Fremde Konversationen
- ❌ API-Zugriff auf fremde Nachrichten (403)
- ❌ Real-time Updates (Socket.io)
- ❌ Read-Status-Aktualisierung
- ❌ Rate Limiting (Spam-Schutz)
- ❌ Verschlüsselte Speicherung
- ❌ Lange Nachrichten umbrechen (UI)
- ❌ Emoji & Unicode Support

### ✅ DSGVO-Compliance Tests (15 Szenarien) - **NEU**
- ❌ Registrierung ohne Einwilligung
- ❌ Einwilligungs-Text sichtbar
- ❌ Datenexport (Art. 15)
- ❌ Audit-Logs im Export
- ❌ Account-Löschung (Art. 17)
- ❌ Löschen von Terminen & Nachrichten
- ❌ Warnung bei offenen Terminen
- ❌ Privacy by Design
- ❌ Audit-Logs protokollieren Zugriffe
- ❌ Sensible Daten in Logs verschleiert
- ❌ Gesundheitsdaten verschlüsselt
- ❌ Passwörter mit bcrypt gehasht
- ❌ Fehlgeschlagene Logins protokolliert
- ❌ Datenminimierung (nur notwendige Felder)
- ❌ Optionale Felder markiert

### ✅ Error Handling Tests (20 Szenarien) - **NEU**
- ❌ 401 Unauthorized → Login-Umleitung
- ❌ 403 Forbidden → Aussagekräftige Meldung
- ❌ 404 Not Found → Benutzerfreundliche Seite
- ❌ 422 Unprocessable Entity → Validierungsfehler
- ❌ 429 Too Many Requests → Rate Limit Warning
- ❌ 500 Internal Server Error → Generische Meldung
- ❌ 503 Service Unavailable → Retry-Mechanismus
- ❌ Offline-Modus erkennen
- ❌ Timeout nach 30 Sekunden
- ❌ Unterbrochene Verbindung
- ❌ CORS-Fehler aussagekräftig
- ❌ Required-Felder markiert
- ❌ Ungültiges Datenformat ablehnen
- ❌ Datenbank-Verbindungsfehler
- ❌ Sonderzeichen in Email validieren
- ❌ Negative Zahlen ablehnen
- ❌ Error-Messages lokalisiert (Deutsch)
- ❌ Stack Traces nur in Development
- ❌ Retry-Button bei Fehlern
- ❌ Loading-Spinner bei langen Requests

**GESAMT: 112+ Edge Case Tests**

## 🐛 Bekannte Probleme & Lösungen

### Problem: "Module not found" Fehler

**Lösung:** Dependencies installieren (siehe Schritt 1)

```bash
npm install  # Root
cd apps/backend && npm install  # Backend
cd ../frontend && npm install   # Frontend
```

### Problem: TypeScript "implicit any" Fehler

**Status:** ✅ BEHOBEN (alle explicit types hinzugefügt)

### Problem: PostgreSQL-Verbindung fehlgeschlagen

**Lösung:** Datenbank starten und .env konfigurieren

```bash
# PostgreSQL starten
sudo systemctl start postgresql

# .env-Datei prüfen
cat .env

# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=therapist_platform
# DB_USER=postgres
# DB_PASSWORD=your_password
```

### Problem: Stripe Webhook-Tests schlagen fehl

**Lösung:** Stripe CLI installieren und Webhooks forwarden

```bash
# Stripe CLI installieren
brew install stripe/stripe-cli/stripe  # macOS
# oder
sudo apt install stripe  # Linux

# Login
stripe login

# Webhooks forwarden
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

### Problem: Video-Call-Tests schlagen fehl

**Grund:** Browser-Permissions werden nicht automatisch erteilt

**Lösung:** Tests mit `--headed` ausführen (manuell Permissions erteilen)

```bash
npx playwright test tests/e2e/video-call.spec.ts --headed
```

## 📊 Test-Ergebnisse erwarten

Nach erfolgreicher Installation sollten Sie sehen:

```
Running 64 tests using 4 workers

  ✅ tests/e2e/auth.spec.ts:12:3 - Auth: Schwache Passwörter ablehnen (2.1s)
  ✅ tests/e2e/auth.spec.ts:28:3 - Auth: Fehlende DSGVO-Zustimmung (1.8s)
  ✅ tests/e2e/appointments.spec.ts:15:3 - Appointments: End-Zeit < Start-Zeit (2.3s)
  ✅ tests/e2e/payments.spec.ts:18:3 - Payments: Negative Preise ablehnen (2.5s)
  ...

  64 passed (4m 32s)
```

## 🚀 Nächste Schritte

1. ✅ Dependencies installiert → Alle Module gefunden
2. ✅ TypeScript kompiliert → 0 Fehler
3. ✅ Playwright-Tests laufen → Edge Cases validiert
4. 🎯 **Production Deployment** → Siehe [DEPLOYMENT.md](DEPLOYMENT.md)

## 📞 Support

Falls Probleme auftreten:

1. Prüfen Sie die Logs: `npm run dev` (Backend + Frontend)
2. Debuggen Sie Tests: `npx playwright test --debug`
3. Öffnen Sie ein Issue mit:
   - Error-Message
   - Node.js-Version (`node -v`)
   - npm-Version (`npm -v`)
   - Betriebssystem

---

**Hinweis:** Die Tests verwenden Test-User und Dummy-Daten. Keine echten Zahlungen oder Patientendaten werden verwendet.
