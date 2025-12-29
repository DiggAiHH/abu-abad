#!/bin/bash

# ══════════════════════════════════════════════════════════════
# ONE-COMMAND DEPLOYMENT - Abu-Abbad Teletherapie Platform
# ══════════════════════════════════════════════════════════════
# USAGE: ./deploy.sh [production|staging|local]
# TARGETS: Netlify (Frontend) + Railway/Render (Backend)
# ══════════════════════════════════════════════════════════════

set -e  # Exit on error
trap 'echo "❌ Fehler bei Zeile $LINENO"' ERR

# ══════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════
ENV="${1:-local}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "════════════════════════════════════════════════════════════"
echo "  🚀 ABU-ABBAD DEPLOYMENT GESTARTET"
echo "════════════════════════════════════════════════════════════"
echo -e "${NC}"
echo "🌍 Environment: $ENV"
echo "📂 Project:     $PROJECT_ROOT"
echo ""

# ══════════════════════════════════════════════════════════════
# STEP 1: Pre-Flight Checks
# ══════════════════════════════════════════════════════════════
echo -e "${YELLOW}[1/8]${NC} Führe Pre-Flight Checks durch..."

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js nicht gefunden. Bitte installieren: https://nodejs.org${NC}"
  exit 1
fi
echo "✅ Node.js $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
  echo -e "${RED}❌ npm nicht gefunden${NC}"
  exit 1
fi
echo "✅ npm $(npm --version)"

# Check Git
if ! command -v git &> /dev/null; then
  echo -e "${RED}❌ Git nicht gefunden${NC}"
  exit 1
fi
echo "✅ Git $(git --version | cut -d' ' -f3)"

# Check for uncommitted changes (nur production)
if [ "$ENV" = "production" ]; then
  if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}❌ Uncommitted changes gefunden. Bitte committen vor Production Deployment.${NC}"
    exit 1
  fi
  echo "✅ Git clean"
fi

# ══════════════════════════════════════════════════════════════
# STEP 2: Environment Setup
# ══════════════════════════════════════════════════════════════
echo -e "\n${YELLOW}[2/8]${NC} Lade Environment Variables..."

if [ "$ENV" = "production" ]; then
  ENV_FILE=".env.production"
elif [ "$ENV" = "staging" ]; then
  ENV_FILE=".env.staging"
else
  ENV_FILE=".env.local"
fi

if [ -f "$PROJECT_ROOT/$ENV_FILE" ]; then
  export $(grep -v '^#' "$PROJECT_ROOT/$ENV_FILE" | xargs)
  echo "✅ Geladen: $ENV_FILE"
else
  echo -e "${YELLOW}⚠️  $ENV_FILE nicht gefunden - nutze defaults${NC}"
fi

# ══════════════════════════════════════════════════════════════
# STEP 3: Dependencies Installation
# ══════════════════════════════════════════════════════════════
echo -e "\n${YELLOW}[3/8]${NC} Installiere Dependencies..."

cd "$PROJECT_ROOT"

# Root dependencies
echo "📦 Root package.json..."
npm install --silent

# Frontend dependencies
echo "📦 Frontend dependencies..."
cd apps/frontend
npm install --silent
cd ../..

# Backend dependencies
echo "📦 Backend dependencies..."
cd apps/backend
npm install --silent
cd ../..

echo "✅ Dependencies installiert"

# ══════════════════════════════════════════════════════════════
# STEP 4: Run Tests (nur production/staging)
# ══════════════════════════════════════════════════════════════
if [ "$ENV" != "local" ]; then
  echo -e "\n${YELLOW}[4/8]${NC} Führe Tests durch..."
  
  # Install Playwright (falls noch nicht vorhanden)
  if [ ! -d "node_modules/@playwright/test" ]; then
    echo "📦 Installiere Playwright..."
    npm install -D @playwright/test
    npx playwright install --with-deps chromium
  fi
  
  # Run E2E Tests
  echo "🧪 Running E2E Tests..."
  npx playwright test --reporter=list --max-failures=5
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests fehlgeschlagen. Deployment abgebrochen.${NC}"
    exit 1
  fi
  
  echo "✅ Tests erfolgreich"
else
  echo -e "\n${YELLOW}[4/8]${NC} Tests übersprungen (local environment)"
fi

# ══════════════════════════════════════════════════════════════
# STEP 5: Build Frontend
# ══════════════════════════════════════════════════════════════
echo -e "\n${YELLOW}[5/8]${NC} Baue Frontend..."

cd "$PROJECT_ROOT/apps/frontend"

# Set environment variables for build
export VITE_API_URL="${VITE_API_URL:-http://localhost:3000}"
export VITE_PEER_SERVER_HOST="${VITE_PEER_SERVER_HOST:-localhost}"
export VITE_PEER_SERVER_PORT="${VITE_PEER_SERVER_PORT:-3001}"
export VITE_PEER_SERVER_SECURE="${VITE_PEER_SERVER_SECURE:-false}"

npm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Frontend Build fehlgeschlagen${NC}"
  exit 1
fi

echo "✅ Frontend gebaut: apps/frontend/dist"

