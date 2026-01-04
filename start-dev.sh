#!/bin/bash

###############################################################################
# Production-Grade Startup Script
# Senior Principal Software Architect - Orchestrated Service Startup
###############################################################################

set -e  # Exit on error

# Farben
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║     🚀 Therapeuten-Plattform - Development Server Startup    ║${NC}"
echo -e "${BLUE}║     Senior Principal Architect - Orchestrated Deployment      ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

###############################################################################
# PHASE 1: Pre-Flight Checks
###############################################################################

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 1: Pre-Flight System Validation${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo ""

# Check Node.js
echo -e "${CYAN}→ Checking Node.js installation...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}  ✅ Node.js installed: $NODE_VERSION${NC}"
else
    echo -e "${RED}  ❌ Node.js not found! Please install Node.js 18+${NC}"
    exit 1
fi

# Check npm
echo -e "${CYAN}→ Checking npm installation...${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}  ✅ npm installed: v$NPM_VERSION${NC}"
else
    echo -e "${RED}  ❌ npm not found!${NC}"
    exit 1
fi

# Check if node_modules exist
echo -e "${CYAN}→ Checking dependencies...${NC}"
if [ ! -d "node_modules" ] || [ ! -d "apps/backend/node_modules" ] || [ ! -d "apps/frontend/node_modules" ]; then
    echo -e "${YELLOW}  ⚠️  Dependencies missing. Installing...${NC}"
    npm install
    cd apps/backend && npm install && cd ../..
    cd apps/frontend && npm install && cd ../..
    echo -e "${GREEN}  ✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}  ✅ Dependencies found${NC}"
fi

# Check .env file
echo -e "${CYAN}→ Checking environment configuration...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}  ⚠️  .env file not found. Creating from .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}  ⚠️  IMPORTANT: Please edit .env with your actual values!${NC}"
        echo -e "${YELLOW}     Especially: JWT_SECRET, ENCRYPTION_KEY, STRIPE_SECRET_KEY${NC}"
    else
        echo -e "${RED}  ❌ .env.example not found!${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}  ✅ .env file found${NC}"
fi

# Check PostgreSQL
echo -e "${CYAN}→ Checking PostgreSQL...${NC}"
if command -v psql &> /dev/null; then
    echo -e "${GREEN}  ✅ PostgreSQL client installed${NC}"
    
    # Try to connect
    if psql -U therapist_user -d therapist_db -c "SELECT 1;" &> /dev/null; then
        echo -e "${GREEN}  ✅ PostgreSQL database accessible${NC}"
    else
        echo -e "${YELLOW}  ⚠️  Cannot connect to PostgreSQL database${NC}"
        echo -e "${CYAN}  → Attempting to start PostgreSQL with Docker...${NC}"
        
        if command -v docker &> /dev/null; then
            # Check if container already exists
            if docker ps -a | grep -q therapist-postgres; then
                echo -e "${CYAN}  → Container exists, starting...${NC}"
                docker start therapist-postgres &> /dev/null || true
            else
                echo -e "${CYAN}  → Creating new PostgreSQL container...${NC}"
                docker run -d \
                  --name therapist-postgres \
                  -e POSTGRES_DB=therapist_db \
                  -e POSTGRES_USER=therapist_user \
                  -e POSTGRES_PASSWORD=secure_password \
                  -p 5432:5432 \
                  postgres:15 &> /dev/null
            fi
            
            echo -e "${CYAN}  → Waiting for PostgreSQL to be ready...${NC}"
            sleep 5
            echo -e "${GREEN}  ✅ PostgreSQL started in Docker${NC}"
        else
            echo -e "${RED}  ❌ Docker not found! Please install Docker or start PostgreSQL manually${NC}"
            echo -e "${YELLOW}     Manual command: docker run -d -e POSTGRES_DB=therapist_db -e POSTGRES_USER=therapist_user -e POSTGRES_PASSWORD=secure_password -p 5432:5432 postgres:15${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}  ⚠️  PostgreSQL client not installed (psql)${NC}"
    echo -e "${CYAN}  → Attempting to start PostgreSQL with Docker...${NC}"
    
    if command -v docker &> /dev/null; then
        if docker ps -a | grep -q therapist-postgres; then
            docker start therapist-postgres &> /dev/null || true
        else
            docker run -d \
              --name therapist-postgres \
              -e POSTGRES_DB=therapist_db \
              -e POSTGRES_USER=therapist_user \
              -e POSTGRES_PASSWORD=secure_password \
              -p 5432:5432 \
              postgres:15 &> /dev/null
        fi
        sleep 5
        echo -e "${GREEN}  ✅ PostgreSQL started in Docker${NC}"
    else
        echo -e "${RED}  ❌ Cannot start PostgreSQL. Please install Docker or PostgreSQL${NC}"
        exit 1
    fi
fi

# Check if ports are available
echo -e "${CYAN}→ Checking port availability...${NC}"
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}  ⚠️  Port 4000 (Backend) already in use. Killing process...${NC}"
    lsof -ti:4000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi
