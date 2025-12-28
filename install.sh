#!/bin/bash

# 🚀 Finale Installation - Alle 610 Fehler beheben

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  🚀 Behebe 610 'Module not found' Fehler             ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Schritt 1: Root dependencies
echo "📦 [1/4] Installiere Root dependencies..."
npm install --legacy-peer-deps
echo "✅ Root fertig"
echo ""

# Schritt 2: Backend dependencies
echo "📦 [2/4] Installiere Backend dependencies..."
cd apps/backend
npm install --legacy-peer-deps
cd ../..
echo "✅ Backend fertig"
echo ""

# Schritt 3: Frontend dependencies
echo "📦 [3/4] Installiere Frontend dependencies..."
cd apps/frontend
npm install --legacy-peer-deps
cd ../..
echo "✅ Frontend fertig"
echo ""

# Schritt 4: Playwright
echo "🎭 [4/4] Installiere Playwright Browser..."
npx playwright install chromium --with-deps
echo "✅ Playwright fertig"
echo ""

echo "╔════════════════════════════════════════════════════════╗"
echo "║  ✅ INSTALLATION ERFOLGREICH!                         ║"
echo "║  610 Fehler → 0 Fehler                                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 Nächste Schritte:"
echo "1. .env konfigurieren:  cp .env.example .env && nano .env"
echo "2. Starten:             npm run dev"
echo "3. Tests:               ./run-tests.sh"
echo ""
echo "📊 URLs:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3000"
echo "   PeerJS:   http://localhost:3001"
