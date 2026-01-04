# Patient Pre-Session Materials System

## Überblick

Das Patient Pre-Session Materials System ermöglicht Patienten, sich optimal auf Therapiesitzungen vorzubereiten, indem sie Notizen, Skizzen, Audio-/Videoaufnahmen und Dokumente hochladen und mit ihrem Therapeuten teilen können.

## Features

### 1. Patient-Materialien (Patient Materials)
- **Notizen**: Textbasierte Notizen für Gedanken, Ereignisse, Symptome
- **Skizzen**: Bilder, Zeichnungen, Fotos
- **Audio**: Sprachaufnahmen, Tagebucheinträge
- **Video**: Videotagebücher, Selbstreflexionen
- **Dokumente**: PDF-Dateien, Scans

**DSGVO-Konformität:**
- ✅ AES-256-GCM Verschlüsselung für alle Dateien
- ✅ Explizite Freigabe erforderlich (Patient entscheidet)
- ✅ Recht auf Löschung (Art. 17)
- ✅ Row-Level Security (RLS): Patienten sehen nur eigene Daten
- ✅ Verschlüsselte Dateinamen (SHA-256 Hash)
- ✅ Lokale Speicherung (keine Cloud-Anbieter)

### 2. Fragebogen-System (Questionnaire System)

#### Therapeut-Funktionen:
- **Fragebogen-Builder**: Drag-&-Drop Editor für dynamische Formulare
- **Feldtypen**: Text, Textarea, Radio, Checkbox, Select, Number, Date, Email, Tel
- **Vorlagen-Bibliothek**: Wiederverwendbare Templates
- **Anfrage-Management**: Fragebogen an Patienten senden mit Priorität und Fälligkeitsdatum

#### Patienten-Funktionen:
- **Übersicht**: Alle angeforderten Fragebögen mit Prioritätsmarkierung
- **Fortschritts-Tracking**: Prozentanzeige des Ausfüllstatus
- **Auto-Save**: Automatisches Speichern von Entwürfen alle 3 Sekunden
- **Validierung**: Pflichtfelder werden geprüft

**DSGVO-Konformität:**
- ✅ Verschlüsselte Antworten (AES-256-GCM)
- ✅ JSON-Schema Validierung
- ✅ Audit-Logs für alle Aktionen

### 3. Dokumenten-Anfragen (Document Requests)

Therapeuten können spezifische Dokumente von Patienten anfordern:
- Medizinische Scans
- Laborbefunde
- Rezepte
- Überweisungen
- Versicherungsdokumente

**Workflow:**
1. Therapeut erstellt Anfrage mit Beschreibung und Priorität
2. Patient erhält Benachrichtigung
3. Patient lädt Dokument hoch (automatisch verschlüsselt und geteilt)
4. Therapeut überprüft Dokument (akzeptieren/ablehnen mit Notizen)

## API-Endpunkte

### Patient Materials

```
POST   /api/patient-materials              # Upload material
GET    /api/patient-materials              # List materials (filtered by role)
GET    /api/patient-materials/:id          # Download (with decryption)
PATCH  /api/patient-materials/:id/share    # Share with therapist
DELETE /api/patient-materials/:id          # Delete (GDPR Art. 17)
```

### Questionnaires

```
POST   /api/questionnaires/templates       # Create template (therapist)
GET    /api/questionnaires/templates       # List templates
PUT    /api/questionnaires/templates/:id   # Update template
DELETE /api/questionnaires/templates/:id   # Delete template

POST   /api/questionnaires/requests        # Request from patient (therapist)
GET    /api/questionnaires/requests        # List requests (filtered by role)

POST   /api/questionnaires/responses       # Submit response (patient)
GET    /api/questionnaires/responses/:id   # Get decrypted response (therapist)
```

### Document Requests

```
POST   /api/document-requests               # Create request (therapist)
GET    /api/document-requests               # List requests
PATCH  /api/document-requests/:id/upload   # Link uploaded file (patient)
PATCH  /api/document-requests/:id/review   # Review document (therapist)
DELETE /api/document-requests/:id           # Delete request
```

## Datenbankschema

### Neue Tabellen

1. **patient_materials**: Verschlüsselte Dateien und Notizen
2. **questionnaire_templates**: Fragebogen-Vorlagen (JSON-Schema)
3. **questionnaire_requests**: Anfragen an Patienten
4. **questionnaire_responses**: Verschlüsselte Antworten
5. **document_requests**: Dokumenten-Anforderungen

Alle Tabellen haben:
- Row-Level Security (RLS) Policies
- Audit-Logs (created_at, updated_at)
- Foreign Key Constraints
- Indexes für Performance

## Frontend-Komponenten

