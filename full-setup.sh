#!/bin/bash
# Vollständige Installation und Start-Script
# Evidenz: Best Practices aus DevOps-Literatur (The Phoenix Project, Gene Kim)
# Quelle: Docker Documentation - https://docs.docker.com/ (Abruf: 2025-12-28)

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  🚀 Therapeuten-Plattform - Vollständiger Start      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Schritt 1: PostgreSQL via Docker starten
echo "📦 [1/6] Starte PostgreSQL Container..."
docker-compose up -d postgres
echo "⏳ Warte 10 Sekunden auf PostgreSQL..."
sleep 10
echo "✅ PostgreSQL läuft"
echo ""

# Schritt 2: Root Dependencies
echo "📦 [2/6] Installiere Root Dependencies..."
npm install --legacy-peer-deps
echo "✅ Root fertig"
echo ""

# Schritt 3: Backend Dependencies
echo "📦 [3/6] Installiere Backend Dependencies..."
cd apps/backend
npm install --legacy-peer-deps
cd ../..
echo "✅ Backend fertig"
echo ""

# Schritt 4: Frontend Dependencies
echo "📦 [4/6] Installiere Frontend Dependencies..."
cd apps/frontend
npm install --legacy-peer-deps
cd ../..
echo "✅ Frontend fertig"
echo ""

# Schritt 5: Playwright Browser
echo "🎭 [5/6] Installiere Playwright Browser..."
npx playwright install chromium --with-deps
echo "✅ Playwright fertig"
echo ""

# Schritt 6: .env erstellen falls nicht vorhanden
if [ ! -f ".env" ]; then
    echo "📝 [6/6] Erstelle .env Datei..."
    cat > .env << 'EOF'
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=therapist_platform
DATABASE_USER=therapist_user
DATABASE_PASSWORD=dev_password_CHANGE_IN_PRODUCTION
DATABASE_URL=postgresql://therapist_user:dev_password_CHANGE_IN_PRODUCTION@localhost:5432/therapist_platform

# JWT Secrets (WICHTIG: In Production ändern!)
JWT_SECRET=$(openssl rand -base64 32)
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# Encryption (AES-256)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Stripe (Test Keys)
STRIPE_SECRET_KEY=sk_test_PLACEHOLDER
STRIPE_PUBLISHABLE_KEY=pk_test_PLACEHOLDER
STRIPE_WEBHOOK_SECRET=whsec_PLACEHOLDER

# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# PeerJS
PEER_PORT=3001
PEER_PATH=/peerjs
EOF
    
    # Generiere echte Secrets
    JWT_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|" .env
    
    echo "✅ .env erstellt mit echten Secrets"
else
    echo "✅ [6/6] .env existiert bereits"
fi
echo ""

echo "╔════════════════════════════════════════════════════════╗"
echo "║  ✅ INSTALLATION ABGESCHLOSSEN                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 Nächste Schritte:"
echo "   1. npm run dev          # Starte Backend + Frontend"
echo "   2. ./run-tests.sh       # Führe Tests aus"
echo ""
echo "📊 URLs:"
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:3000"
echo "   PeerJS:    http://localhost:3001"
echo "   PgAdmin:   http://localhost:5050 (optional)"
echo ""
