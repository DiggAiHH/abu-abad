# TASKLIST 2026-01-23 (Maintenance)

**Ziel:** Fehlendes/Defektes identifizieren, Port-Drift beheben, Tests/Validation neu starten, Doku aktualisieren.

## Tasks
- [x] Repo-Scan: Legacy-Ports (localhost 3000/5173/5174/8080)
- [x] validate.sh ausfuehren (Evidence-Log)
- [x] run-tests.sh ausfuehren (E2E, Evidence-Log)
- [x] Fehlende/defekte Stellen korrigieren (Rate-Limit Tests/Start)
- [x] Laufbahn + Doku aktualisieren

## Verifikation
- Scan: `grep -RIn "localhost:(3000|5173|5174|8080)" . --exclude-dir=node_modules --exclude-dir=.git`
- validate: `./validate.sh`
- tests: `AUTO_START_SERVICES=1 TEST_MODE=2 ./run-tests.sh`
- Evidence: `buildLogs/validate-20260123-114816.log`, `buildLogs/run-tests-20260123-115523.log`
