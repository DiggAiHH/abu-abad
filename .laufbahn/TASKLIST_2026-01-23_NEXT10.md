# TASKLIST 2026-01-23 (Next 10)

**Ziel:** Repo-Qualitaet verifizieren, Security/Compliance-Scans, Tests/Builds ausfuehren, Evidence dokumentieren.

## Tasks
- [x] Repo-Scan: Legacy-Ports (localhost 3000/5173/5174/8080)
- [x] Repo-Scan: console.log in src
- [x] Repo-Scan: moegliche Hardcoded-Secrets
- [x] validate.sh ausfuehren (Evidence-Log)
- [x] Backend Unit-Tests (apps/backend)
- [x] Frontend Lint (apps/frontend)
- [x] Frontend Build (apps/frontend)
- [x] E2E kritische Tests (run-tests.sh)
- [x] Evidence-Logs konsolidieren
- [x] Laufbahn + Doku aktualisieren

## Verifikation
- Scan Ports: `grep -RIn "localhost:(3000|5173|5174|8080)" . --exclude-dir=node_modules --exclude-dir=.git`
- Scan console: `grep -RIn "console\.log" apps --exclude-dir=node_modules`
- Scan secrets: `grep -RIn "(SECRET|API_KEY|TOKEN|PASSWORD)=\"" . --exclude-dir=node_modules --exclude-dir=.git`
- validate: `./validate.sh` -> `buildLogs/validate-20260123-120445.log`
- backend tests: `npm -w apps/backend test` -> `buildLogs/backend-tests-20260123-120455.log`
- frontend lint: `npm -w apps/frontend run lint` -> `buildLogs/frontend-lint-20260123-120556.log`
- frontend build: `npm -w apps/frontend run build` -> `buildLogs/frontend-build-20260123-120610.log`
- e2e: `AUTO_START_SERVICES=1 TEST_MODE=2 ./run-tests.sh` -> `buildLogs/run-tests-20260123-120635.log`
