# 🎯 SYSTEMATISCHER FEATURE-PLAN: Psychiater/Psychotherapeuten-Plattform

**Erstellt:** 2025-12-30  
**Status:** In Arbeit  
**Ziel:** Vollständige klinische Plattform für Psychotherapie/Psychiatrie

---

## 📊 BESTEHENDE FUNKTIONEN (Bereits Implementiert)

- [x] Authentifizierung (Login, Register, JWT)
- [x] Rollensystem (Therapeut/Patient)
- [x] Terminbuchung & Verwaltung
- [x] Video-Calls (WebRTC/PeerJS)
- [x] Messaging-System
- [x] Stripe-Zahlungen
- [x] Fragebögen-Builder
- [x] Dokumenten-Anfragen
- [x] Patienten-Materialien
- [x] DSGVO-Grundlagen

---

## 🚀 NEUE FUNKTIONEN (Priorisiert nach klinischer Relevanz)

### PHASE 1: Kernfunktionen für Therapie (KRITISCH)

- [ ] **1.1 Therapie-Notizen-System**
  - Strukturierte Sitzungsnotizen (SOAP-Format)
  - Behandlungsplan-Dokumentation
  - Fortschritts-Tracking
  - Verschlüsselte Speicherung

- [ ] **1.2 Diagnose-Management (ICD-10/ICD-11)**
  - ICD-10/11 Code-Suche & Auswahl
  - Diagnose-Historie
  - Differenzialdiagnosen
  - Verdachtsdiagnosen

- [ ] **1.3 Medikamenten-Management**
  - Aktuelle Medikation erfassen
  - Dosierungs-Tracker
  - Wechselwirkungen anzeigen
  - Verschreibungshistorie

- [ ] **1.4 Symptom-Tagebuch (Patient)**
  - Tägliche Stimmungs-Erfassung
  - Schlaf-Tracker
  - Angst/Stress-Skalen
  - Trigger-Dokumentation

- [ ] **1.5 Therapeuten-Kalender-Ansicht**
  - Wochenübersicht aller Termine
  - Drag & Drop Terminplanung
  - Serientermine erstellen
  - Verfügbarkeits-Templates

### PHASE 2: Klinische Dokumentation

- [ ] **2.1 Anamnese-System**
  - Strukturierte Erstanamnese
  - Biografische Anamnese
  - Familien-/Suchtanamnese
  - Sozialanamnese

- [ ] **2.2 Psychologische Tests & Screenings**
  - PHQ-9 (Depression)
  - GAD-7 (Angst)
  - BDI-II Integration
  - Automatische Auswertung

- [ ] **2.3 Behandlungsberichte**
  - Arztbriefe generieren
  - Verlaufsberichte
  - Entlassungsberichte
  - PDF-Export

- [ ] **2.4 Krisenplan**
  - Notfall-Kontakte
  - Selbsthilfe-Strategien
  - Trigger-Identifikation
  - Eskalationsstufen

### PHASE 3: Kommunikation & Engagement

- [ ] **3.1 Übungen & Hausaufgaben**
  - Therapeut weist Übungen zu
  - Patient dokumentiert Durchführung
  - Expositionsübungen
  - Achtsamkeitsübungen

- [ ] **3.2 Psychoedukation**
  - Informationsmaterialien
  - Videos & Artikel
  - Störungsspezifische Inhalte
  - Selbsthilfe-Ressourcen

- [ ] **3.3 Termin-Erinnerungen**
  - E-Mail-Benachrichtigungen
  - SMS-Integration (optional)
  - Push-Notifications
  - Kalender-Integration

- [ ] **3.4 Wartezimmer-Funktion**
  - Virtueller Warteraum vor Video-Call
  - Status-Anzeige
  - Automatischer Beitritt

### PHASE 4: Abrechnung & Administration

- [ ] **4.1 GKV/PKV Abrechnungssystem**
  - Leistungsziffern (GOP/EBM)
  - Rechnungserstellung
  - Kassenabrechnung
  - Privatrechnung

- [ ] **4.2 Patienten-Akte**
  - Vollständige digitale Akte
  - Dokumenten-Upload
  - Befunde verwalten
  - Arztbriefe archivieren

- [ ] **4.3 Statistiken & Reports**
  - Patientenstatistiken
  - Umsatzübersicht
  - Terminauslastung
  - Behandlungserfolge

- [ ] **4.4 Multi-Therapeuten-Praxis**
  - Teamverwaltung
  - Patientenzuweisung
  - Vertretungsregelungen
  - Raumplanung

### PHASE 5: Sicherheit & Compliance

- [ ] **5.1 Erweiterte DSGVO-Funktionen**
  - Datenexport (Art. 15)
  - Löschkonzept (Art. 17)
  - Einwilligungsmanagement
  - Audit-Trail

- [ ] **5.2 Zwei-Faktor-Authentifizierung**
  - TOTP (Authenticator App)
  - SMS-Fallback
  - Recovery Codes

- [ ] **5.3 Berufsgeheimnis-Schutz**
  - § 203 StGB Dokumentation
  - Schweigepflichtserklärung
  - Entbindungserklärungen

---

## 📅 UMSETZUNGS-REIHENFOLGE

| Priorität | Feature | Geschätzt | Status |
|-----------|---------|-----------|--------|
| 1 | Symptom-Tagebuch (Patient) | 4h | 🔄 |
| 2 | Therapie-Notizen (SOAP) | 4h | ⏳ |
| 3 | Diagnose-Management | 3h | ⏳ |
| 4 | PHQ-9/GAD-7 Screenings | 3h | ⏳ |
| 5 | Therapeuten-Kalender | 4h | ⏳ |
| 6 | Anamnese-System | 4h | ⏳ |
| 7 | Medikamenten-Tracker | 3h | ⏳ |
| 8 | Krisenplan | 2h | ⏳ |
| 9 | Übungen/Hausaufgaben | 3h | ⏳ |
| 10 | Termin-Erinnerungen | 2h | ⏳ |

---

## 🔄 AKTUELLER FORTSCHRITT

**Gestartet:** 2025-12-30  
**Aktueller Task:** 1.4 Symptom-Tagebuch  
**Nächster Task:** 1.1 Therapie-Notizen
