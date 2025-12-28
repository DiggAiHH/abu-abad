#!/bin/bash

# Validation Script - Prüft Installation und Konfiguration

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🔍 System Validation & Health Check                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n"

ERRORS=0
WARNINGS=0

# 1. Node.js Version prüfen
echo -e "${YELLOW}[1/10] Prüfe Node.js Version...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✅ Node.js $(node -v)${NC}"
    else
        echo -e "${RED}❌ Node.js 18+ erforderlich (aktuell: $(node -v))${NC}"
        ((ERRORS++))
    fi
else
    echo -e "${RED}❌ Node.js nicht installiert${NC}"
    ((ERRORS++))
fi

# 2. npm prüfen
echo -e "${YELLOW}[2/10] Prüfe npm...${NC}"
if command -v npm &> /dev/null; then
    echo -e "${GREEN}✅ npm $(npm -v)${NC}"
else
    echo -e "${RED}❌ npm nicht installiert${NC}"
    ((ERRORS++))
fi

# 3. PostgreSQL prüfen
echo -e "${YELLOW}[3/10] Prüfe PostgreSQL...${NC}"
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✅ PostgreSQL installiert${NC}"
else
    echo -e "${YELLOW}⚠️  PostgreSQL nicht gefunden${NC}"
    ((WARNINGS++))
fi

# 4. Dependencies prüfen
echo -e "${YELLOW}[4/10] Prüfe Node-Modules...${NC}"
if [ -d "node_modules" ] && [ -d "apps/backend/node_modules" ] && [ -d "apps/frontend/node_modules" ]; then
    echo -e "${GREEN}✅ Dependencies installiert${NC}"
else
    echo -e "${RED}❌ Dependencies fehlen - führe 'npm install' aus${NC}"
    ((ERRORS++))
fi

# 5. .env Dateien prüfen
echo -e "${YELLOW}[5/10] Prüfe Environment-Konfiguration...${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ Backend .env vorhanden${NC}"
    
    # Prüfe kritische Variablen
    if grep -q "JWT_SECRET=.*change" .env || grep -q "ENCRYPTION_KEY=.*change" .env; then
        echo -e "${YELLOW}⚠️  Bitte JWT_SECRET und ENCRYPTION_KEY in .env ändern!${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${RED}❌ .env fehlt - kopiere .env.example${NC}"
    ((ERRORS++))
fi

if [ -f "apps/frontend/.env" ]; then
    echo -e "${GREEN}✅ Frontend .env vorhanden${NC}"
else
    echo -e "${RED}❌ apps/frontend/.env fehlt${NC}"
    ((ERRORS++))
fi

# 6. TypeScript Compilation prüfen
echo -e "${YELLOW}[6/10] Prüfe TypeScript-Kompilierung...${NC}"
cd apps/backend
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend kompiliert ohne Fehler${NC}"
else
    echo -e "${RED}❌ Backend hat TypeScript-Fehler${NC}"
    ((ERRORS++))
fi
cd ../..

# 7. Playwright prüfen
echo -e "${YELLOW}[7/10] Prüfe Playwright...${NC}"
if [ -d "node_modules/@playwright/test" ]; then
    echo -e "${GREEN}✅ Playwright installiert${NC}"
    
    # Prüfe Browser
    if npx playwright --version > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Playwright Browser bereit${NC}"
    else
        echo -e "${YELLOW}⚠️  Playwright Browser fehlen - führe 'npx playwright install' aus${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${RED}❌ Playwright nicht installiert${NC}"
    ((ERRORS++))
fi

# 8. Database Schema prüfen
echo -e "${YELLOW}[8/10] Prüfe Database Schema...${NC}"
if [ -f "apps/backend/db/schema.sql" ]; then
    echo -e "${GREEN}✅ Database Schema vorhanden${NC}"
else
    echo -e "${RED}❌ Database Schema fehlt${NC}"
    ((ERRORS++))
fi

# 9. Test-Dateien prüfen
echo -e "${YELLOW}[9/10] Prüfe Test-Dateien...${NC}"
TEST_COUNT=$(find tests -name "*.spec.ts" | wc -l)
if [ "$TEST_COUNT" -ge 8 ]; then
    echo -e "${GREEN}✅ $TEST_COUNT Test-Dateien gefunden${NC}"
else
    echo -e "${YELLOW}⚠️  Nur $TEST_COUNT Test-Dateien (erwartet: 8+)${NC}"
    ((WARNINGS++))
fi

# 10. Ports verfügbar prüfen
echo -e "${YELLOW}[10/10] Prüfe verfügbare Ports...${NC}"
for port in 3000 3001 5173; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $port bereits belegt${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✅ Port $port verfügbar${NC}"
    fi
done

# Zusammenfassung
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Validation abgeschlossen!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Alle Checks erfolgreich!${NC}"
    echo -e "${GREEN}✅ System ist bereit für Deployment${NC}\n"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS Warnungen${NC}"
    echo -e "${YELLOW}System funktionsfähig, aber Konfiguration sollte optimiert werden${NC}\n"
    exit 0
else
    echo -e "${RED}❌ $ERRORS Fehler, $WARNINGS Warnungen${NC}"
    echo -e "${RED}Bitte behebe die Fehler vor dem Start${NC}\n"
    
    echo -e "${BLUE}Lösungsvorschläge:${NC}"
    echo -e "1. Dependencies installieren: ${GREEN}./setup.sh${NC}"
    echo -e "2. .env konfigurieren: ${GREEN}cp .env.example .env && nano .env${NC}"
    echo -e "3. Playwright Browser: ${GREEN}npx playwright install${NC}"
    echo -e "4. PostgreSQL starten: ${GREEN}sudo service postgresql start${NC}"
    exit 1
fi