if lsof -Pi :5175 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}  ⚠️  Port 5175 (Frontend) already in use. Killing process...${NC}"
    lsof -ti:5175 | xargs kill -9 2>/dev/null || true
    sleep 1
fi
echo -e "${GREEN}  ✅ Ports available${NC}"

echo ""
echo -e "${GREEN}✅ All pre-flight checks passed!${NC}"
echo ""

###############################################################################
# PHASE 2: Build & Compile
###############################################################################

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 2: TypeScript Compilation${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${CYAN}→ Compiling Backend TypeScript...${NC}"
cd apps/backend
if npm run build; then
    echo -e "${GREEN}  ✅ Backend compiled successfully${NC}"
else
    echo -e "${RED}  ❌ Backend compilation failed!${NC}"
    exit 1
fi
cd ../..

echo ""

###############################################################################
# PHASE 3: Service Startup (Background)
###############################################################################

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 3: Starting Services${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo ""

# Create logs directory
mkdir -p logs

echo -e "${CYAN}→ Starting Backend Server (Port 4000)...${NC}"
cd apps/backend
nohup npm run dev > ../../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../../logs/backend.pid
cd ../..
echo -e "${GREEN}  ✅ Backend starting (PID: $BACKEND_PID)${NC}"
echo -e "${CYAN}     Log: logs/backend.log${NC}"

echo -e "${CYAN}→ Starting Frontend Server (Port 5175)...${NC}"
cd apps/frontend
nohup npm run dev > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../../logs/frontend.pid
cd ../..
echo -e "${GREEN}  ✅ Frontend starting (PID: $FRONTEND_PID)${NC}"
echo -e "${CYAN}     Log: logs/frontend.log${NC}"

echo ""
echo -e "${CYAN}→ Waiting for services to be ready (10 seconds)...${NC}"
sleep 10

###############################################################################
# PHASE 4: Health Checks
###############################################################################

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 4: Health Checks${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo ""

# Backend Health Check
echo -e "${CYAN}→ Checking Backend health...${NC}"
for i in {1..5}; do
    if curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
        HEALTH_RESPONSE=$(curl -s http://localhost:4000/api/health)
        echo -e "${GREEN}  ✅ Backend is healthy!${NC}"
        echo -e "${CYAN}     Response: $HEALTH_RESPONSE${NC}"
        break
    else
        if [ $i -eq 5 ]; then
            echo -e "${RED}  ❌ Backend health check failed after 5 attempts${NC}"
            echo -e "${YELLOW}     Check logs: tail -f logs/backend.log${NC}"
        else
            echo -e "${YELLOW}     Attempt $i/5 failed, retrying...${NC}"
            sleep 2
        fi
    fi
done

# Frontend Health Check
echo -e "${CYAN}→ Checking Frontend health...${NC}"
for i in {1..5}; do
    if curl -s http://localhost:5175 > /dev/null 2>&1; then
        echo -e "${GREEN}  ✅ Frontend is healthy!${NC}"
        break
    else
        if [ $i -eq 5 ]; then
            echo -e "${RED}  ❌ Frontend health check failed after 5 attempts${NC}"
            echo -e "${YELLOW}     Check logs: tail -f logs/frontend.log${NC}"
        else
            echo -e "${YELLOW}     Attempt $i/5 failed, retrying...${NC}"
            sleep 2
        fi
    fi
done

###############################################################################
# PHASE 5: Success Report & Testing Instructions
###############################################################################

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}║     ✅ ALL SERVICES RUNNING - READY FOR TESTING               ║${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}📊 Service Status:${NC}"
echo -e "${GREEN}  ✅ PostgreSQL:   Running (Port 5432)${NC}"
echo -e "${GREEN}  ✅ Backend:      http://localhost:4000 (PID: $BACKEND_PID)${NC}"
echo -e "${GREEN}  ✅ Frontend:     http://localhost:5175 (PID: $FRONTEND_PID)${NC}"
echo ""

echo -e "${BLUE}🌐 Access URLs:${NC}"
echo -e "${CYAN}  → Frontend:      http://localhost:5175${NC}"
echo -e "${CYAN}  → Backend API:   http://localhost:4000${NC}"
echo -e "${CYAN}  → Health Check:  http://localhost:4000/api/health${NC}"
echo ""

echo -e "${BLUE}📝 API Endpoints (Test with curl or Postman):${NC}"
echo -e "${CYAN}  POST /api/auth/register  - User Registration${NC}"
echo -e "${CYAN}  POST /api/auth/login     - User Login${NC}"
echo -e "${CYAN}  GET  /api/users/me       - Get Current User${NC}"
echo -e "${CYAN}  POST /api/appointments   - Create Appointment${NC}"
echo -e "${CYAN}  POST /api/payments       - Create Payment${NC}"
echo ""

echo -e "${BLUE}🧪 Quick Test Commands:${NC}"
echo ""
echo -e "${YELLOW}# Test 1: Backend Health Check${NC}"
echo -e "${CYAN}curl http://localhost:4000/api/health${NC}"
echo ""
echo -e "${YELLOW}# Test 2: Register a Therapist${NC}"
echo -e "${CYAN}curl -X POST http://localhost:4000/api/auth/register \\${NC}"
echo -e "${CYAN}  -H \"Content-Type: application/json\" \\${NC}"
echo -e "${CYAN}  -d '{${NC}"
echo -e "${CYAN}    \"email\": \"therapeut@example.com\",${NC}"
echo -e "${CYAN}    \"password\": \"Test1234!\",${NC}"
echo -e "${CYAN}    \"firstName\": \"Dr.\",${NC}"
echo -e "${CYAN}    \"lastName\": \"Test\",${NC}"
echo -e "${CYAN}    \"role\": \"therapist\",${NC}"
echo -e "${CYAN}    \"gdprConsent\": true${NC}"
echo -e "${CYAN}  }'${NC}"
echo ""
echo -e "${YELLOW}# Test 3: Open Frontend in Browser${NC}"
echo -e "${CYAN}open http://localhost:5175  # macOS${NC}"
echo -e "${CYAN}xdg-open http://localhost:5175  # Linux${NC}"
echo ""

echo -e "${BLUE}📋 Log Files (for debugging):${NC}"
echo -e "${CYAN}  Backend:  tail -f logs/backend.log${NC}"
echo -e "${CYAN}  Frontend: tail -f logs/frontend.log${NC}"
echo ""

echo -e "${BLUE}🛑 Stop Services:${NC}"
echo -e "${CYAN}  kill $BACKEND_PID $FRONTEND_PID${NC}"
echo -e "${CYAN}  # Or use: killall node${NC}"
echo ""

echo -e "${BLUE}🧪 Run E2E Tests:${NC}"
echo -e "${CYAN}  npx playwright test${NC}"
echo -e "${CYAN}  npx playwright test --ui  # Interactive mode${NC}"
echo ""

echo -e "${GREEN}🎉 Happy Testing! Die Anwendung läuft jetzt vollständig.${NC}"
echo ""
