# 🚀 BACKEND DEPLOYMENT PLAN - Railway/Render

> **Absoluter Pfad:** `/workspaces/abu-abad/.laufbahn/BACKEND_DEPLOYMENT.md`  
> **Erstellt:** 2026-01-14  
> **Status:** AKTIV - Ready für Deploy

---

## 1️⃣ KLARES ZIEL

**Primärziel:** Backend-API auf Railway deployen mit PostgreSQL-Datenbank und alle Environment-Variablen konfigurieren.

**Erfolgskriterien:**
- ✅ Backend läuft auf Railway mit eigener URL
- ✅ PostgreSQL-Datenbank provisioniert und verbunden
- ✅ Health-Check Endpoint `/api/health` erreichbar
- ✅ CORS konfiguriert für Netlify Frontend-URL
- ✅ Alle Secrets gesetzt (JWT, Encryption, Stripe)
- ✅ Migrations ausgeführt

---

## 2️⃣ GERÄTE & METHODIK

### 2.1 Platform-Wahl: Railway

**Begründung:**
- ✅ Integrierte PostgreSQL (ein Klick)
- ✅ Automatische HTTPS
- ✅ Environment Variables UI
- ✅ GitHub Integration
- ✅ Free Tier: $5 Credit/Monat

**Alternative:** Render.com (Free Tier PostgreSQL, aber langsamer Cold-Start)

### 2.2 Tech-Stack (Backend)

| Komponente | Version | Details |
|------------|---------|---------|
| **Runtime** | Node.js 20 | TypeScript via `tsx` |
| **Framework** | Express 4.18 | REST API |
| **Database** | PostgreSQL 15+ | Via Railway Plugin |
| **ORM** | Raw SQL | `pg` library |
| **Auth** | JWT | Access (15m) + Refresh (7d) |
| **Encryption** | AES-256 | `crypto-js` |
| **Payment** | Stripe | Test Mode |
| **Video** | PeerJS | Port 9001 |

### 2.3 Build-Process

```
Source Code (apps/backend/src/)
    ↓ (tsc)
TypeScript → JavaScript (apps/backend/dist/)
    ↓ (node dist/index.js)
Express Server starts (Port from $PORT env)
    ↓
Railway assigns HTTPS URL
```

---

## 3️⃣ SPRACHEN

**Backend:** TypeScript (kompiliert zu ES2022 JavaScript)

**Irrelevant für Deployment:** Backend ist language-agnostic (API-only, kein UI)

---

## 4️⃣ STRUKTUR (Step-by-Step)

### Phase 1: Railway Project Setup

```bash
# 1.1 Railway CLI installieren
npm install -g @railway/cli

# 1.2 Login (öffnet Browser)
railway login

# 1.3 Neues Projekt erstellen
cd /workspaces/abu-abad
railway init

# Interaktiv:
# - Project name: abu-abad-backend
# - Start from: Empty project

# 1.4 PostgreSQL hinzufügen
railway add postgresql

# Railway generiert automatisch:
# - DATABASE_URL
# - POSTGRES_USER
# - POSTGRES_PASSWORD
# - POSTGRES_DB
```

### Phase 2: Environment Variables konfigurieren

