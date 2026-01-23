# TASKLIST 2026-01-23 (Implement)

**Ziel:** Skipped Suites wieder aktivieren wo moeglich, E2E Stabilitaet herstellen, Full Suite laufen lassen und dokumentieren.

## Tasks
- [ ] Reaktivieren: i18n + file-encryption + auth/appointments Suites (remove skip)
- [ ] i18n UI: Dropdown ARIA/Selector-Fixes, Validation-Text sichtbar
- [ ] File encryption tests: stabiler Test-Key + GCM roundtrip
- [ ] Auth/login tests: Credentials + pre-seed via API
- [ ] Appointments flow: UI validation + API contract alignment
- [ ] Payment flow: Endpoint-Konsistenz (create-checkout vs payment-intent)
- [ ] Re-run frontend lint
- [ ] Full E2E (TEST_MODE=1)
- [ ] Evidence-Logs sammeln
- [ ] Laufbahn + Doku aktualisieren

## Verifikation
- Lint: `npm -w apps/frontend run lint`
- E2E: `AUTO_START_SERVICES=1 TEST_MODE=1 ./run-tests.sh`
