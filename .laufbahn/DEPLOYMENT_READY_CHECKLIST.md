# 🚀 DEPLOYMENT READY CHECKLIST - Abu-Abad

> **Absoluter Pfad:** `/workspaces/abu-abad/.laufbahn/DEPLOYMENT_READY_CHECKLIST.md`  
> **Erstellt:** 2026-01-20  
> **Status:** PRE-DEPLOYMENT - Bereit für Ausführung

---

## ✅ PRE-FLIGHT CHECKS (Vor Deployment)

### 1. Build Verification

```bash
# Frontend Build
cd apps/frontend
npm run build
# Erwartung: dist/ Ordner mit index.html + assets/

# Backend Test
cd ../backend
npm test
# Erwartung: All tests pass
```

**Status:**
- [ ] Frontend Build erfolgreich (dist/ existiert)
- [ ] Backend Tests bestanden
- [ ] Keine kritischen TypeScript Errors
- [ ] Keine kritischen Security-Warnings

### 2. Git Status

```bash
git status
```

**Uncommitted Files:**
- ✅ `.laufbahn/` (Dokumentation)
- ✅ `public/locales/` (i18n - 19 Sprachen)
- ✅ `src/i18n/` (i18n Setup)
- ✅ `LanguageSwitcher.tsx`, `Layout.tsx`, `Privacy.tsx`
- ✅ ESLint Configs (`.eslintrc.cjs`)
- ✅ Railway/Netlify Configs (`railway.json`, `netlify.toml`, `.nvmrc`)

**Aktion:** Commit ALLES vor Deployment

```bash
git add -A
git commit -m "feat: i18n (19 languages), deployment configs, ESLint setup

- Add i18n infrastructure (i18next, react-i18next)
- Implement 19 language support (incl. RTL: ar, fa, ckb)
- Create Privacy page with DSGVO-compliant text (de, en)
- Add LanguageSwitcher component + Layout
- Configure Railway (backend) + Netlify (frontend)
- Add ESLint configs for both workspaces
- Update all Pages to use useTranslation (Login, Register, Privacy)

BREAKING CHANGE: Frontend now requires i18n locale files to load
"
git push origin v8-compliant-isolated
```

### 3. Environment Variables Vorbereitung

**Backend (.env in Railway setzen):**

```bash
# Secrets generieren (LOKAL AUSFÜHREN):
openssl rand -base64 32  # JWT_SECRET
openssl rand -base64 32  # REFRESH_TOKEN_SECRET
openssl rand -base64 32  # ENCRYPTION_KEY

# Stripe Test Keys (aus Stripe Dashboard holen)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Frontend (.env in Netlify setzen):**

```bash
VITE_API_URL=https://[BACKEND_RAILWAY_URL]
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_PEER_SERVER_HOST=[BACKEND_RAILWAY_HOST]
VITE_PEER_SERVER_PORT=443
VITE_PEER_SERVER_SECURE=true
```

---

## 🚂 BACKEND DEPLOYMENT (Railway)

### Phase 1: Railway Setup

```bash
# 1. Railway CLI installieren (falls nicht vorhanden)
npm install -g @railway/cli

# 2. Login (öffnet Browser)
railway login

# 3. Neues Projekt erstellen
railway init
# Name: abu-abad-backend

# 4. PostgreSQL hinzufügen
railway add postgresql
# Railway setzt automatisch DATABASE_URL
```

### Phase 2: Secrets setzen

```bash
# Generierte Secrets (aus Phase 3 oben)
railway variables set JWT_SECRET="[GENERATED_KEY_1]"
railway variables set JWT_EXPIRES_IN="15m"
railway variables set REFRESH_TOKEN_SECRET="[GENERATED_KEY_2]"
railway variables set REFRESH_TOKEN_EXPIRES_IN="7d"
railway variables set ENCRYPTION_KEY="[GENERATED_KEY_3]"

# Server Config
railway variables set PORT="3000"
railway variables set NODE_ENV="production"

# Stripe
railway variables set STRIPE_SECRET_KEY="sk_test_..."
railway variables set STRIPE_PUBLISHABLE_KEY="pk_test_..."
railway variables set STRIPE_WEBHOOK_SECRET="whsec_..."

