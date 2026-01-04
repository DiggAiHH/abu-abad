#!/bin/bash

# Quick Start - Startet Backend + Frontend in einem Terminal

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 Quick Start - Development Server                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n"

# Prüfe ob Dependencies installiert sind
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Dependencies nicht installiert. Führe Setup aus...${NC}\n"
    chmod +x setup.sh
    ./setup.sh
fi

# Prüfe .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env fehlt - kopiere .env.example${NC}"
    cp .env.example .env
    echo -e "${RED}❌ WICHTIG: Bitte .env mit echten Werten ausfüllen!${NC}"
    echo -e "${YELLOW}Öffne .env und setze: DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY${NC}\n"
    read -p "Drücke Enter wenn .env konfiguriert ist..."
fi

# Cleanup alte Prozesse
echo -e "${YELLOW}Beende alte Prozesse auf Ports 4000, 9001, 5175...${NC}"
lsof -ti:4000 | xargs kill -9 2>/dev/null
lsof -ti:9001 | xargs kill -9 2>/dev/null
lsof -ti:5175 | xargs kill -9 2>/dev/null
echo -e "${GREEN}✅ Ports freigegeben${NC}\n"

# Starte Server
echo -e "${BLUE}🚀 Starte Development-Server...${NC}\n"
echo -e "${YELLOW}Backend:  ${BLUE}http://localhost:4000${NC}"
echo -e "${YELLOW}Frontend: ${BLUE}http://localhost:5175${NC}"
echo -e "${YELLOW}PeerJS:   ${BLUE}http://localhost:9001${NC}\n"
echo -e "${YELLOW}Drücke Ctrl+C zum Beenden${NC}\n"

# Starte beide Server (concurrently sollte in package.json sein)
npm run dev
