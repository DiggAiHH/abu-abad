# 🚀 DEPLOYMENT COMMAND SCRIPT

# Dieses Script führt alle Deployment-Schritte automatisch aus.
# Vor Ausführung: Railway/Netlify CLI installieren und einloggen.

set -e  # Exit bei Fehler

echo "═══════════════════════════════════════════════════════════"
echo "🚀 ABU-ABAD DEPLOYMENT - Automated Script"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────────────────────
# PHASE 1: PRE-FLIGHT CHECKS
# ─────────────────────────────────────────────────────────────

echo "📋 Phase 1: Pre-Flight Checks"
echo "───────────────────────────────────────────────────────────"

# Check if dist/ exists
if [ ! -d "apps/frontend/dist" ]; then
  echo "❌ ERROR: apps/frontend/dist/ nicht gefunden!"
  echo "   Führe erst aus: cd apps/frontend && npm run build"
  exit 1
fi

echo "✅ Frontend dist/ existiert"

# Check ENV files
if [ ! -f ".env" ]; then
  echo "❌ ERROR: .env nicht gefunden! Kopiere .env.example"
  exit 1
fi

echo "✅ .env gefunden"

# Check Railway CLI
if ! command -v railway &> /dev/null; then
  echo "⚠️  Railway CLI nicht installiert. Installiere mit:"
  echo "   npm install -g @railway/cli"
  read -p "Fortfahren ohne Railway Deploy? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
  SKIP_RAILWAY=true
fi

# Check Netlify CLI
if ! command -v netlify &> /dev/null; then
  echo "⚠️  Netlify CLI nicht installiert. Installiere mit:"
  echo "   npm install -g netlify-cli"
  read -p "Fortfahren ohne Netlify Deploy? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
  SKIP_NETLIFY=true
fi

echo ""

# ─────────────────────────────────────────────────────────────
# PHASE 2: GIT COMMIT
# ─────────────────────────────────────────────────────────────

echo "📦 Phase 2: Git Commit"
echo "───────────────────────────────────────────────────────────"

# Check if there are changes
if [[ -z $(git status --porcelain) ]]; then
  echo "✅ Keine Änderungen zum Committen"
else
  echo "📝 Committe alle Änderungen..."
  git add -A
  git commit -m "feat: i18n (19 languages), deployment configs, ready for production

- i18n infrastructure (react-i18next, i18next-http-backend)
- 19 language support (RTL: ar, fa, ckb)
- Privacy page with DSGVO-compliant text (de, en)
- LanguageSwitcher component + Layout
- Railway backend config (Procfile, railway.json)
- Netlify frontend config (netlify.toml, .nvmrc)
- ESLint configs for both workspaces
- All Pages refactored to use useTranslation
- Backend vitest.config.ts for testing
- LAUFBAHN documentation system

BREAKING CHANGE: Frontend requires locale files to load
"
  
  echo "✅ Commit erfolgreich"
  
  read -p "Änderungen zu GitHub pushen? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin v8-compliant-isolated
    echo "✅ Push erfolgreich"
  fi
fi

echo ""

# ─────────────────────────────────────────────────────────────
# PHASE 3: BACKEND DEPLOYMENT (Railway)
# ─────────────────────────────────────────────────────────────

