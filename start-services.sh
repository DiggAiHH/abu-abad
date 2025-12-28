#!/bin/bash
# Abu-Abbad Production-Ready Startup Script
# Handles graceful cleanup and background process management

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Abu-Abbad Development Environment      ║${NC}"
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo ""

# Function: Kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null || echo "")
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}⚠️  Port $port belegt (PID: $pid) - wird freigegeben...${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Function: Health check
health_check() {
    local url=$1
    local name=$2
    local max_retries=10
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|404"; then
            echo -e "${GREEN}✅ $name: Erreichbar${NC}"
            return 0
        fi
        retry=$((retry + 1))
        echo -e "${YELLOW}⏳ $name: Warte auf Start... ($retry/$max_retries)${NC}"
        sleep 2
    done
    
    echo -e "${RED}❌ $name: Timeout nach ${max_retries} Versuchen${NC}"
    return 1
}

# Cleanup alte Prozesse
echo -e "${YELLOW}🧹 Cleanup: Alte Prozesse werden beendet...${NC}"
pkill -f "tsx watch" || true
kill_port 3000
kill_port 5173
sleep 2

# Schritt 1: Backend starten
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📡 Backend wird gestartet...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd /workspaces/abu-abad/apps/backend
nohup npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > /tmp/backend.pid
echo -e "${GREEN}✅ Backend gestartet (PID: $BACKEND_PID)${NC}"

# Health Check Backend
if ! health_check "http://localhost:3000/health" "Backend"; then
    echo -e "${RED}❌ Backend Start fehlgeschlagen. Log:${NC}"
    tail -20 /tmp/backend.log
    exit 1
fi

# Schritt 2: Frontend starten
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🎨 Frontend wird gestartet...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd /workspaces/abu-abad/apps/frontend
nohup npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > /tmp/frontend.pid
echo -e "${GREEN}✅ Frontend gestartet (PID: $FRONTEND_PID)${NC}"

# Health Check Frontend
if ! health_check "http://localhost:5173/" "Frontend"; then
    echo -e "${RED}❌ Frontend Start fehlgeschlagen. Log:${NC}"
    tail -20 /tmp/frontend.log
    exit 1
fi

# Finale Zusammenfassung
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          🎉 START ERFOLGREICH 🎉         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 URLs:${NC}"
echo -e "   Frontend:  ${GREEN}http://localhost:5173${NC}"
echo -e "   Backend:   ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "${BLUE}🔐 Test-Zugangsdaten:${NC}"
echo -e "   Patient:   ${YELLOW}patient@test.de${NC} / ${YELLOW}Test123!${NC}"
echo -e "   Therapeut: ${YELLOW}therapeut@test.de${NC} / ${YELLOW}Test123!${NC}"
echo ""
echo -e "${BLUE}📊 Prozess-Management:${NC}"
echo -e "   Backend PID:  ${GREEN}$BACKEND_PID${NC}"
echo -e "   Frontend PID: ${GREEN}$FRONTEND_PID${NC}"
echo ""
echo -e "${BLUE}🛠️  Logs ansehen:${NC}"
echo -e "   Backend:  ${YELLOW}tail -f /tmp/backend.log${NC}"
echo -e "   Frontend: ${YELLOW}tail -f /tmp/frontend.log${NC}"
echo ""
echo -e "${BLUE}🛑 Services stoppen:${NC}"
echo -e "   ${YELLOW}./stop.sh${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
