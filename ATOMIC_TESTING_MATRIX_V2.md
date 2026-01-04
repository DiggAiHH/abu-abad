# Atomic Testing Matrix & Strategy

## 1. Testing Philosophy: "Fail Fast, Fix Faster"
Wir setzen auf eine pyramidenförmige Teststrategie mit Fokus auf DSGVO-Compliance und kritische Pfade.

### Test-Ebenen
1.  **Unit Tests (Jest/Vitest):** Isolierte Logik (z.B. Verschlüsselung, Validierung).
2.  **Integration Tests (Supertest):** API-Endpunkte und Datenbank-Interaktion.
3.  **E2E Tests (Playwright):** Kritische User Flows (Login, Fragebogen ausfüllen).

## 2. Testing Matrix (Status)

| Komponente | Typ | Status | Priorität | Abdeckung |
| :--- | :--- | :--- | :--- | :--- |
| **Auth System** | | | | |
| Login Flow | E2E | ✅ Ready | Hoch | 100% |
| Registration | E2E | ⚠️ Todo | Hoch | 0% |
| JWT Validation | Unit | ✅ Ready | Kritisch | 100% |
| **Questionnaire** | | | | |
| Template Creation | Int | ⚠️ Todo | Mittel | 0% |
| Response Submission | Int | ✅ Ready | Hoch | 90% |
| Encryption (DSGVO) | Unit | ✅ Ready | Kritisch | 100% |
| **Video Chat** | | | | |
| PeerJS Connection | E2E | ⚠️ Todo | Mittel | 0% |
| Signaling Server | Int | ⚠️ Todo | Mittel | 0% |

## 3. Edge Case Simulation ("Matrix des Scheiterns")

### Szenario A: Datenbank-Ausfall während Fragebogen-Submit
*   **Erwartung:** User erhält klare Fehlermeldung, Daten werden lokal zwischengespeichert (Redux/Zustand Persist).
*   **Test:** Mock DB connection failure in Integration Test.

### Szenario B: Manipulierter JWT Token
*   **Erwartung:** Sofortiger Logout, Security Alert im Backend-Log.
*   **Test:** Sende Request mit verfälschtem Signature-Teil.

### Szenario C: DSGVO-Export Timeout
*   **Erwartung:** Async Job Processing statt synchroner Response bei großen Datenmengen.
*   **Test:** Generiere 10.000 Dummy-Datensätze und fordere Export an.

## 4. Hot-Reload Simulation Plan
Bevor Code geschrieben wird, prüfen wir:
1.  Ist die Änderung abwärtskompatibel?
2.  Überlebt der State einen Hot-Reload? (Wichtig für Developer Experience)
3.  Werden Event-Listener sauber aufgeräumt? (Memory Leaks)
