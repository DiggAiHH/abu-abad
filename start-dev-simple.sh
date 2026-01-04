#!/bin/bash

# Einfaches Startup-Script (PostgreSQL läuft bereits)
set -e

echo "🚀 Starting Development Servers..."
echo ""

# Prüfe Backend Compilation
echo "→ Compiling Backend..."
cd apps/backend
npm run build > /dev/null 2>&1 && echo "✅ Backend compiled" || echo "⚠️ Backend compilation skipped"
cd ../..

# Erstelle logs dir
mkdir -p logs

# Starte Backend
echo "→ Starting Backend (http://localhost:4000)..."
cd apps/backend
nohup npm run dev > ../../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../../logs/backend.pid
cd ../..
echo "  Backend PID: $BACKEND_PID"

# Starte Frontend  
echo "→ Starting Frontend (http://localhost:5175)..."
cd apps/frontend
nohup npm run dev > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../../logs/frontend.pid
cd ../..
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "⏳ Waiting for services (15 seconds)..."
sleep 15

# Health Checks
echo ""
echo "🔍 Health Checks:"
if curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
    echo "✅ Backend: http://localhost:4000 ($(curl -s http://localhost:4000/api/health | head -c 50)...)"
else
    echo "⚠️ Backend: Not responding yet (check logs/backend.log)"
fi

if curl -s http://localhost:5175 > /dev/null 2>&1; then
    echo "✅ Frontend: http://localhost:5175"
else
    echo "⚠️ Frontend: Not responding yet (check logs/frontend.log)"
fi

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║  ✅ SERVICES STARTED                          ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "🌐 URLs:"
echo "  Frontend:  http://localhost:5175"
echo "  Backend:   http://localhost:4000"
echo "  Health:    http://localhost:4000/api/health"
echo ""
echo "📋 Logs:"
echo "  Backend:   tail -f logs/backend.log"
echo "  Frontend:  tail -f logs/frontend.log"
echo ""
echo "🛑 Stop:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "🧪 Test Registration:"
cat <<'EOF'
    curl -X POST http://localhost:4000/api/auth/register \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"Test1234!","firstName":"Test","lastName":"User","role":"patient","gdprConsent":true}'
EOF
echo ""
