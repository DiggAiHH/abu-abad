# ⚡ Quick Start Guide

## 🎯 In 5 Minuten zur laufenden Anwendung

### Schritt 1: Dependencies installieren (2 Min)

```bash
# Im Hauptverzeichnis
npm install

# Falls Fehler auftreten, einzeln installieren:
cd apps/backend && npm install
cd ../frontend && npm install
cd ../..
```

### Schritt 2: PostgreSQL einrichten (1 Min)

```bash
# PostgreSQL starten
sudo service postgresql start

# Datenbank erstellen
createdb therapist_platform

# Schema laden
cd apps/backend
npm run migrate
cd ../..
```

### Schritt 3: Environment-Variablen (1 Min)

**Root .env:**
```bash
cp .env.example .env

# Minimal-Konfiguration für Dev:
DATABASE_URL=postgresql://postgres:password@localhost:5432/therapist_platform
JWT_SECRET=dev-secret-change-in-production
ENCRYPTION_KEY=dev-encryption-key-32-chars-min
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
```

**Frontend .env:**
```bash
cp apps/frontend/.env.example apps/frontend/.env

# Minimal:
VITE_API_URL=http://localhost:3000
VITE_PEER_SERVER_HOST=localhost
VITE_PEER_SERVER_PORT=3001
VITE_PEER_SERVER_SECURE=false
```

### Schritt 4: Starten (1 Min)

```bash
# Im Root-Verzeichnis:
npm run dev
```

**Fertig!** 🎉

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

---

## 🧪 Testen

1. **Registriere einen Therapeuten:**
   - http://localhost:5173/register
   - Rolle: Therapeut
   - E-Mail: therapeut@test.de
   - Passwort: Test1234!

2. **Registriere einen Patienten:**
   - http://localhost:5173/register
   - Rolle: Patient
   - E-Mail: patient@test.de
   - Passwort: Test1234!

3. **Als Therapeut:**
   - Login
   - "Slot erstellen" klicken
   - Termin-Daten eingeben
   - Speichern

4. **Als Patient:**
   - Login
   - Tab "Termin buchen"
   - Termin auswählen
   - "Jetzt buchen" (Stripe Test-Modus)

5. **Video-Call testen:**
   - Als Therapeut: Bei gebuchtem Termin "Sitzung starten"
   - Als Patient: Bei gebuchtem Termin "Beitreten"

---

## 🐛 Troubleshooting

### "Module not found"
```bash
rm -rf node_modules package-lock.json
npm install
```

### PostgreSQL Connection Error
```bash
# Service Status prüfen
sudo service postgresql status

# Starten
sudo service postgresql start

# Passwort setzen (falls nötig)
sudo -u postgres psql
ALTER USER postgres PASSWORD 'password';
\q
```

### Port already in use
```bash
# Port 3000 freigeben
lsof -ti:3000 | xargs kill -9

# Port 5173 freigeben
lsof -ti:5173 | xargs kill -9
```

### WebRTC funktioniert nicht
- Kamera/Mikrofon-Berechtigung im Browser erlauben
- HTTPS erforderlich in Production (lokaler Test mit HTTP ok)

---

## 📚 Weiterführende Dokumentation

- [README.md](./README.md) - Vollständige Features & API
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production Deployment
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Technische Details

---

## 💡 Tipps

**Entwicklung:**
```bash
# Nur Backend
npm run dev:backend

# Nur Frontend
npm run dev:frontend

# Logs ansehen
# Backend: Terminal 1
# Frontend: Terminal 2
```

**Database:**
```bash
# Schema neu laden
npm run db:migrate

# Datenbank zurücksetzen
dropdb therapist_platform
createdb therapist_platform
npm run db:migrate
```

**Stripe Testing:**
- Test-Kreditkarte: `4242 4242 4242 4242`
- Ablaufdatum: Beliebig in der Zukunft
- CVC: Beliebig 3 Ziffern
- PLZ: Beliebig

---

## ✅ Erfolgreich gestartet? Nächste Schritte:

1. ✨ Erkunde alle Features
2. 📖 Lies die Dokumentation
3. 🔒 Konfiguriere Sicherheit für Production
4. 🚀 Deploye mit [DEPLOYMENT.md](./DEPLOYMENT.md)
