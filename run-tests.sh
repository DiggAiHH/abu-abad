#!/bin/bash

# Quick Test Script - Führt alle Tests aus und zeigt Zusammenfassung

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🧪 Playwright Test Suite Executor                  ║${NC}"
echo -e "${BLUE}║   106 Tests | 8 Test-Suites | Full Coverage          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n"

# Prüfe ob Playwright installiert ist
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx nicht gefunden. Bitte Node.js installieren.${NC}"
    exit 1
fi

# Prüfe ob Playwright installiert ist
if [ ! -d "node_modules/@playwright/test" ]; then
    echo -e "${YELLOW}⚠️  Playwright nicht installiert. Führe npm install aus...${NC}"
    npm install
fi

# Menü
echo -e "${YELLOW}Wähle Test-Modus:${NC}"
echo -e "1) Alle Tests ausführen (106 Tests)"
echo -e "2) Nur kritische Tests (Authentication + Security)"
echo -e "3) Interaktiver Modus (Playwright UI)"
echo -e "4) Einzelne Test-Suite auswählen"
echo -e "5) Tests mit Screenshots"
echo -e "6) Debug-Modus (langsam, mit Browser)"
read -p "Deine Wahl (1-6): " choice

case $choice in
    1)
        echo -e "\n${BLUE}Führe alle 106 Tests aus...${NC}\n"
        npx playwright test --reporter=list
        ;;
    2)
        echo -e "\n${BLUE}Führe kritische Tests aus...${NC}\n"
        npx playwright test tests/e2e/auth.spec.ts tests/security/injection-and-validation.spec.ts --reporter=list
        ;;
    3)
        echo -e "\n${BLUE}Starte Playwright UI...${NC}\n"
        npx playwright test --ui
        ;;
    4)
        echo -e "\n${YELLOW}Verfügbare Test-Suites:${NC}"
        echo -e "1) Authentication (12 Tests)"
        echo -e "2) Appointments (9 Tests)"
        echo -e "3) Payments (11 Tests)"
        echo -e "4) Video Calls (14 Tests)"
        echo -e "5) Messaging (13 Tests)"
        echo -e "6) DSGVO Compliance (15 Tests)"
        echo -e "7) Error Handling (20 Tests)"
        echo -e "8) Security (12 Tests)"
        read -p "Test-Suite (1-8): " suite
        
        case $suite in
            1) npx playwright test tests/e2e/auth.spec.ts --reporter=list ;;
            2) npx playwright test tests/e2e/appointments.spec.ts --reporter=list ;;
            3) npx playwright test tests/e2e/payments.spec.ts --reporter=list ;;
            4) npx playwright test tests/e2e/video-call.spec.ts --reporter=list ;;
            5) npx playwright test tests/e2e/messaging.spec.ts --reporter=list ;;
            6) npx playwright test tests/e2e/gdpr-compliance.spec.ts --reporter=list ;;
            7) npx playwright test tests/e2e/error-handling.spec.ts --reporter=list ;;
            8) npx playwright test tests/security/injection-and-validation.spec.ts --reporter=list ;;
            *) echo -e "${RED}Ungültige Wahl${NC}"; exit 1 ;;
        esac
        ;;
    5)
        echo -e "\n${BLUE}Führe Tests mit Screenshots aus...${NC}\n"
        npx playwright test --screenshot=on --reporter=html
        echo -e "\n${GREEN}✅ HTML-Report erstellt: playwright-report/index.html${NC}"
        ;;
    6)
        echo -e "\n${BLUE}Starte Debug-Modus...${NC}\n"
        npx playwright test --headed --debug
        ;;
    *)
        echo -e "${RED}Ungültige Wahl${NC}"
        exit 1
        ;;
esac

# Zeige Zusammenfassung
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Test-Ausführung abgeschlossen!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${BLUE}📊 Test-Coverage:${NC}"
echo -e "✅ Authentication:   12 Tests"
echo -e "✅ Appointments:      9 Tests"
echo -e "✅ Payments:         11 Tests"
echo -e "✅ Video Calls:      14 Tests"
echo -e "✅ Messaging:        13 Tests"
echo -e "✅ DSGVO:            15 Tests"
echo -e "✅ Error Handling:   20 Tests"
echo -e "✅ Security:         12 Tests"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}GESAMT: 106 Tests${NC}\n"

echo -e "${YELLOW}💡 Weitere Optionen:${NC}"
echo -e "- Vollständiger Report: ${GREEN}npx playwright show-report${NC}"
echo -e "- Nur fehlgeschlagene: ${GREEN}npx playwright test --only-changed${NC}"
echo -e "- Spezifischer Browser: ${GREEN}npx playwright test --project=chromium${NC}"
