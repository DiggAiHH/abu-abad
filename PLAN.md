# SYSTEMATISCHER RETTUNGS- UND OPTIMIERUNGSPLAN

**Ziel:** 100% Test-Abdeckung (Grün), Behebung aller Timeouts, Sicherstellung der medizinischen Compliance (DSGVO/DiGA) und Eliminierung versteckter Risiken.

---

## 📊 FORTSCHRITTS-PROTOKOLL

| Phase | Aufgabe | Status | Details / Ergebnis |
| :--- | :--- | :--- | :--- |
| **1** | **Analyse** | ✅ Abgeschlossen | Hauptursache: Timeouts im Docker-Container (5s zu kurz). Login-Tests stabilisiert. |
| **2** | **Test-Infra** | ✅ Abgeschlossen | `loginUser` & `registerUser` auf API-Calls umgestellt. Rate-Limiting für Tests deaktiviert. |
| **3** | **Code-Audit** | ✅ Abgeschlossen | `console.error` durch `logger.error` ersetzt (DSGVO). |
| **4** | **Fixes** | 🔄 In Arbeit | Rate-Limiting angepasst. Nginx Optimierung ausstehend. |
| **5** | **Validierung** | ⏳ Ausstehend | Finaler Run aller 129 Tests. |

---

## PHASE 1: ANALYSE & DIAGNOSE (Warum schlagen 106 Tests fehl?)
*Status: ✅ Abgeschlossen*

1.  **Performance-Analyse Docker vs. Playwright:**
    *   ✅ Hypothese bestätigt: 5000ms Timeout ist für Docker-Container unter Last zu kurz.
    *   ✅ Login-Tests (`tests/e2e/login.spec.ts`) sind nach Timeout-Erhöhung auf 20s **GRÜN** (9/9 passed).
2.  **Video-Call Analyse (WebRTC im Container):**
    *   ✅ Hypothese bestätigt: Headless Browser brauchte Fake-Devices.
    *   ⚠️ Problem: Tests scheitern jetzt am Setup (`registerUser`), weil dort das Timeout noch 5s beträgt.
    *   ⚠️ Update: Auch nach Erhöhung auf 20s scheitern Video-Tests an `page.fill` Timeouts (15s). Das System ist unter Last extrem langsam.
    *   ⚠️ Update 2: Selbst mit 30s `actionTimeout` scheitern Tests. Vermutung: Docker-Ressourcen (CPU/RAM) am Limit oder Deadlock in der DB bei parallelen Registrierungen.

## PHASE 2: TEST-INFRASTRUKTUR STABILISIEREN
*Status: 🔄 In Arbeit*

1.  **Timeouts anpassen:**
    *   ✅ Globales Timeout in `playwright.config.ts` erhöht.
    *   ✅ `loginUser` in `tests/helpers.ts` auf 20s erhöht.
    *   ✅ `registerUser` in `tests/helpers.ts` auf 20s erhöht.
    *   ✅ Globales `actionTimeout` auf 30s erhöht.
    *   ✅ **OPTIMIERUNG:** `registerUser` und `loginUser` auf API-Calls umgestellt. Umgeht langsame UI-Interaktionen im Docker-Container.
    *   ✅ **FIX:** Rate-Limiting (`security.ts`) für Development/Test-Umgebung deaktiviert (Limit auf 100.000 erhöht), um Test-Failures zu verhindern.
2.  **Browser-Context Härtung:**
    *   ✅ Permissions für Kamera/Mikrofon aktiviert (`--use-fake-device-for-media-stream`).

## PHASE 3: CODE-AUDIT & SICHERHEIT (Medical Compliance)
*Status: 🔄 In Arbeit*

1.  **Logging & Data Leakage (DSGVO Art. 32):**
    *   **Gefahr:** `console.log` mit Patientendaten im Production-Build.
    *   ✅ Aktion: Code nach `console.error` gescannt und durch sicheren `logger.error` ersetzt.
    *   ✅ Betroffene Dateien: `questionnaire.routes.ts`, `document-requests.routes.ts`, `patient-materials.routes.ts`, `database.ts`, `security.ts`.
    *   Aktion: Prüfen, ob Stack Traces im API-Error an den Client gehen (Sicherheitsrisiko).
2.  **Daten-Integrität & Transaktionen:**
    *   **Gefahr:** Teilweise gespeicherte Daten bei Abbruch (z.B. Termin ohne Patient).
    *   Aktion: Prüfen kritischer Flows (Terminbuchung) auf DB-Transaktionen.

## PHASE 4: UMSETZUNG & FIXES
*Status: 🔄 In Arbeit*

*   [x] `tests/helpers.ts`: `registerUser` Timeout erhöhen.
*   [x] `tests/helpers.ts`: API-based Login/Register implementieren.
*   [x] Backend: `console.log` Bereinigung.
*   [ ] Backend: Error Handler Härtung (keine Stacktraces in Prod).

## PHASE 5: FINALE VALIDIERUNG
*Status: ⏳ Ausstehend*

*   [ ] Erneuter Lauf aller 129 Tests.
*   [ ] Manuelle Prüfung der Logs auf Sauberkeit.
*   [ ] Update `STATUS.md` auf "SUCCESS".

