#!/bin/bash

# Minimal Setup - Nur npm packages (ohne PostgreSQL)

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Installiere npm packages..."

# Root
echo "📦 Root dependencies..."
npm install --silent

# Backend
echo "📦 Backend dependencies..."
cd apps/backend
npm install --silent
cd ../..

# Frontend
echo "📦 Frontend dependencies..."
cd apps/frontend
npm install --silent
cd ../..

# Playwright
echo "🎭 Playwright browser..."
npx playwright install chromium --with-deps

echo -e "${GREEN}✅ Installation abgeschlossen!${NC}"
echo ""
echo -e "${YELLOW}Nächste Schritte:${NC}"
echo "1. .env konfigurieren (siehe .env.example)"
echo "2. PostgreSQL installieren und Datenbank erstellen"
echo "3. npm run dev zum Starten"
echo ""
echo "Tests: ./run-tests.sh"
echo "Health Check: ./validate.sh"
