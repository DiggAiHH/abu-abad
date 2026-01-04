#!/bin/bash

# Farben für Terminal-Output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🏥 Therapeuten-Plattform Setup Script v1.0         ║${NC}"
echo -e "${BLUE}║   106 Tests | DSGVO-Konform | Production-Ready       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n"

# Schritt 1: Node Version prüfen
echo -e "${YELLOW}1. Prüfe Node.js Version...${NC}"
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js 18+ erforderlich. Aktuelle Version: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}\n"

# Schritt 2: PostgreSQL prüfen
echo -e "${YELLOW}2. Prüfe PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL nicht gefunden${NC}"
    echo -e "${YELLOW}Bitte PostgreSQL installieren: sudo apt install postgresql${NC}"
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL installiert${NC}\n"

# Schritt 3: Dependencies installieren
echo -e "${YELLOW}3. Installiere Dependencies...${NC}"

# Root dependencies
echo -e "${BLUE}   -> Root-Pakete (Playwright, Concurrently)...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Root npm install fehlgeschlagen${NC}"
    exit 1
fi

# Backend dependencies
echo -e "${BLUE}   -> Backend-Pakete (Express, PostgreSQL, Stripe, etc.)...${NC}"
cd apps/backend
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Backend npm install fehlgeschlagen${NC}"
    exit 1
fi
cd ../..

# Frontend dependencies
echo -e "${BLUE}   -> Frontend-Pakete (React, Vite, Tailwind, etc.)...${NC}"
cd apps/frontend
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend npm install fehlgeschlagen${NC}"
    exit 1
fi
cd ../..

echo -e "${GREEN}✅ Alle Dependencies installiert${NC}\n"

# Schritt 4: Playwright Browser installieren
echo -e "${YELLOW}4. Installiere Playwright Browser...${NC}"
npx playwright install chromium firefox webkit
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Playwright Installation fehlgeschlagen${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Playwright Browser installiert${NC}\n"

# Schritt 5: .env Dateien prüfen
echo -e "${YELLOW}4. Prüfe Environment Variables...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env nicht gefunden - kopiere .env.example${NC}"
    cp .env.example .env
    echo -e "${RED}⚠️  WICHTIG: Bitte .env mit echten Werten ausfüllen!${NC}"
fi

if [ ! -f "apps/frontend/.env" ]; then
    echo -e "${YELLOW}⚠️  Frontend .env nicht gefunden - kopiere .env.example${NC}"
    cp apps/frontend/.env.example apps/frontend/.env
    echo -e "${RED}⚠️  WICHTIG: Bitte apps/frontend/.env mit echten Werten ausfüllen!${NC}"
fi
echo -e "${GREEN}✅ Environment-Dateien vorhanden${NC}\n"

# Schritt 5: Datenbank erstellen (optional)
echo -e "${YELLOW}5. Datenbank einrichten...${NC}"
read -p "Soll die Datenbank 'therapist_platform' erstellt werden? (j/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Jj]$ ]]; then
    createdb therapist_platform 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Datenbank erstellt${NC}"
    else
        echo -e "${YELLOW}⚠️  Datenbank existiert bereits oder Fehler beim Erstellen${NC}"
    fi
    
    # Migration ausführen
    echo -e "${YELLOW}Führe Migrationen aus...${NC}"
    npm run db:migrate
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Migrationen erfolgreich${NC}\n"
    else
        echo -e "${RED}❌ Migration fehlgeschlagen${NC}\n"
        exit 1
    fi
fi

# Schritt 6: Tests validieren (optional)
echo -e "${YELLOW}6. Tests validieren...${NC}"
read -p "Sollen die Playwright-Tests ausgeführt werden? (j/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Jj]$ ]]; then
    echo -e "${BLUE}Führe Playwright-Tests aus (106 Tests)...${NC}"
    npx playwright test --reporter=list
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Alle Tests erfolgreich${NC}\n"
    else
        echo -e "${YELLOW}⚠️  Einige Tests fehlgeschlagen - Details siehe oben${NC}\n"
    fi
fi

# Schritt 7: Fertig
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Setup abgeschlossen!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${BLUE}📝 Nächste Schritte:${NC}"
echo -e "1. ${YELLOW}Konfiguriere .env mit echten Werten${NC}"
echo -e "   - DATABASE_URL"
echo -e "   - JWT_SECRET (openssl rand -base64 32)"
echo -e "   - ENCRYPTION_KEY (openssl rand -base64 32)"
echo -e "   - Stripe Keys"
echo -e ""
echo -e "2. ${YELLOW}Konfiguriere apps/frontend/.env${NC}"
echo -e "   - VITE_STRIPE_PUBLISHABLE_KEY"
echo -e ""
echo -e "3. ${BLUE}Starte die Anwendung:${NC}"
echo -e "   ${GREEN}npm run dev${NC}"
echo -e ""
echo -e "4. ${BLUE}Führe Tests aus:${NC}"
echo -e "   ${GREEN}npx playwright test${NC}           # Alle 106 Tests"
echo -e "   ${GREEN}npx playwright test --ui${NC}      # Interaktiv"
echo -e "   ${GREEN}npx playwright test --headed${NC}  # Mit Browser sichtbar"
echo -e ""
echo -e "Frontend: ${BLUE}http://localhost:5175${NC}"
echo -e "Backend:  ${BLUE}http://localhost:4000${NC}"
echo -e "PeerJS:   ${BLUE}http://localhost:9001${NC}"
echo -e ""
echo -e "${YELLOW}⚠️  WICHTIG für Production:${NC}"
echo -e "- HTTPS aktivieren"
echo -e "- Secrets ändern"
echo -e "- Security Audit durchführen"
echo -e "- DSGVO-Dokumentation prüfen"
echo -e ""
echo -e "${GREEN}📚 Dokumentation:${NC}"
echo -e "- README.md          - Haupt-Dokumentation"
echo -e "- TESTING.md         - Test-Anleitung (106 Tests)"
echo -e "- FEHLER_BEHOBEN.md  - 636 → 0 Fehler"
echo -e "- DEPLOYMENT.md      - Production-Deployment"
echo -e "- SECURITY.md        - Sicherheits-Features"