# CORS (Netlify URL kommt in Phase 4)
railway variables set ALLOWED_ORIGINS="https://[NETLIFY_SITE].netlify.app"
railway variables set FRONTEND_URL="https://[NETLIFY_SITE].netlify.app"
```

### Phase 3: Deploy Backend

```bash
# Deploy via CLI
railway up

# ODER: GitHub Push (Auto-Deploy wenn verbunden)
git push origin v8-compliant-isolated

# Logs ansehen
railway logs

# Status prüfen
railway status
```

### Phase 4: Backend-URL notieren

```bash
# URL holen
railway status --json | jq -r '.url'
# Output: https://abu-abad-backend.railway.app

# Health-Check testen
curl https://abu-abad-backend.railway.app/api/health
# Erwartung: {"status":"healthy","timestamp":"..."}
```

**Railway URL speichern:** `https://abu-abad-backend.railway.app`

### Phase 5: Database Migration

```bash
# Option A: Remote-Migration via Railway CLI
railway run npm run migrate --workspace=apps/backend

# Option B: Lokale Migration gegen Remote-DB
railway variables get DATABASE_URL
DATABASE_URL="[RAILWAY_DB_URL]" npm run migrate --workspace=apps/backend

# Seed-Daten (optional)
railway run npm run seed --workspace=apps/backend
```

---

## 🌐 FRONTEND DEPLOYMENT (Netlify)

### Phase 1: Netlify CLI Setup

```bash
# 1. CLI installieren (falls nicht vorhanden)
npm install -g netlify-cli

# 2. Login (öffnet Browser)
netlify login

# 3. Status prüfen
netlify status
# Erwartung: Logged in as: [user-email]
```

### Phase 2: Erstmaliger Deploy

```bash
# Init (erstellt Site)
netlify init

# Interaktive Fragen:
# - Team: [Wähle Team]
# - Site name: abu-abad-teletherapy (oder leer)
# - Build command: npm ci && npm run build --workspace=apps/frontend
# - Publish directory: apps/frontend/dist

# Deploy als Preview (zum Testen)
netlify deploy --dir apps/frontend/dist

# Wenn Preview OK: Production Deploy
netlify deploy --prod --dir apps/frontend/dist
```

### Phase 3: Environment Variables setzen

```bash
# WICHTIG: Nutze die Railway Backend-URL aus Phase Backend-4
netlify env:set VITE_API_URL "https://abu-abad-backend.railway.app"
netlify env:set VITE_STRIPE_PUBLISHABLE_KEY "pk_test_..."
netlify env:set VITE_PEER_SERVER_HOST "abu-abad-backend.railway.app"
netlify env:set VITE_PEER_SERVER_PORT "443"
netlify env:set VITE_PEER_SERVER_SECURE "true"

# Rebuild + Redeploy (ENV Vars wirken erst nach Rebuild)
netlify build
netlify deploy --prod
```

### Phase 4: Frontend-URL notieren

```bash
# URL öffnen
netlify open:site

# URL speichern
netlify sites:list
# Output: https://abu-abad-teletherapy.netlify.app
```

**Netlify URL speichern:** `https://abu-abad-teletherapy.netlify.app`

### Phase 5: Backend CORS updaten

```bash
# Zurück zu Railway: Netlify-URL in Backend setzen
railway variables set ALLOWED_ORIGINS="https://abu-abad-teletherapy.netlify.app"
railway variables set FRONTEND_URL="https://abu-abad-teletherapy.netlify.app"

# Backend neu deployen (damit CORS wirkt)
railway up
```

---

## 🧪 SMOKE TESTS (Nach Deployment)

### Backend Tests

```bash
# 1. Health-Check
curl https://abu-abad-backend.railway.app/api/health
# Erwartung: {"status":"healthy"}

# 2. Auth-Check
curl https://abu-abad-backend.railway.app/api/auth/check
# Erwartung: {"authenticated":false}

# 3. Database-Connectivity
curl https://abu-abad-backend.railway.app/api/health/db
# Erwartung: {"status":"connected"}
```

### Frontend Tests

**Manuell im Browser:**

1. Öffne `https://abu-abad-teletherapy.netlify.app`
2. Startseite lädt ohne Console-Errors
3. Language-Switcher sichtbar (rechts oben oder Footer)
4. Wechsel zu Arabisch → Layout gespiegelt (RTL)
5. Register-Form → Privacy-Link klicken → Volltext sichtbar
6. Login-Formular → Felder sichtbar
7. Network-Tab → API-Requests zu Railway-Backend sichtbar

