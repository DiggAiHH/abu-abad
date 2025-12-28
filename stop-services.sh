#!/bin/bash
# Abu-Abbad Service Stop Script

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}🛑 Stoppe Abu-Abbad Services...${NC}"

# PIDs aus Dateien lesen
if [ -f /tmp/backend.pid ]; then
    BACKEND_PID=$(cat /tmp/backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "${YELLOW}⏹️  Backend (PID: $BACKEND_PID) wird gestoppt...${NC}"
        kill $BACKEND_PID
        rm /tmp/backend.pid
    fi
fi

if [ -f /tmp/frontend.pid ]; then
    FRONTEND_PID=$(cat /tmp/frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${YELLOW}⏹️  Frontend (PID: $FRONTEND_PID) wird gestoppt...${NC}"
        kill $FRONTEND_PID
        rm /tmp/frontend.pid
    fi
fi

# Fallback: Kill all
pkill -f "tsx watch" || true
pkill -f "vite" || true

echo -e "${GREEN}✅ Services gestoppt${NC}"
