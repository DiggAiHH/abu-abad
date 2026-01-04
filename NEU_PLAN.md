# SYSTEMATISCHER RETTUNGS- UND OPTIMIERUNGSPLAN (NEU)

**Ziel:** 100% Test-Abdeckung (Grün), Behebung aller Timeouts, Sicherstellung der medizinischen Compliance (DSGVO/DiGA) und Eliminierung versteckter Risiken.

---

## 📊 FORTSCHRITTS-PROTOKOLL

| Phase | Aufgabe | Status | Details / Ergebnis |
| :--- | :--- | :--- | :--- |
| **1** | **Analyse** | ✅ Abgeschlossen | Hauptursache: Timeouts im Docker-Container (5s zu kurz). Login-Tests stabilisiert. |
| **2** | **Test-Infra** | ✅ Abgeschlossen | `loginUser` & `registerUser` auf API-Calls umgestellt. Rate-Limiting für Tests deaktiviert. |
| **3** | **Code-Audit** | ✅ Abgeschlossen | `console.error` durch `logger.error` ersetzt (DSGVO). |
| **4** | **Fixes** | 🔄 In Arbeit | Video-Call Tests debuggen (UI-Elemente nicht gefunden). Nginx Optimierung. |
| **5** | **Validierung** | ⏳ Ausstehend | Finaler Run aller 129 Tests. |

---

## PHASE 1: ANALYSE & DIAGNOSE
*Status: ✅ Abgeschlossen*

*   ✅ Docker-Performance als Flaschenhals identifiziert.
*   ✅ Login-Tests stabilisiert (Timeouts erhöht).

## PHASE 2: TEST-INFRASTRUKTUR STABILISIEREN
*Status: ✅ Abgeschlossen*

*   ✅ `playwright.config.ts`: Timeouts auf 30s erhöht.
*   ✅ `tests/helpers.ts`: Login/Register auf API-Calls umgestellt (Bypass UI).
*   ✅ `security.ts`: Rate-Limiting für Dev-Environment deaktiviert.
*   ✅ Browser-Permissions für Fake-Media-Devices gesetzt.

## PHASE 3: CODE-AUDIT & SICHERHEIT (Medical Compliance)
*Status: ✅ Abgeschlossen*

*   ✅ `console.error` durch `logger.error` ersetzt in:
    *   `questionnaire.routes.ts`
    *   `document-requests.routes.ts`
    *   `patient-materials.routes.ts`
    *   `database.ts`
    *   `security.ts`
    *   `apps/backend/src/db/migrate.ts`

## PHASE 4: UMSETZUNG & FIXES (AKTUELL)
*Status: 🔄 In Arbeit*

### Aktuelle Probleme (Video-Call Tests):
1.  ✅ **Rate Limiting:** Behoben durch Retry-Logik in `helpers.ts` und `.env` Anpassung (`LOGIN_RATE_LIMIT_MAX=10000`).
2.  ✅ **Audio-Only Fallback:** Implementiert in `VideoCall.tsx` (Versucht Audio-Only wenn Video fehlschlägt).
3.  ✅ **Permission Tests:** UI/Instrumentation angepasst (Audio-Only-Badge, Duplicate-Tab-Warnung, `__videoCallTest` Hooks) – Playwright findet wieder stabile Selektoren.
4.  ✅ **Nginx Optimierung:** `apps/frontend/nginx.conf` erweitert um `/peerjs` Proxy (WebSocket Support) und Upload-Limit (10MB).

## PHASE 5: FINALE VALIDIERUNG
*Status: 🔄 In Arbeit*

*   [ ] Ausführung aller Tests (`run-all-tests.sh`).
*   [ ] Erstellung des finalen Reports.
