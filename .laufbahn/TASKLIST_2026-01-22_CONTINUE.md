# Tasklist (2026-01-22, Continue)

> **Absolute Pfad:** `/workspaces/abu-abad/.laufbahn/TASKLIST_2026-01-22_CONTINUE.md`
> **Modus:** Execution (nach Plan-Check)
> **Zweck:** Fortsetzung mit Einbezug aller bestehenden Aenderungen.

## Aufgaben

1) **Auto-Start fuer lokale Services vorbereiten**
- **Ziel:** `start-local-test.sh` unterstützt non-interactive/DETACH-Mode mit PID-File und Health-Gates.
- **Files:** `start-local-test.sh`
- **Verifikation:** Script startet Services im DETACH-Mode und schreibt PID-File.

2) **Test-Runner robuste Service-Preflight + optional Auto-Start**
- **Ziel:** `run-tests.sh` kann Services automatisch starten (opt-in) und nach Tests sauber beenden.
- **Files:** `run-tests.sh`
- **Verifikation:** Preflight blockiert ohne Services; mit `AUTO_START_SERVICES=1` startet/stoppt es.

3) **Tests neu starten (kritische Suite)**
- **Ziel:** E2E kritische Tests laufen mit laufenden Services, Log in buildLogs/.
- **Files:** `buildLogs/`
- **Verifikation:** Logfile mit Exit-Code vorhanden.

4) **Laufbahn Action Log aktualisieren**
- **Ziel:** Schritte dokumentiert inkl. 5 Pflichtpunkte.
- **Files:** `.laufbahn/LAUFBAHN.md`
- **Verifikation:** Neuer Log-Eintrag am Ende.

5) **PII-Logging in Analytics entfernen**
- **Ziel:** Keine IP/UA in Analytics-Logs (GDPR Art. 9).
- **Files:** `apps/backend/src/routes/analytics.routes.ts`
- **Verifikation:** Log-Output ohne IP/UA.

6) **E2E Locale deterministisch (Deutsch)**
- **Ziel:** Playwright nutzt `de-DE`, damit UI-Selektoren stabil sind.
- **Files:** `playwright.config.ts`
- **Verifikation:** Locale in Config gesetzt.
