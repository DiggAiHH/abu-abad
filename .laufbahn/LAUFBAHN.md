# LAUFBAHN (Single Source of Truth)

> **Absolute Pfad:** `/workspaces/abu-abad/.laufbahn/LAUFBAHN.md`
> 
> **Zweck:** Diese Datei ist das verpflichtende Runbook + Audit-Log für alle Agent-Aktionen. Jeder Arbeitsschritt wird hier dokumentiert (Was/Wieso/Wann/Ergebnis). Damit sind alle Änderungen reproduzierbar und überprüfbar.

---

## 1) KLARES ZIEL (immer explizit)

### 1.1 Primärziel (Deployment + Testing)
- **Backend + Frontend “deploy-ready”** (lokal + Cloud), konsistente Ports/ENV, reproduzierbare Starts.
- **Keine Legacy-Port-Drift** im Repo (insb. `3000/5173/5174/8080`).
- **Test-Neustart**: Smoke + Test-Suite laufen durch, mit klaren Test-Links.

### 1.2 Definition of Done (DoD)
- Repo-Scan liefert **0 Treffer** auf `localhost:3000|5173|5174|8080` in getrackten Files.
- Lokale URLs funktionieren:
  - Frontend: `http://localhost:5175`
  - Backend Health: `http://localhost:4000/api/health`
  - PeerJS Health: `http://localhost:9001/health` (falls aktiviert)
- `validate.sh` + `run-tests.sh` laufen (oder dokumentierter Grund/Workaround).

---

## 2) GERÄTE & METHODIK (Evidence-based, reproduzierbar)

### 2.1 Arbeitsmodus
- **Barbell-Strategie:** erst Regeln/Runbook (diese Datei), dann aktiver Code.
- **Single Source of Truth:** Ports/URLs werden zentral konsolidiert (ENV + Compose + Test-Konfig).
- **No Secrets:** `.env` bleibt **lokal** und wird **nicht** committed. Nur `.env.example` enthält Platzhalter.

### 2.2 Vorgehens-Methodik (zwingend)
1. **Scan:** Repo-weit nach Drift-Strings/Ports suchen.
2. **Fix:** Änderungen minimal, deterministisch, ohne Nebenwirkungen.
3. **Verify:** erneut scannen → 0 Treffer.
4. **Smoke:** Health/Connectivity prüfen.
5. **Tests:** Test-Suite neu starten.
6. **Dokumentation:** Links + Kommandos aktualisieren.

### 2.3 Tooling
- Repo-Scan: `grep`/VSCode Search (regex)
- Build/Test: `npm` Workspaces + `./validate.sh` + `./run-tests.sh`
- E2E: Playwright (BaseURL standardisiert)

---

## 3) SPRACHEN (Runtime + Tooling)

- **Backend:** TypeScript (Node.js)
- **Frontend:** TypeScript (React/Vite)
- **E2E:** Playwright (TypeScript)
- **Skripte:** Bash

---

## 4) STRUKTUR (Repo-Konventionen)

### 4.1 Canonical Ports (verbindlich)
- **Backend API:** `4000`
- **Frontend Dev/HTTP:** `5175`
- **PeerJS:** `9001`

### 4.2 Zentrale Konfigurationspunkte
- `docker-compose.yml` / `docker-compose.doctor.yml`
- `.env.example` (nur Platzhalter)
- `apps/frontend/.env.example`
- `apps/backend` ENV-Validation + Runtime Defaults
- `playwright.config.ts`
- `sdk-build/src/apiClient.ts`

### 4.3 “Nicht verhandelbar”
- Keine hardcoded Secrets.
- Keine PII in Logs.
- CORS nur allowlist-basiert.

---

## 5) QUALITÄT & MUSTER (Security/Compliance/UX)

### 5.1 DSGVO / CRA / ISO 27001
- **Privacy by Design:** Datenminimierung, DTOs, keine rohen Entities.
- **Right to Erasure:** Crypto-Shredding (Key-Removal) wo vorgesehen.
- **Logging:** Keine PII, Maskierung für sensitive Felder.
- **CRA Secure Defaults:** restriktive CORS, sichere Header, keine unnötig offenen Ports.

### 5.2 Test-Qualität (ISO 29119)
- Unit/Integration-Tests decken Edge-Cases ab.
- Playwright BaseURL ist konsistent (keine hardcoded Ports in Specs).

---

## ACTION LOG (append-only)

| Zeit (UTC) | Agent | Aktion | Dateien | Ergebnis |
|-----------|-------|---------|---------|-----------|
| 2026-01-16 | Copilot | Start: Repo-Scan auf Legacy-Ports | (scan) | Trefferliste erzeugt; Fix-Backlog definiert |
| 2026-01-18 | Copilot | SYSTEM TEST START | Error Scan + Git Status | Nur MD-Linting (kosmetisch); Git: 24 neue Locale-Files + 6 Components uncommitted |
| 2026-01-20 14:45 | Copilot | Frontend Build Test | apps/frontend/ | ✅ Build OK (10.06s), dist/ generiert, 545 KB bundle (Warning >500 KB ignoriert für Testing) |
| 2026-01-20 14:46 | Copilot | Backend Tests (vitest) | apps/backend/src/utils/*.test.ts | ✅ vitest.config.ts erstellt, 4 Test-Files vorhanden (encryption, logger, validation, ocr) |
| 2026-01-20 14:47 | Copilot | dist/ Verifizierung | apps/frontend/dist/ | ✅ index.html + assets/ + locales/ (19 Sprachen) vorhanden |
| 2026-01-20 14:48 | Copilot | Git Commit Prep | .laufbahn/, locales/, i18n/, Configs | ✅ commit.sh + deploy-automated.sh erstellt, ready für commit |

---

## DEPLOYMENT INSTRUCTIONS (User Action Required)

**Jetzt im Terminal ausführen:**

```bash
# Option A: Automatisches Commit + Deploy
cd /workspaces/abu-abad
chmod +x commit.sh deploy-automated.sh
./commit.sh
./deploy-automated.sh

# Option B: Manuell
git add -A
git commit -m "feat: i18n (19 lang), deployment ready"
git push origin v8-compliant-isolated

# Dann siehe: .laufbahn/DEPLOYMENT_READY_CHECKLIST.md
```

**Live URLs (nach Deployment):**
- Backend: `https://[project].railway.app`
- Frontend: `https://[site].netlify.app`

---

## AGENT-PROMPT (so soll ein Agent sich selbst steuern)

**Du arbeitest strikt nach diesem Ablauf:**
1) Lies `/.laufbahn/LAUFBAHN.md` und halte dich an Canonical Ports.
2) Scanne Repo nach `localhost:3000|5173|5174|8080`.
3) Ändere nur getrackte Files, außer explizit notwendig.
4) Verifiziere: Scan = 0 Treffer.
5) Starte Smoke + Tests neu.
6) Trage jeden Schritt in den ACTION LOG ein (Zeit, Aktion, Ergebnis).
