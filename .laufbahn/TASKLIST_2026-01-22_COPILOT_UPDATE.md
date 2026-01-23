# TASKLIST 2026-01-22 - Copilot Instructions + Agent Plan

## Ziel
- Copilot-Instructions mit den neuen, verbindlichen Anforderungen aktualisieren.
- Eine eigenstaendige, detaillierte Agenten-Planungsdatei mit Ziel/Methodik/Sprachen/Struktur/Qualitaet erstellen.
- Tests neu starten und Evidence-Logs ablegen.
- Alles in LAUFBAHN dokumentieren.

## Aufgaben (mit Status)
1) [x] .github/copilot-instructions.md aktualisieren (Laufbahn-First, Tasklist-First, Test-First, Stop-and-Fix, Feature-Protocols, Docs-Standard, User-Action-Format, Codespace-Stability, Cross-Platform, Tech-Stack).
2) [x] Detaillierte Agenten-Planungsdatei erstellen (Self-Prompt + Evidence-based Workflow + 5 Pflichtpunkte).
3) [x] LAUFBAHN Action Log aktualisieren (5 Pflichtpunkte in Aktion/Ergebnis).
4) [x] Tests neu starten und Log in buildLogs/ ablegen.

## Betroffene Dateien
- .github/copilot-instructions.md
- .laufbahn/LAUFBAHN.md
- .laufbahn/AGENT_OPTIMAL_PROMPT.md (neu)
- buildLogs/run-tests-YYYYMMDD-HHMMSS.log (neu)

## Verifikation
- grep/cat Sichtpruefung der geaenderten Dateien.
- ./run-tests.sh (Log in buildLogs/).