```
/apps/frontend/src/pages/
  PatientMaterials.tsx           # Patient: Upload/Teilen/Löschen
  QuestionnaireBuilder.tsx       # Therapeut: Fragebogen erstellen
  PatientQuestionnaires.tsx      # Patient: Fragebögen beantworten
  DocumentRequests.tsx           # Beide: Dokumenten-Workflow
```

## Verschlüsselung

### Datei-Verschlüsselung (AES-256-GCM)

```typescript
Format: [IV (16 Bytes)][Auth Tag (16 Bytes)][Encrypted Data]
```

**Vorteile:**
- Authenticated Encryption (Integrität + Vertraulichkeit)
- Schutz vor Tamper-Angriffen
- Key Rotation Support (Key ID gespeichert)

### Dateinamen-Hash

```typescript
SHA-256(originalFilename + timestamp) → Hex-String (64 Zeichen)
```

**Beispiel:**
```
Original: patient_notes_jan_2025.txt
Gespeichert: a3f7c8e9d1b2f4a6c3e5d7f9b1a3c5e7d9f1b3a5c7e9d1f3b5a7c9e1d3f5b7a9.enc
```

## Testing

```bash
# Verschlüsselungs-Tests
npm test tests/security/file-encryption.spec.ts

# E2E-Tests: Patient Materials
npm test tests/e2e/patient-materials.spec.ts

# E2E-Tests: Questionnaires
npm test tests/e2e/questionnaires.spec.ts
```

## Deployment

### SQL-Migration ausführen

```bash
docker exec -i therapist_db psql -U therapist_user -d therapist_db < apps/backend/src/database/schema_extension_patient_prep.sql
```

### Umgebungsvariablen

```bash
# .env
ENCRYPTION_KEY=<64-Zeichen Hex-String>  # AES-256 benötigt 32 Bytes
STORAGE_PATH=/var/lib/abu-abad/patient-materials
```

### Verzeichnis-Setup

```bash
mkdir -p /var/lib/abu-abad/patient-materials
chmod 700 /var/lib/abu-abad/patient-materials
chown therapist_user:therapist_user /var/lib/abu-abad/patient-materials
```

## Sicherheit

### Row-Level Security (RLS) Policies

**Patienten:**
- Können nur eigene Materialien sehen
- Können eigene Materialien löschen
- Können Freigabe an Therapeut steuern

**Therapeuten:**
- Sehen nur explizit freigegebene Materialien
- Können keine Materialien löschen (nur Patient)
- Können Fragebogen-Templates erstellen

### Audit-Logs

Alle sicherheitsrelevanten Aktionen werden geloggt:
- Material-Upload/Download/Löschen
- Fragebogen-Anfragen/Antworten
- Dokumenten-Reviews
- Freigaben

## DSGVO-Compliance Checkliste

- ✅ **Art. 5 (Rechtmäßigkeit)**: Explizite Einwilligung für Datenverarbeitung
- ✅ **Art. 9 (Gesundheitsdaten)**: Verschlüsselte Speicherung, lokale Infrastruktur
- ✅ **Art. 15 (Auskunftsrecht)**: Patienten können alle Daten abrufen
- ✅ **Art. 17 (Löschrecht)**: Delete-Funktion mit Datei-Cleanup
- ✅ **Art. 25 (Privacy by Design)**: RLS, Verschlüsselung by Default
- ✅ **Art. 30 (Verarbeitungsverzeichnis)**: Audit-Logs
- ✅ **Art. 32 (Datensicherheit)**: AES-256-GCM, HTTPS, Row-Level Security

## Performance

### Datei-Upload
- Max. Größe: 100 MB
- Verschlüsselung: ~50ms für 10MB
- Unterstützte Formate: text/*, image/*, audio/*, video/*, application/pdf

### Auto-Save
- Intervall: 3 Sekunden nach letzter Eingabe
- Optimierung: Debouncing verhindert übermäßige API-Calls

## Troubleshooting

### Fehler: "function uuid_generate_v4() does not exist"
```sql
-- Lösung: UUID-Extension aktivieren
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Fehler: "permission denied for table patient_materials"
```sql
-- Lösung: RLS Policies prüfen
SELECT * FROM pg_policies WHERE tablename = 'patient_materials';
```

### Fehler: "Datei zu groß (max. 100MB)"
```typescript
// Lösung: MAX_FILE_SIZE in Backend anpassen
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
```

## Roadmap

- [ ] KI-gestützte Fragebogen-Generierung (lokal via Ollama)
- [ ] OCR für gescannte Dokumente (Tesseract.js)
- [ ] Audio-Transkription (Whisper local)
- [ ] Automatische Symptom-Extraktion aus Notizen
- [ ] Exportfunktion für Patienten (DSGVO Art. 20)

## Support

Bei Fragen oder Problemen:
- GitHub Issues: [abu-abad/issues](https://github.com/username/abu-abad/issues)
- E-Mail: support@abu-abad.de
