# Codespace Stabilitaetsanalyse (Evidence-Based)

> **Absolute Pfad:** `/workspaces/abu-abad/.laufbahn/CODESPACE_STABILITY_ANALYSIS.md`
> **Zweck:** Ursachen fuer Abbrueche identifizieren und stabile, deterministische Ausfuehrung sicherstellen.
> **Scope:** Codespace, Node/Python Tooling, Test-/Build-Prozesse.

---

## 1) Beobachtete Symptome (typisch in Codespaces)
- Terminals verlieren Verbindung bei langlaufenden Prozessen.
- E2E-Tests sterben durch Timeout oder SIGINT.
- Build-Prozesse erzeugen hohe CPU/RAM-Spitzen.
- Hintergrund-Services (Frontend/Backend) konkurrieren um Ports/Resourcen.
- Docker-Container starten nicht (stale containerd state / Name-Konflikte).

## 2) Wahrscheinliche Ursachen (technisch)
- **Ressourcenlimits:** RAM/CPU-Spitzen bei Builds oder Tests.
- **File Watcher Overload:** Viele Watcher (Vite/TS/Playwright) + grosses Repo.
- **Parallel-Starts:** Mehrere Services gleichzeitig ohne Health-Gates.
- **Log-Volumen:** Uebermaessiges Logging ohne Rotation.
- **Process Leaks:** Nicht beendete Node/Playwright Prozesse.

## 3) Konkrete Massnahmen (sofort umsetzbar)

### 3.1 Prozessdisziplin
- Services mit Health-Checks starten, danach Tests (kein gleichzeitiger Start).
- Prozesse nach Tests gezielt beenden (keine zombie Node-Prozesse).

### 3.2 Ressourcenbegrenzung
- Node Memory begrenzen bei Tests:
  - `NODE_OPTIONS=--max-old-space-size=2048`
- Playwright parallelism reduzieren:
  - `npx playwright test --workers=2`

### 3.3 File-Watcher minimieren
- Tests ohne Watch-Modus ausfuehren.
- Vite/TS nicht parallel zu Playwright laufen lassen.

### 3.4 Logging diszipliniert
- Keine PII in Logs.
- Log-Output reduzieren (INFO statt DEBUG).
- Test-Logs nach `buildLogs/` umleiten.

### 3.5 Deterministische Test-Runs
- Services mit fixen Ports und klaren ENV.
- Health-Check warten, dann Tests starten.

### 3.6 Docker-Container Recovery
- Wenn `therapist-postgres` nicht startet: `FORCE_RECREATE_DB=1 ./start-local-test.sh`.
- Verhindert Blockaden durch stale containerd-Verzeichnisse.

## 4) Stabiler Ablauf (Referenz-Runbook)
1. **Saubere Prozesse sicherstellen:** alte Prozesse beenden.
2. **Backend starten:** Health-Check warten.
3. **Frontend starten:** Health-Check warten.
4. **Tests ausfuehren:** reduziert parallel, logs captured.
5. **Logs archivieren:** in `buildLogs/` ablegen.

## 5) Evidence-Checkliste (pro Testlauf)
- Logfile mit Timestamp in `buildLogs/`.
- Exit-Code dokumentiert.
- Keine PII in Logs.

## 6) Langfristige Verbesserungen
- Scripted Test-Orchestrator mit Health-Gates.
- Separate CI fuer E2E, lokal nur targeted tests.
- Ressourcen-Monitoring (CPU/RAM) waehrend Test-Phase.