if [ "$SKIP_RAILWAY" != true ]; then
  echo "🚂 Phase 3: Backend Deployment (Railway)"
  echo "───────────────────────────────────────────────────────────"
  
  # Check if logged in
  if ! railway whoami &> /dev/null; then
    echo "❌ Nicht bei Railway eingeloggt. Führe aus:"
    echo "   railway login"
    exit 1
  fi
  
  echo "✅ Railway Login OK"
  
  # Generate secrets
  echo "🔐 Generiere Secrets..."
  JWT_SECRET=$(openssl rand -base64 32)
  REFRESH_SECRET=$(openssl rand -base64 32)
  ENCRYPTION_KEY=$(openssl rand -base64 32)
  
  echo "✅ Secrets generiert"
  
  # Set environment variables
  echo "📝 Setze Environment Variables..."
  railway variables set JWT_SECRET="$JWT_SECRET"
  railway variables set JWT_EXPIRES_IN="15m"
  railway variables set REFRESH_TOKEN_SECRET="$REFRESH_SECRET"
  railway variables set REFRESH_TOKEN_EXPIRES_IN="7d"
  railway variables set ENCRYPTION_KEY="$ENCRYPTION_KEY"
  railway variables set PORT="3000"
  railway variables set NODE_ENV="production"
  
  echo "✅ ENV Variables gesetzt"
  
  # Deploy
  echo "🚀 Deploye Backend..."
  railway up
  
  echo "✅ Backend deployed"
  
  # Get URL
  BACKEND_URL=$(railway status --json | jq -r '.url')
  echo "📍 Backend URL: $BACKEND_URL"
  
  # Health check
  echo "🏥 Health Check..."
  sleep 10  # Wait for startup
  if curl -f "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    echo "✅ Backend Health Check OK"
  else
    echo "⚠️  Health Check fehlgeschlagen. Prüfe Logs mit: railway logs"
  fi
  
  echo ""
else
  echo "⏭️  Railway Deploy übersprungen"
  echo ""
fi

# ─────────────────────────────────────────────────────────────
# PHASE 4: FRONTEND DEPLOYMENT (Netlify)
# ─────────────────────────────────────────────────────────────

if [ "$SKIP_NETLIFY" != true ]; then
  echo "🌐 Phase 4: Frontend Deployment (Netlify)"
  echo "───────────────────────────────────────────────────────────"
  
  # Check if logged in
  if ! netlify status &> /dev/null; then
    echo "❌ Nicht bei Netlify eingeloggt. Führe aus:"
    echo "   netlify login"
    exit 1
  fi
  
  echo "✅ Netlify Login OK"
  
  # Deploy
  echo "🚀 Deploye Frontend..."
  netlify deploy --prod --dir apps/frontend/dist
  
  echo "✅ Frontend deployed"
  
  # Get URL
  FRONTEND_URL=$(netlify sites:list | grep "abu-abad" | awk '{print $2}')
  echo "📍 Frontend URL: $FRONTEND_URL"
  
  # Set ENV vars
  if [ -n "$BACKEND_URL" ]; then
    echo "📝 Setze Backend-URL in Netlify..."
    netlify env:set VITE_API_URL "$BACKEND_URL"
    
    # Rebuild mit ENV
    echo "🔄 Rebuild mit ENV Variables..."
    netlify build
    netlify deploy --prod
    
    echo "✅ ENV Variables gesetzt + Rebuild OK"
  fi
  
  echo ""
else
  echo "⏭️  Netlify Deploy übersprungen"
  echo ""
fi

# ─────────────────────────────────────────────────────────────
# PHASE 5: SMOKE TESTS
# ─────────────────────────────────────────────────────────────

echo "🧪 Phase 5: Smoke Tests"
echo "───────────────────────────────────────────────────────────"

if [ -n "$BACKEND_URL" ]; then
  echo "Testing Backend: $BACKEND_URL/api/health"
  if curl -f "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    echo "✅ Backend Health OK"
  else
    echo "❌ Backend Health FAIL"
  fi
fi

if [ -n "$FRONTEND_URL" ]; then
  echo "Testing Frontend: $FRONTEND_URL"
  if curl -f "$FRONTEND_URL" > /dev/null 2>&1; then
    echo "✅ Frontend lädt OK"
  else
    echo "❌ Frontend FAIL"
  fi
fi

echo ""

# ─────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════════════"
echo "✅ DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📍 LIVE URLs:"
echo "   Backend:  ${BACKEND_URL:-[nicht deployed]}"
echo "   Frontend: ${FRONTEND_URL:-[nicht deployed]}"
echo ""
echo "🧪 Testing:"
echo "   1. Öffne Frontend-URL im Browser"
echo "   2. Teste Language-Switcher (19 Sprachen)"
echo "   3. Teste Login/Register"
echo "   4. Prüfe Privacy-Seite (/privacy)"
echo ""
echo "📝 Logs:"
echo "   Backend:  railway logs"
echo "   Frontend: netlify logs"
echo ""