```bash
# 2.1 KRITISCHE Secrets generieren
# JWT Secret (Base64, 32 Bytes)
openssl rand -base64 32
# Output: IEE1N2dV23WqlutmPGABRGfz/5MWooc7Cgld9sCKM1Q=

# Refresh Token Secret
openssl rand -base64 32
# Output: vXno0xdl5grDHlhZeGxB7ECY+XhiQqjjQZ6OEyoXCoI=

# Encryption Key
openssl rand -base64 32
# Output: [UNIQUE_KEY]

# 2.2 Secrets in Railway setzen
railway variables set JWT_SECRET="[GENERATED_KEY_1]"
railway variables set JWT_EXPIRES_IN="15m"
railway variables set REFRESH_TOKEN_SECRET="[GENERATED_KEY_2]"
railway variables set REFRESH_TOKEN_EXPIRES_IN="7d"
railway variables set ENCRYPTION_KEY="[GENERATED_KEY_3]"

# 2.3 Server-Konfiguration
railway variables set PORT="3000"
railway variables set NODE_ENV="production"

# 2.4 CORS & Frontend-URL (NACH Netlify Deploy)
railway variables set ALLOWED_ORIGINS="https://[NETLIFY_SITE].netlify.app"
railway variables set FRONTEND_URL="https://[NETLIFY_SITE].netlify.app"

# 2.5 Stripe (Test Keys für Testing)
railway variables set STRIPE_SECRET_KEY="sk_test_XXXXXXXX"
railway variables set STRIPE_PUBLISHABLE_KEY="pk_test_XXXXXXXX"
railway variables set STRIPE_WEBHOOK_SECRET="whsec_XXXXXXXX"

# 2.6 Database-URL (automatisch von Railway gesetzt)
# Prüfe mit:
railway variables
# DATABASE_URL sollte automatisch existieren
```

### Phase 3: Deploy Backend

```bash
# 3.1 Link Repo zu Railway (GitHub Integration)
railway link

# 3.2 Deploy via CLI
railway up

# ODER: GitHub Push (Auto-Deploy)
git add railway.json apps/backend/Procfile
git commit -m "feat: Railway deployment config"
git push origin v8-compliant-isolated

# 3.3 Warte auf Deployment (URL wird angezeigt)
railway status

# 3.4 Logs anzeigen
railway logs
```

### Phase 4: Database Migrations

```bash
# 4.1 SSH in Railway-Container (oder via Railway CLI)
railway run npm run migrate --workspace=apps/backend

# ODER: Remote-Migration via Connection String
# Lade DATABASE_URL aus Railway
railway variables get DATABASE_URL

# Führe Migration lokal gegen Remote-DB aus
DATABASE_URL="postgresql://[RAILWAY_URL]" npm run migrate --workspace=apps/backend

# 4.2 Seed-Daten (optional)
railway run npm run seed --workspace=apps/backend
```

### Phase 5: Verifizierung

```bash
# 5.1 Health-Check
curl https://[PROJECT].railway.app/api/health

# Erwartete Response:
# { "status": "healthy", "timestamp": "2026-01-14T..." }

# 5.2 Test Auth-Endpoint
curl https://[PROJECT].railway.app/api/auth/check

# Erwartete Response:
# { "authenticated": false }

# 5.3 Railway-URL notieren für Netlify
railway status --json | jq -r '.url'
# Output: https://abu-abad-backend.railway.app
```

---

## 5️⃣ QUALITÄT & MUSTER

### 5.1 DSGVO-Compliance

**Secrets Management:**
- ✅ Keine Hardcoded Secrets im Code
- ✅ JWT-Keys via Environment Variables
- ✅ Encryption-Keys via Railway Secrets
- ✅ Database-Credentials automatisch rotiert

**Logging:**
- ✅ Keine PII in Logs (siehe `logger.ts`)
- ✅ Masking von sensiblen Daten
- ✅ Audit-Logs für Datenzugriffe

**Data Minimierung:**
- ✅ DTOs für API-Responses (keine rohen Entities)
- ✅ Selective Field Loading
- ✅ Crypto-Shredding für Recht auf Löschung

### 5.2 Security Best Practices

**CRA (Cyber Resilience Act):**
- ✅ Helmet für Security Headers
- ✅ CORS Whitelist (nur Netlify-URL)
- ✅ Rate-Limiting (100 req/15min)
- ✅ Input-Validation via `express-validator`
- ✅ SQL Injection Prevention (Prepared Statements)

