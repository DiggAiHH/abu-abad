# 🚀 TESTING LINKS - Abu-Abad Platform

> **Status:** DEPLOYED (Frontend)  
> **Erstellt:** 2026-01-20  
> **Aktualisiert:** 2026-01-23

---

## ✅ STATUS: FRONTEND DEPLOYED

Frontend ist live auf Netlify. Backend ist noch offen.

---

## 🎯 DEPLOYMENT OPTIONEN

### Option 1: Netlify Deploy (Empfohlen - Schnellster Test)

**Ohne CLI - Drag & Drop:**

1. Gehe zu: https://app.netlify.com/drop
2. Dragge den Ordner: `/workspaces/abu-abad/apps/frontend/dist`
3. Warte auf Upload (~30 Sekunden)
4. Netlify gibt dir eine URL: `https://[random-name].netlify.app`

**Wenn du aus dem Repo baust (Netlify UI):**
- Base Directory: **leer lassen**
- Build Command: `npm ci && npm run build --workspace=apps/frontend`
- Publish Directory: `apps/frontend/dist`

**Mit CLI (wenn installiert):**
```bash
cd /workspaces/abu-abad
npm install -g netlify-cli
netlify login
netlify deploy --dir apps/frontend/dist --prod
```

---

### Option 2: Railway Backend Deploy

**Web UI Method:**

1. Gehe zu: https://railway.app/new
2. Wähle: "Deploy from GitHub repo"
3. Verbinde Repository: `DiggAiHH/abu-abad`
4. Branch: `v8-compliant-isolated`
5. Root Directory: `/apps/backend`
6. Railway erkennt automatisch `Procfile`
7. Add PostgreSQL Plugin
8. Setze Environment Variables:
   ```
   JWT_SECRET=<32+ Zeichen>
   REFRESH_TOKEN_SECRET=<32+ Zeichen>
   ENCRYPTION_KEY=<32+ Zeichen>
   STRIPE_SECRET_KEY=sk_test_...
   PORT=4000
   NODE_ENV=production
   ```
9. Deploy starten

---

### Option 3: Vercel Deploy (Alternative)

**Frontend:**
```bash
npm install -g vercel
cd /workspaces/abu-abad/apps/frontend
vercel --prod
```

---

## 🧪 LOKALE TEST-URLS (Aktuell)

Da noch nicht deployed, hier die lokalen URLs:

### Frontend (Dev Mode)
```bash
cd /workspaces/abu-abad/apps/frontend
npm run dev
```
**URL:** http://localhost:5175

### Backend (Dev Mode)
```bash
cd /workspaces/abu-abad/apps/backend
npm run dev
```
**URL:** http://localhost:4000

---

## 📋 MANUELLE DEPLOYMENT STEPS (Ohne Scripts)

### 1. Git Commit & Push

```bash
cd /workspaces/abu-abad

# Status prüfen
git status

# Alles stagen
git add -A

# Commit
git commit -m "feat: i18n (19 languages), deployment ready"

# Push
git push origin v8-compliant-isolated
```

### 2. Netlify Drag & Drop Deploy

1. Öffne https://app.netlify.com/drop
2. Dragge `/workspaces/abu-abad/apps/frontend/dist` Ordner ins Fenster
3. Warte auf Upload
4. **KOPIERE DIE URL** (z.B. `https://graceful-unicorn-abc123.netlify.app`)

### 3. Backend auf Railway

1. https://railway.app → "New Project"
2. "Deploy from GitHub repo"
3. Repository: `DiggAiHH/abu-abad`
4. Branch: `v8-compliant-isolated`
5. Root Directory: `/apps/backend` (oder leer lassen, Railway findet Procfile)
6. Add PostgreSQL Database
7. Set Environment Variables (siehe unten)
8. Deploy
9. **KOPIERE DIE URL** (z.B. `https://abu-abad-backend.railway.app`)

### 4. Update Frontend ENV

Nach Backend-Deploy:

1. Gehe zu Netlify Dashboard → Site Settings → Environment Variables
2. Add:
   ```
   VITE_API_URL=https://abu-abad-backend.railway.app
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
   VITE_PEER_SERVER_HOST=abu-abad-backend.railway.app
   VITE_PEER_SERVER_PORT=443
   VITE_PEER_SERVER_SECURE=true
   ```
