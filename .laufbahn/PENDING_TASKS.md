# 📋 PENDING TASKS - For Future Implementation

> **Absoluter Pfad:** `/workspaces/abu-abad/.laufbahn/PENDING_TASKS.md`  
> **Erstellt:** 2026-01-20  
> **Letzte Aktualisierung:** 2026-01-21 12:00 UTC  
> **Zweck:** Nicht-fertige Features für spätere Implementierung

---

## ✅ ERLEDIGTE TASKS

### ~~Task 2: Fehlende Übersetzungen (18 Sprachen)~~ ✅ ERLEDIGT
**Status:** Alle 20 Sprachen haben privacy.json

### ~~Task 3: Alle Pages i18n-fähig machen~~ ✅ ERLEDIGT
**Status:** pages.json existiert jetzt in allen 20 Sprachen (fa, kmr, ckb hinzugefügt)

### ~~Task 4: Code-Splitting~~ ✅ ERLEDIGT
**Status:** vite.config.ts mit manualChunks (react/i18n/ui/video/query/date/stripe)

### ~~Task 5: ESLint Warnings fixen~~ ✅ ERLEDIGT
**Status:** Kritische Warnings (unused-vars, react-hooks) in 4 Dateien gefixt

### ~~Task 7: E2E Tests erstellen~~ ✅ ERLEDIGT
**Status:** tests/i18n.spec.ts + tests/auth.spec.ts erstellt

### ~~Task 8: 20. Sprache Portugiesisch~~ ✅ ERLEDIGT
**Status:** pt/ Ordner mit allen Locale-Files existiert

### ~~Task 9: LanguageSwitcher UI~~ ✅ ERLEDIGT
**Status:** Flags + Dropdown + RTL-Indikatoren bereits implementiert

### ~~Task 6: Backend Tests ausführen + Coverage~~ ✅ ERLEDIGT (2026-01-21)
**Status:** 24/26 Tests bestanden, 2 OCR-Tests übersprungen (Binaries fehlen)  
**Dateien:** `apps/backend/src/utils/*.test.ts`, `apps/backend/vitest.config.ts`  
**Ergebnis:**
```
✓ apps/backend/src/utils/encryption.test.ts (8 tests)
✓ apps/backend/src/utils/gdpr.test.ts (5 tests)
✓ apps/backend/src/utils/validators.test.ts (8 tests)
✓ apps/backend/src/utils/pdfGenerator.test.ts (3 tests)
○ apps/backend/src/utils/ocr.test.ts (2 skipped - missing tesseract/pdftoppm)
```

### ~~Task 14: Logging ohne PII~~ ✅ ERLEDIGT (2026-01-23)
**Status:** console.log entfernt, Logger redigiert PII in Dev + Prod  
**Dateien:** `apps/backend/src/utils/logger.ts`, `apps/backend/src/database/seed_doctor_demo.ts`, `apps/backend/scripts/copy-assets.mjs`

---

## 🔴 HIGH PRIORITY (Nach Deployment)

### 1. Backend Deployment auf Railway
**Status:** Config vorhanden, manuelles Deployment nötig  
**Dateien:** `railway.json`, `apps/backend/Procfile`  
**Schritte:**
- Railway CLI installieren + login
- PostgreSQL Database provisionieren
- Environment Variables setzen (siehe TESTING_LINKS.md)
- Migration ausführen
- Health-Check testen

**Blocker:** Keine - kann sofort nach Frontend-Deploy gemacht werden

---

## 🟡 MEDIUM PRIORITY

### E2E Tests ausführen (Auth + i18n)
**Status:** Tests erstellt, Ausführung manuell (Codespace-Limitierung)  
**Dateien:** `tests/auth.spec.ts`, `tests/i18n.spec.ts`  
**Anleitung:**
```bash
# Terminal 1: Services starten
./start-local-test.sh

# Terminal 2: Tests ausführen (nach 10s warten)
cd /workspaces/abu-abad
PLAYWRIGHT_BASE_URL=http://localhost:5175 npx playwright test tests/auth.spec.ts tests/i18n.spec.ts --reporter=list
```
**Bekannt:** In Codespace sind Background-Services instabil (SIGINT). Daher manueller Start nötig.

**Aufwand:** 5min (manuell)

---

## 🟢 LOW PRIORITY

### 10. CORS-Konfiguration finalisieren
**Status:** Wildcard in Dev, Whitelist-basiert in Prod  
**Dateien:** `apps/backend/src/middleware/cors.ts`  
**TODO:**
- Frontend-URL nach Deployment in Backend ENV setzen
- Railway ALLOWED_ORIGINS Variable updaten
- Testen von mehreren Frontend-URLs (z.B. Preview-Branches)

**Aufwand:** 15min (nach Deployment)

---

### 11. Stripe Webhook Implementation
**Status:** Placeholder vorhanden, nicht getestet  
**Dateien:** `apps/backend/src/routes/stripe.ts`  
**TODO:**
- Webhook-Endpunkt registrieren bei Stripe
- STRIPE_WEBHOOK_SECRET setzen
- Event-Handling testen (payment_intent.succeeded, etc.)

**Aufwand:** 1h

---

### 12. PeerJS Server Integration
**Status:** Config vorhanden, nicht deployed  
**Dateien:** `apps/backend/src/routes/peerjs.ts`  
**TODO:**
- PeerJS Server in Backend starten (Port 9001)
- Health-Check für PeerJS
- Frontend VITE_PEER_SERVER_* Variables setzen

**Aufwand:** 30min

---

### 13. Database Migration Testing
**Status:** Migrations existieren, nicht gegen Remote-DB getestet  
**Dateien:** `apps/backend/src/database/migrations/*.sql`  
**TODO:**
- Railway PostgreSQL provisioniert
- Migration ausführen: `railway run npm run migrate`
- Seed-Daten: `railway run npm run seed`
- Verifizieren: Tabellen existieren

**Aufwand:** 15min

---

---

### 15. Security Headers Audit
**Status:** Helmet konfiguriert, nicht gegen Produktion getestet  
**Dateien:** `apps/backend/src/middleware/security.ts`  
**TODO:**
- securityheaders.com Scan
- CSP-Nonce für Inline-Scripts
- HSTS Header (nach HTTPS-Deployment)

**Aufwand:** 30min

---

## 📊 SUMMARY

| Priorität | Anzahl Tasks | Geschätzter Aufwand |
|-----------|--------------|---------------------|
| 🔴 HIGH | 3 | 6-8h |
| 🟡 MEDIUM | 5 | 5-7h |
| 🟢 LOW | 7 | 4-6h |
| **TOTAL** | **15** | **15-21h** |

---

## 🎯 NÄCHSTE SCHRITTE (In Reihenfolge)

1. **SOFORT:** Git commit + merge + Netlify Deploy → Testing
2. **TAG 1:** Backend Railway Deploy + DB Migration
3. **TAG 2:** Privacy-Texte 18 Sprachen übersetzen
4. **TAG 3:** Alle Pages i18n-fähig machen
5. **TAG 4-5:** Tests + Code-Splitting + Security Audit

---

**Status:** Diese Datei wird nach jedem abgeschlossenen Task aktualisiert.