**Supply Chain:**
- ✅ Pinned Dependencies (`package.json`)
- ✅ Node Version in `package.json` engines
- ✅ Automated Security Scans (Railway built-in)

### 5.3 Performance

**Database:**
- Indexes auf `email`, `user_id`, `created_at`
- Connection Pooling via `pg` (max 20)
- Query Optimization (SELECT only needed fields)

**Caching:**
- Redis für Session-Storage (optional, später)
- In-Memory Cache für statische Daten

### 5.4 Monitoring

```bash
# Railway bietet:
# - Automatic Logging (railway logs)
# - Metrics Dashboard (CPU, RAM, Network)
# - Health-Check Monitoring
# - Alerting (bei Crash)

# Custom Health-Check:
# GET /api/health
# Response:
{
  "status": "healthy",
  "timestamp": "2026-01-14T12:00:00Z",
  "database": "connected",
  "uptime": 3600
}
```

---

## 6️⃣ DEPLOYMENT COMMANDS (Ready-to-Execute)

### Kompletter Deployment-Flow

```bash
# ═══════════════════════════════════════════════════════════
# RAILWAY BACKEND DEPLOYMENT - Abu-Abad API
# ═══════════════════════════════════════════════════════════

# 1. Railway CLI installieren
npm install -g @railway/cli

# 2. Login
railway login

# 3. Projekt erstellen
cd /workspaces/abu-abad
railway init
# Name: abu-abad-backend

# 4. PostgreSQL hinzufügen
railway add postgresql

# 5. Secrets generieren & setzen
JWT_SECRET=$(openssl rand -base64 32)
REFRESH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

railway variables set JWT_SECRET="$JWT_SECRET"
railway variables set JWT_EXPIRES_IN="15m"
railway variables set REFRESH_TOKEN_SECRET="$REFRESH_SECRET"
railway variables set REFRESH_TOKEN_EXPIRES_IN="7d"
railway variables set ENCRYPTION_KEY="$ENCRYPTION_KEY"
railway variables set NODE_ENV="production"
railway variables set PORT="3000"

# 6. CORS konfigurieren (PLACEHOLDER - nach Netlify Deploy ersetzen)
railway variables set ALLOWED_ORIGINS="https://PLACEHOLDER.netlify.app"
railway variables set FRONTEND_URL="https://PLACEHOLDER.netlify.app"

# 7. Stripe Keys setzen (Test-Modus)
railway variables set STRIPE_SECRET_KEY="sk_test_XXXXXXXX"
railway variables set STRIPE_PUBLISHABLE_KEY="pk_test_XXXXXXXX"

# 8. Deploy
railway up

# 9. Logs prüfen
railway logs --follow

# 10. Backend-URL extrahieren
BACKEND_URL=$(railway status --json | jq -r '.url')
echo "Backend URL: $BACKEND_URL"

# 11. Health-Check
curl $BACKEND_URL/api/health

# 12. Database-Migration
railway run npm run migrate --workspace=apps/backend

# 13. URL für Netlify notieren
echo "Setze in Netlify: VITE_API_URL=$BACKEND_URL"
```

---

## 7️⃣ LAUFBAHN (Tracking)

| ID | Aktion | Status | Timestamp | Ergebnis | Ausführer |
|----|--------|--------|-----------|----------|-----------|
| 1.1 | Railway CLI installieren | ⏳ TODO | - | - | User |
| 1.2 | Railway Login | ⏳ TODO | - | - | User |
| 1.3 | Projekt erstellen | ⏳ TODO | - | - | User |
| 1.4 | PostgreSQL hinzufügen | ⏳ TODO | - | - | User |
| 2.1 | JWT Secrets generieren | ⏳ TODO | - | - | User |
| 2.2 | Environment Vars setzen | ⏳ TODO | - | - | User |
| 2.3 | CORS konfigurieren | ⏳ TODO | - | Nach Netlify | User |
| 3.1 | Railway Link Repo | ⏳ TODO | - | - | User |
| 3.2 | Deploy Backend | ⏳ TODO | - | - | User |
| 3.3 | Status prüfen | ⏳ TODO | - | - | User |
| 4.1 | Database Migration | ⏳ TODO | - | - | User |
| 5.1 | Health-Check Test | ⏳ TODO | - | - | User |
| 5.2 | Backend-URL notieren | ⏳ TODO | - | Für Netlify | User |

