# Agent Arbeitsprofil (Evidence-Based)

> **Absolute Pfad:** `/workspaces/abu-abad/.laufbahn/AGENT_ARBEITSPROFIL.md`
> **Zweck:** Detaillierte, nachvollziehbare Selbst-Anleitung fuer planbares, fehlerfreies Arbeiten.
> **Geltung:** Jede Session, jedes Feature, jede Aenderung.

---

## 1) Klares Ziel
- Definiere pro Aufgabe ein eindeutiges, messbares Ziel (DoD/Definition of Done).
- Ziel ist stets in Nutzerwert, Risiko-Reduktion und Betriebssicherheit ausgedrueckt.
- Bei Konflikten: zuerst Compliance und Betriebssicherheit, dann Features.

## 2) Geraete & Methodik
- **Barbell-Strategie:** Regeln/Runbook zuerst lesen, dann Implementierung.
- **Plan-First:** Tasklist erstellen (Ziel, Dateien, Verifikation), erst dann ausfuehren.
- **Stop-and-Fix:** Fehler sofort stoppen, Ursache beheben, Praevention implementieren.
- **Evidence:** Jeder Schritt braucht Nachweis (Logfile, Test-Output, Checkliste).
- **Minimal Questions:** Fragen nur wenn zwingend, immer mit Empfehlung.

## 3) Sprachen & Technologie-Festlegung
- Frontend: TypeScript (React/Vite oder Next.js App Router je nach Repo-Standard).
- Backend: TypeScript (Node) oder Python (FastAPI) je nach bestehendem Modul.
- Tests: Vitest/Jest (TS), Pytest (Python), Playwright (E2E).
- Skripte: Bash.
- Jede Aufgabe benennt die verwendeten Sprachen/Tools explizit, keine Luecken.

## 4) Struktur (Repo-Disziplin)
- Einhaltung der Repo-Ports/ENV-Konventionen (LAUFBAHN Canonical Ports).
- Keine Secrets im Code, nur ENV-Variablen.
- DTOs fuer Responses, keine Roh-Entities.
- Keine PII in Logs, Maskierung erzwingen.
- Neue Dateien nur in bestehenden Pfaden/Strukturen ablegen.

## 5) Qualitaet & Muster
- DSGVO/CRA/ISO: Privacy-by-Design, Datenminimierung, sichere Defaults.
- Tests sind Pflicht: pro Funktionalitaet Unit-Test + Edge-Cases.
- Dokumentation: Schritt-fuer-Schritt fuer Nicht-Tech-User, mit Screenshot-Placeholders.
- Performance: spaete Abhaengigkeiten vermeiden, Caching/Streaming wo sinnvoll.
- Support-Level: klar definierte Betriebs- und Supportschritte.

## 6) Evidence-Based Workflow (Praxis)
- **Analyse:** Anforderungen zerlegen, Risiken/Abhaengigkeiten erkennen.
- **Plan:** Tasklist mit Zielen, Dateien, Verifikation.
- **Implementierung:** kleine, reversible Schritte.
- **Testing:** sofortiger Testlauf, Evidence in buildLogs/.
- **Dokumentation:** Changes, Befehle, Hinweise, Screenshot-Placeholders.

## 7) Usability & User-Testing
- Flows muessen fuer Einsteiger nachvollziehbar sein.
- Jeder Guide enthaelt konkrete UI-Elemente und Screenshot-Placeholder.
- Nutzerpfade (Happy Path + Error Path) dokumentieren.

## 8) Datenschutz, Speed, Maintenance
- Datenschutz: minimaler Datenzugriff, Loeschbarkeit, sichere Logs.
- Speed: kritische Pfade messen, keine schweren Blocker in UI.
- Maintenance: klare Tests, klare Doku, konsistente Konfigurationen.

## 9) Support-Level
- Definiere bei jedem Feature: Support-Stufe (Self-Service, Assisted, Admin-only).
- Dokumentiere erwartete Fehlerbilder und Fix-Pfade.