**Erwartete Console-Logs (keine Errors):**

```
✓ i18n initialized
✓ Language loaded: de
✓ API base URL: https://abu-abad-backend.railway.app
```

**Erwartete Network-Requests:**

- `GET https://abu-abad-backend.railway.app/api/health` → 200
- `GET https://abu-abad-backend.railway.app/api/auth/check` → 200

### E2E Tests (Optional)

```bash
# Playwright gegen Live-URL
PLAYWRIGHT_BASE_URL=https://abu-abad-teletherapy.netlify.app npm run test:e2e
```

---

## 📝 LAUFBAHN UPDATE (Nach erfolgreichem Deployment)

```bash
# .laufbahn/LAUFBAHN.md updaten
nano .laufbahn/LAUFBAHN.md
```

**ACTION LOG Eintrag:**

```markdown
| 2026-01-20 14:00 | Copilot | Backend Deployment | railway.json, Procfile, ENV | ✅ Live: https://abu-abad-backend.railway.app |
| 2026-01-20 14:30 | Copilot | Frontend Deployment | netlify.toml, dist/ | ✅ Live: https://abu-abad-teletherapy.netlify.app |
| 2026-01-20 15:00 | Copilot | Smoke-Tests | Browser + curl | ✅ Alle Tests bestanden |
```

---

## 🚨 TROUBLESHOOTING

### Problem: Backend Deploy scheitert

**Symptom:** `railway up` gibt Fehler

**Check:**

```bash
# Logs ansehen
railway logs --tail

# Häufige Ursachen:
# - DATABASE_URL fehlt → railway add postgresql
# - Node Version falsch → package.json "engines": {"node": "20"}
# - Build Command falsch → railway.json prüfen
```

### Problem: Frontend lädt, aber API-Requests scheitern

**Symptom:** Console: `Failed to fetch` oder `CORS error`

**Check:**

```bash
# 1. Prüfe ENV-Vars in Netlify
netlify env:list
# VITE_API_URL muss gesetzt sein

# 2. Prüfe CORS im Backend
railway variables list
# ALLOWED_ORIGINS muss Netlify-URL enthalten

# 3. Rebuild Frontend (ENV-Vars wirken erst nach Build)
netlify build && netlify deploy --prod
```

### Problem: Privacy-Seite 404

**Symptom:** `/privacy` zeigt Netlify 404

**Check:**

```bash
# Prüfe netlify.toml SPA-Redirect
cat netlify.toml

# Muss enthalten:
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Problem: Language-Switcher fehlt

**Symptom:** Keine Möglichkeit, Sprache zu ändern

**Check:**

```bash
# Prüfe ob Layout verwendet wird
grep -r "LanguageSwitcher" apps/frontend/src/App.tsx

# Muss enthalten:
import Layout from './components/Layout'
```

---

## ✅ DEPLOYMENT COMPLETE CHECKLIST

- [ ] Backend deployed auf Railway
- [ ] Backend Health-Check OK
- [ ] Database Migration ausgeführt
- [ ] Frontend deployed auf Netlify
- [ ] Frontend lädt ohne Errors
- [ ] API-Requests funktionieren (Backend ↔ Frontend)
- [ ] Language-Switcher sichtbar
- [ ] Sprachwechsel funktioniert
- [ ] Privacy-Seite erreichbar
- [ ] RTL-Sprachen (ar, fa, ckb) korrekt dargestellt
- [ ] LAUFBAHN.md aktualisiert mit Live-URLs
- [ ] Git Commit + Push
- [ ] User benachrichtigt: **Testing kann starten**

---

## 📊 LIVE URLs (nach Deployment)

**Backend:** `https://abu-abad-backend.railway.app`  
**Frontend:** `https://abu-abad-teletherapy.netlify.app`  

**Test-Accounts** (falls angelegt):

- **Therapeut:** `therapist@test.com` / `Test1234!`
- **Patient:** `patient@test.com` / `Test1234!`

---

**Status:** Ready for Execution. Befolge die Phasen sequenziell (Backend → Frontend → Tests).