---

## 8️⃣ INTEGRATION MIT NETLIFY

### Nach erfolgreichem Backend-Deploy

```bash
# 1. Backend-URL aus Railway holen
BACKEND_URL=$(railway status --json | jq -r '.url')

# 2. In Netlify setzen
netlify env:set VITE_API_URL="$BACKEND_URL"

# 3. CORS im Backend updaten (Railway)
railway variables set ALLOWED_ORIGINS="https://[NETLIFY_SITE].netlify.app"
railway variables set FRONTEND_URL="https://[NETLIFY_SITE].netlify.app"

# 4. Backend neu deployen (CORS-Änderung aktivieren)
railway up

# 5. Frontend neu deployen (neue VITE_API_URL nutzen)
netlify deploy --prod --dir apps/frontend/dist
```

---

## 9️⃣ TROUBLESHOOTING

### Problem 1: Build schlägt fehl

**Symptom:** "tsc: command not found"

**Fix:**
```bash
# In railway.json Build-Command prüfen:
"buildCommand": "cd apps/backend && npm install && npm run build"
```

### Problem 2: Database-Connection Timeout

**Symptom:** "ECONNREFUSED" bei DB-Zugriff

**Fix:**
```bash
# Prüfe DATABASE_URL
railway variables get DATABASE_URL

# Format muss sein:
# postgresql://user:pass@host:port/dbname

# Stelle sicher dass PostgreSQL-Plugin aktiv ist:
railway plugins
```

### Problem 3: CORS-Fehler im Frontend

**Symptom:** "CORS policy: No 'Access-Control-Allow-Origin'"

**Fix:**
```bash
# ALLOWED_ORIGINS muss EXAKT die Netlify-URL sein
railway variables set ALLOWED_ORIGINS="https://abu-abad.netlify.app"

# Mehrere Origins (kommasepariert):
railway variables set ALLOWED_ORIGINS="https://abu-abad.netlify.app,https://preview.netlify.app"
```

### Problem 4: Health-Check schlägt fehl

**Symptom:** Railway markiert Service als "unhealthy"

**Fix:**
```typescript
// apps/backend/src/index.ts - Health-Check Endpoint prüfen
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
```

---

## 🔟 SUCCESS CRITERIA

- [ ] Railway Backend läuft (Status: "Active")
- [ ] PostgreSQL verbunden (DATABASE_URL gesetzt)
- [ ] Health-Check erreichbar: `curl [URL]/api/health`
- [ ] Secrets gesetzt (JWT, Encryption, Stripe)
- [ ] CORS konfiguriert für Netlify-URL
- [ ] Migrations erfolgreich (Tabellen existieren)
- [ ] Logs zeigen keine Errors
- [ ] Backend-URL dokumentiert für Netlify

---

## 📎 REFERENZEN

- **Railway Dashboard:** https://railway.app/dashboard
- **Backend Source:** `/workspaces/abu-abad/apps/backend/`
- **Config Files:** 
  - `/workspaces/abu-abad/railway.json`
  - `/workspaces/abu-abad/apps/backend/Procfile`
- **Tracking Doc:** `/workspaces/abu-abad/.laufbahn/BACKEND_DEPLOYMENT.md`
- **Frontend Deploy:** `/workspaces/abu-abad/.laufbahn/DEPLOYMENT_EXECUTION.md`

---

> **NEXT STEP:** User führt Railway-Deployment aus → Backend-URL notieren → Netlify VITE_API_URL setzen