3. Trigger Redeploy (Site Configuration → Deploys → Trigger Deploy)

---

## 🔑 ENVIRONMENT VARIABLES REFERENCE

### Backend (Railway)

**Generiere Secrets:**
```bash
# JWT Secret
openssl rand -base64 32

# Refresh Token Secret
openssl rand -base64 32

# Encryption Key
openssl rand -base64 32
```

**Setze in Railway:**
```
JWT_SECRET=[Generated Above]
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=[Generated Above]
REFRESH_TOKEN_EXPIRES_IN=7d
ENCRYPTION_KEY=[Generated Above]
PORT=4000
NODE_ENV=production
STRIPE_SECRET_KEY=sk_test_... (from Stripe Dashboard)
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
ALLOWED_ORIGINS=https://[your-netlify-site].netlify.app
FRONTEND_URL=https://[your-netlify-site].netlify.app
```

**DATABASE_URL:** Automatisch von Railway PostgreSQL Plugin gesetzt

---

## 🎯 NACH DEPLOYMENT: TEST-CHECKLIST

### Frontend Tests

1. [ ] Öffne Live-URL (Netlify)
2. [ ] Startseite lädt ohne Console-Errors
3. [ ] Language-Switcher sichtbar (rechts oben oder Footer)
4. [ ] Wechsel zu Arabisch → RTL funktioniert (Text von rechts nach links)
5. [ ] Login-Formular sichtbar
6. [ ] Register-Link funktioniert
7. [ ] Privacy-Link → Volltext sichtbar (`/privacy`)
8. [ ] Network-Tab: API-Requests zu Backend sichtbar

### Backend Tests

1. [ ] Health-Check: `curl https://[backend-url]/api/health`
   - Erwartung: `{"status":"healthy"}`
2. [ ] Auth-Check: `curl https://[backend-url]/api/auth/check`
   - Erwartung: `{"authenticated":false}`
3. [ ] CORS: Frontend kann API erreichen (keine CORS-Errors in Console)

### i18n Tests

1. [ ] Language-Switcher zeigt alle 19 Sprachen
2. [ ] Sprachwechsel ohne Page-Reload
3. [ ] Texte ändern sich beim Wechsel
4. [ ] RTL-Sprachen (ar, fa, ckb) spiegeln Layout
5. [ ] Privacy-Seite verfügbar in allen Sprachen

---

## 📍 LIVE URLS (Nach Deployment)

**Frontend (Prod):** `https://abu-abad-therapy-app.netlify.app`  
**Frontend (Deploy Preview):** `https://6973942efc679aab23892b53--abu-abad-therapy-app.netlify.app`

**Backend:** `______________________` (Railway URL hier eintragen)

---

## ❓ TROUBLESHOOTING

### Problem: "Failed to fetch" in Console

**Ursache:** VITE_API_URL nicht gesetzt oder falsch

**Fix:**
1. Netlify Dashboard → Site Settings → Environment Variables
2. Prüfe: `VITE_API_URL=https://[backend-url]`
3. Redeploy

### Problem: CORS Error

**Ursache:** Backend ALLOWED_ORIGINS enthält nicht die Netlify-URL

**Fix:**
1. Railway Dashboard → Variables
2. Prüfe: `ALLOWED_ORIGINS=https://[frontend-url]`
3. Redeploy Backend

### Problem: Privacy-Seite 404

**Ursache:** Netlify SPA-Redirect fehlt

**Fix:**
- `netlify.toml` muss enthalten:
  ```toml
  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
  ```
- Bereits vorhanden in unserem Config ✅

---

## 🚀 SCHNELLSTER WEG ZUM TESTEN (5 Minuten)

1. **Git Push** (falls nicht schon gemacht):
   ```bash
   cd /workspaces/abu-abad
   git add -A
   git commit -m "feat: deployment ready"
   git push origin v8-compliant-isolated
   ```

2. **Netlify Drag & Drop:**
   - https://app.netlify.com/drop
   - Dragge `apps/frontend/dist` Ordner
   - **KOPIERE URL**

3. **Test Frontend:**
   - Öffne kopierte URL
   - Language-Switcher testen
   - Privacy-Seite prüfen

4. **(Optional) Backend später:**
   - Railway Deploy (siehe oben)
   - ENV in Netlify setzen
   - Redeploy

---

**Status:** Frontend deployed. Backend pending.
