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
if ! curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
  echo -e "${RED}❌ Backend nicht erreichbar (Port 4000)${NC}"
    echo -e "${YELLOW}⚠️  Starte Backend...${NC}"
    cd /workspaces/abu-abad
    ./start-services.sh
    sleep 5
fi

if ! curl -s http://localhost:5175 > /dev/null 2>&1; then
  echo -e "${RED}❌ Frontend nicht erreichbar (Port 5175)${NC}"
    echo -e "${YELLOW}⚠️  Starte Services...${NC}"
    cd /workspaces/abu-abad
    ./start-services.sh
    sleep 5
fi

echo -e "${GREEN}✅ Services running${NC}"

# Ensure Playwright targets the local dev URLs.
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:5175}"
export PLAYWRIGHT_API_BASE_URL="${PLAYWRIGHT_API_BASE_URL:-http://localhost:4000}"

# Check Test Users Exist
PATIENT_LOGIN_RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@test.de","password":"Test123!"}')

# Avoid hard dependency on jq.
PATIENT_LOGIN=$(node -e 'try { const j = JSON.parse(process.argv[1] || "{}"); process.stdout.write(j.token || ""); } catch { process.stdout.write(""); }' "$PATIENT_LOGIN_RESPONSE")

if [ -z "$PATIENT_LOGIN" ]; then
    echo -e "${RED}❌ Test-User nicht vorhanden${NC}"
    echo -e "${YELLOW}⚠️  Erstelle Test-User...${NC}"
    
    curl -s -X POST http://localhost:4000/api/auth/register \
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
# NOTE: html reporter can start a local server and block; keep this script non-interactive.
npx playwright test --reporter=line

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
