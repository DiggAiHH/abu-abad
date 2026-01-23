# Agent Optimal Prompt & Arbeitsleitfaden

> **Absoluter Pfad:** `/workspaces/abu-abad/.laufbahn/AGENT_OPTIMAL_PROMPT.md`
> **Zweck:** Self-Prompt + detaillierter Ablauf fuer replizierbare, evidenzbasierte Arbeit.

---

## 1) Klares Ziel (immer zuerst definieren)
- **Ziel:** Definiere ein messbares Ergebnis (DoD) mit Verifikation.
- **Warum:** Begruende den Business-/Compliance-Nutzen.
- **Output:** Welche Artefakte/Dateien sind das Ergebnis?

## 2) Geraete & Methodik (Evidence-Based)
- **Methodik:** Plan-First, Tasklist-First, Stop-and-Fix.
- **Evidence:** Jeder Schritt mit Test/Log/Evidence-Pfad.
- **Risiko-Scan:** DSGVO/CRA/ISO-Risiken vor Implementierung.
- **Diagnostik:** Codespace-Stabilitaet pruefen und dokumentieren.

## 3) Sprachen & Tech-Stack (explizit, keine Luecken)
- **Frontend:** Next.js 15 (RSC), TypeScript, Zod.
- **Backend:** Node/NestJS oder FastAPI (nach Kontext), TypeScript/Python.
- **DB/ORM:** PostgreSQL + Drizzle/Prisma.
- **Tests:** Vitest/Jest/Pytest, Playwright.
- **Infra:** Docker, Railway/Netlify, bash.

## 4) Struktur (Repo-Pfade & Artefakte)
- **Runbook:** `/.laufbahn/LAUFBAHN.md` (Single Source of Truth).
- **Tasklists:** `/.laufbahn/TASKLIST_YYYY-MM-DD*.md`.
- **Evidence:** `buildLogs/` mit Timestamp.
- **Dokumentation:** relevante README/Guides mit Screenshot-Platzhaltern.

## 5) Qualitaet & Muster (Security, UX, Wartbarkeit)
- **Security/Compliance:** DSGVO Art. 25/17/9, CRA Secure Defaults.
- **Data-Minimization:** DTOs, keine rohen Entities, kein PII-Logging.
- **Testing:** Unit-Test pro Funktionalitaet + unmittelbarer Test-Run.
- **Usability:** Schritt-fuer-Schritt Guides fuer Non-Technical Users.
- **Performance:** Low-latency, resource-aware, deterministische Scripts.
- **Maintainability:** Klare Module, kurze Funktionen, keine Magic Defaults.

---

## Selbst-Prompt (vor jeder Aufgabe)
1. **Laufbahn lesen:** `/.laufbahn/LAUFBAHN.md`.
2. **Offene Tasks uebernehmen:** PENDING_TASKS + letzte Action Logs.
3. **Tasklist erstellen:** Ziel, Dateien, Verifikation.
4. **Plan vs Execution:** Planung ohne Commands, danach Ausfuehrung.
5. **Test-Run + Evidence:** buildLogs/ mit Timestamp.
6. **Dokumentation:** LAUFBAHN Action Log mit 5 Pflichtpunkten.

---

## Evidence-Checkliste (pro Task)
- [ ] Ziel messbar und dokumentiert
- [ ] Methodik und Risiko-Scan dokumentiert
- [ ] Sprachen/Tech explizit genannt
- [ ] Struktur/Files genannt
- [ ] Qualitaet/Muster (Security/UX/Perf) abgedeckt
- [ ] Test ausgefuehrt, Log in `buildLogs/`
- [ ] LAUFBAHN Action Log aktualisiert
