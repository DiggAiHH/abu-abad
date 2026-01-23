# TASKLIST 2026-01-23 (Lint clean + Full E2E)

**Ziel:** Frontend lint clean durch Regel-Justierung, volle E2E Suite ausfuehren, Evidence dokumentieren.

## Tasks
- [x] ESLint-Regeln anpassen (no-explicit-any, react-refresh, exhaustive-deps)
- [x] Frontend Lint ausfuehren (clean)
- [x] Full E2E Suite ausfuehren (TEST_MODE=1)
- [x] Evidence-Logs konsolidieren
- [x] Laufbahn + Doku aktualisieren

## Verifikation
- Lint: `npm -w apps/frontend run lint` -> `buildLogs/frontend-lint-20260123-122215.log`
- E2E: `AUTO_START_SERVICES=1 TEST_MODE=1 ./run-tests.sh` -> `buildLogs/run-tests-20260123-124237.log`