# ══════════════════════════════════════════════════════════════
# STEP 6: Build Backend
# ══════════════════════════════════════════════════════════════
echo -e "\n${YELLOW}[6/8]${NC} Baue Backend..."

cd "$PROJECT_ROOT/apps/backend"

# TypeScript Compile (falls tsconfig.json vorhanden)
if [ -f "tsconfig.json" ]; then
  npx tsc
  echo "✅ Backend TypeScript compiled"
else
  echo "⚠️  Kein tsconfig.json gefunden - überspringe TS-Compile"
fi

# ══════════════════════════════════════════════════════════════
# STEP 7: Deploy
# ══════════════════════════════════════════════════════════════
echo -e "\n${YELLOW}[7/8]${NC} Deployment..."

if [ "$ENV" = "local" ]; then
  # ════════════════════════════════════════════════════════════
  # LOCAL: Docker Compose
  # ════════════════════════════════════════════════════════════
  echo "🐳 Starte Docker Compose..."
  
  cd "$PROJECT_ROOT"
  
  if [ -f "docker-compose.prod.yml" ]; then
    docker-compose -f docker-compose.prod.yml up -d --build
    echo "✅ Docker Container gestartet"
    echo ""
    echo "🌐 Frontend:  http://localhost"
    echo "🔌 Backend:   http://localhost:3000"
    echo "📊 Logs:      docker-compose -f docker-compose.prod.yml logs -f"
  else
    echo -e "${YELLOW}⚠️  docker-compose.prod.yml nicht gefunden${NC}"
  fi
  
elif [ "$ENV" = "staging" ] || [ "$ENV" = "production" ]; then
  # ════════════════════════════════════════════════════════════
  # PRODUCTION/STAGING: Netlify + Railway/Render
  # ════════════════════════════════════════════════════════════
  
  # Frontend -> Netlify
  echo "🌐 Deploying Frontend to Netlify..."
  
  if ! command -v netlify &> /dev/null; then
    echo "📦 Installiere Netlify CLI..."
    npm install -g netlify-cli
  fi
  
  cd "$PROJECT_ROOT/apps/frontend"
  
  if [ "$ENV" = "production" ]; then
    netlify deploy --prod --dir=dist
  else
    netlify deploy --dir=dist
  fi
  
  echo "✅ Frontend deployed"
  
  # Backend -> Railway/Render (manueller Trigger)
  echo ""
  echo "📡 Backend Deployment..."
  echo -e "${YELLOW}⚠️  Backend muss manuell deployed werden:${NC}"
  echo "   Railway:  railway up"
  echo "   Render:   git push render main"
  echo ""
  echo "Oder: GitHub Actions Workflow triggern"
  
else
  echo -e "${RED}❌ Unbekanntes Environment: $ENV${NC}"
  exit 1
fi

# ══════════════════════════════════════════════════════════════
# STEP 8: Health Checks
# ══════════════════════════════════════════════════════════════
echo -e "\n${YELLOW}[8/8]${NC} Führe Health Checks durch..."

if [ "$ENV" = "local" ]; then
  # Warte 10 Sekunden für Container-Start
  echo "⏳ Warte auf Container-Start..."
  sleep 10
  
  # Check Frontend
  if curl -sf http://localhost > /dev/null; then
    echo "✅ Frontend erreichbar"
  else
    echo -e "${RED}❌ Frontend nicht erreichbar${NC}"
  fi
  
  # Check Backend
  if curl -sf http://localhost:3000/api/health > /dev/null; then
    echo "✅ Backend erreichbar"
  else
    echo -e "${YELLOW}⚠️  Backend nicht erreichbar (möglicherweise noch startend)${NC}"
  fi
  
elif [ "$ENV" = "production" ]; then
  # Production Health Checks
  if [ -n "$VITE_API_URL" ]; then
    if curl -sf "$VITE_API_URL/api/health" > /dev/null; then
      echo "✅ Production Backend erreichbar"
    else
      echo -e "${RED}❌ Production Backend nicht erreichbar${NC}"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════
# SUCCESS
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}"
echo "════════════════════════════════════════════════════════════"
echo "  ✅ DEPLOYMENT ERFOLGREICH"
echo "════════════════════════════════════════════════════════════"
echo -e "${NC}"

if [ "$ENV" = "local" ]; then
  echo "🌐 Frontend:   http://localhost"
  echo "🔌 Backend:    http://localhost:3000"
  echo "🗄️  PostgreSQL: localhost:5432"
  echo "💾 Redis:      localhost:6379"
  echo ""
  echo "📊 Logs:       docker-compose -f docker-compose.prod.yml logs -f"
  echo "🛑 Stop:       docker-compose -f docker-compose.prod.yml down"
elif [ "$ENV" = "production" ]; then
  echo "🌍 Live URL:   https://your-domain.de"
  echo "📊 Analytics:  https://app.netlify.com"
  echo "🔍 Monitoring: Check Railway/Render Dashboard"
fi

echo ""
echo "📖 Weitere Befehle:"
echo "   ./deploy.sh local      - Lokales Docker Deployment"
echo "   ./deploy.sh staging    - Staging Deployment"
echo "   ./deploy.sh production - Production Deployment"
echo ""
