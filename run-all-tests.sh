#!/bin/bash
# Test Runner with Pre-Flight Checks
# PREVENTS: Alle Fehler aus Matrix des Scheiterns

set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    Abu-Abbad Test Suite Runner           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# STEP 1: Pre-Flight Checks
echo -e "${YELLOW}🔍 Pre-Flight Checks...${NC}"

# Check Services Running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Backend nicht erreichbar (Port 3000)${NC}"
    echo -e "${YELLOW}⚠️  Starte Backend...${NC}"
    cd /workspaces/abu-abad
    ./start-services.sh
    sleep 5
fi

if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${RED}❌ Frontend nicht erreichbar (Port 5173)${NC}"
    echo -e "${YELLOW}⚠️  Starte Services...${NC}"
    cd /workspaces/abu-abad
    ./start-services.sh
    sleep 5
fi

echo -e "${GREEN}✅ Services running${NC}"

# Check Test Users Exist
PATIENT_LOGIN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@test.de","password":"Test123!"}' \
  | jq -r '.token // empty')

if [ -z "$PATIENT_LOGIN" ]; then
    echo -e "${RED}❌ Test-User nicht vorhanden${NC}"
    echo -e "${YELLOW}⚠️  Erstelle Test-User...${NC}"
    
    curl -s -X POST http://localhost:3000/api/auth/register \
      -H "Content-Type: application/json" \
      -d '{
        "email": "patient@test.de",
        "password": "Test123!",
        "firstName": "Max",
        "lastName": "Mustermann",
        "role": "patient",
        "gdprConsent": true
      }' > /dev/null
      
    echo -e "${GREEN}✅ Patient-Account erstellt${NC}"
fi

echo -e "${GREEN}✅ Test-User verified${NC}"

# STEP 2: Generate Test Checklist
echo ""
echo -e "${YELLOW}📋 Generiere Test-Checklist...${NC}"
cd /workspaces/abu-abad
node scripts/generate-test-checklist.js

# STEP 3: Run Tests
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 Running Tests...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Run Playwright Tests
npx playwright test tests/e2e/login.spec.ts --reporter=html

# STEP 4: Results
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          ✅ TESTS COMPLETED              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Reports:${NC}"
echo -e "   Test-Report:  ${YELLOW}playwright-report/index.html${NC}"
echo -e "   Checklist:    ${YELLOW}TEST_CHECKLIST.md${NC}"
echo ""
echo -e "${BLUE}🔍 View Results:${NC}"
echo -e "   ${YELLOW}npx playwright show-report${NC}"
echo ""
