#!/bin/bash
# DSGVO-SAFE: Local-only startup script
# HISTORY-AWARE: Combines backend + frontend + database startup

set -e

echo "🚀 Starting Abu-Abbad Platform..."
echo ""

# Check if .env exists
if [ ! -f "/workspaces/abu-abad/.env" ]; then
    echo "❌ .env file not found!"
    exit 1
fi

# Kill existing processes on ports
echo "🧹 Cleaning up existing processes..."

kill_port() {
    local port="$1"
    local pids
    pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN -n -P 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "  - Killing processes on port $port: $pids"
        kill $pids 2>/dev/null || true
        sleep 1
        kill -9 $pids 2>/dev/null || true
    fi
}

# Kill by well-known dev ports
kill_port 4000
kill_port 5175
kill_port 9001

# Fallback: kill common dev processes
pkill -f "tsx watch.*src/index.ts" || true
pkill -f "vite" || true
sleep 2

# Start Backend
echo ""
echo "📡 Starting Backend (Port 4000)..."
cd /workspaces/abu-abad/apps/backend
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to be ready
echo "⏳ Waiting for backend..."
for i in {1..30}; do
    if curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
        echo "✅ Backend ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Backend failed to start!"
        cat /tmp/backend.log
        exit 1
    fi
    sleep 1
done

# Start Frontend
echo ""
echo "🎨 Starting Frontend (Port 5175)..."
cd /workspaces/abu-abad/apps/frontend
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to be ready
echo "⏳ Waiting for frontend..."
for i in {1..30}; do
    if curl -s http://localhost:5175 > /dev/null 2>&1; then
        echo "✅ Frontend ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Frontend failed to start!"
        cat /tmp/frontend.log
        exit 1
    fi
    sleep 1
done

echo ""
echo "════════════════════════════════════════"
echo "✅ Abu-Abbad Platform is running!"
echo "════════════════════════════════════════"
echo ""
echo "📱 Frontend:  http://localhost:5175"
echo "📡 Backend:   http://localhost:4000"
echo "🎥 PeerJS:    http://localhost:9001"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f /tmp/backend.log"
echo "   Frontend: tail -f /tmp/frontend.log"
echo ""
echo "🛑 Stop: pkill -f 'node.*backend'; pkill -f 'vite'"
echo ""
echo "Press Ctrl+C to stop monitoring..."

if [ "${1:-}" = "--no-tail" ]; then
    echo ""
    echo "(no-tail) Startup complete; skipping log monitoring."
    exit 0
fi

# Follow logs
tail -f /tmp/backend.log /tmp/frontend.log
