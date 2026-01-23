#!/bin/bash
# Start Backend + Frontend for local testing
# Usage: ./start-local-test.sh

set -e

cd /workspaces/abu-abad

DETACH="${DETACH:-0}"
PID_FILE="${PID_FILE:-/tmp/abu-abad-services.pids}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5175/}"
BACKEND_URL="${BACKEND_URL:-http://localhost:4000/api/health}"
LOG_DIR="${LOG_DIR:-/workspaces/abu-abad/buildLogs}"
TS="$(date -u +%Y%m%d-%H%M%S)"
BACKEND_LOG="${BACKEND_LOG:-$LOG_DIR/backend-dev-${TS}.log}"
FRONTEND_LOG="${FRONTEND_LOG:-$LOG_DIR/frontend-dev-${TS}.log}"
HAS_CURL=1
if ! command -v curl &> /dev/null; then
  HAS_CURL=0
fi

mkdir -p "$LOG_DIR"

cleanup() {
  if [ -f "$PID_FILE" ]; then
    read -r BACKEND_PID FRONTEND_PID < "$PID_FILE" || true
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    rm -f "$PID_FILE" || true
  fi
}

if [ "$DETACH" != "1" ]; then
  trap cleanup EXIT
fi

echo "🐘 Checking PostgreSQL..."
if docker ps -a --format '{{.Names}}' | grep -q '^therapist-postgres$'; then
  if ! docker ps --format '{{.Names}}' | grep -q '^therapist-postgres$'; then
    if ! docker start therapist-postgres >/dev/null; then
      echo "❌ Postgres-Container konnte nicht gestartet werden."
      echo "   Wenn der Container korrupt ist, setze FORCE_RECREATE_DB=1 um ihn neu zu erzeugen."
      echo "   Beispiel: FORCE_RECREATE_DB=1 ./start-local-test.sh"
      if [ "${FORCE_RECREATE_DB:-0}" = "1" ]; then
        docker rm -f therapist-postgres >/dev/null
        docker run -d --name therapist-postgres \
          -e POSTGRES_USER=therapist_user \
          -e POSTGRES_PASSWORD=secure_password \
          -e POSTGRES_DB=therapist_db \
          -p 5432:5432 \
          postgres:15 >/dev/null
      else
        exit 1
      fi
    fi
  fi
else
  docker run -d --name therapist-postgres \
    -e POSTGRES_USER=therapist_user \
    -e POSTGRES_PASSWORD=secure_password \
    -e POSTGRES_DB=therapist_db \
    -p 5432:5432 \
    postgres:15 >/dev/null
fi
sleep 3

echo "🔧 Starting Backend (dev)..."
export PORT=4000
export DATABASE_URL="postgresql://therapist_user:secure_password@localhost:5432/therapist_db"
export JWT_SECRET="this-is-a-test-secret-key-with-32-characters-minimum-for-jwt"
export REFRESH_TOKEN_SECRET="this-is-a-refresh-token-secret-with-32-chars-min"
export ENCRYPTION_KEY="12345678901234567890123456789012"
export STRIPE_SECRET_KEY="sk_test_placeholder_for_testing_only"
export ALLOWED_ORIGINS="http://localhost:5175,http://localhost:5176"
export LOGIN_RATE_LIMIT_MAX="${LOGIN_RATE_LIMIT_MAX:-5}"

cd apps/backend
if [ "$DETACH" = "1" ]; then
  npm run dev > "$BACKEND_LOG" 2>&1 &
else
  npm run dev &
fi
BACKEND_PID=$!
cd ../..

sleep 3

echo "🎨 Starting Frontend..."
cd apps/frontend
if [ "$DETACH" = "1" ]; then
  npm run dev -- --port 5175 > "$FRONTEND_LOG" 2>&1 &
else
  npm run dev -- --port 5175 &
fi
FRONTEND_PID=$!
cd ../..

echo "$BACKEND_PID $FRONTEND_PID" > "$PID_FILE"

if [ "$HAS_CURL" = "1" ]; then
  echo "⏳ Waiting for health checks..."
  for i in {1..30}; do
    if curl -fsS "$FRONTEND_URL" >/dev/null && curl -fsS "$BACKEND_URL" >/dev/null; then
      echo "✅ Health checks passed."
      break
    fi
    sleep 1
  done
else
  echo "⚠️  curl nicht gefunden, Health-Checks werden uebersprungen."
fi

echo ""
echo "✅ Services started:"
echo "   Backend:  $BACKEND_URL (PID: $BACKEND_PID)"
echo "   Frontend: $FRONTEND_URL (PID: $FRONTEND_PID)"
echo "   PID File: $PID_FILE"
echo ""
if [ "$DETACH" = "1" ]; then
  echo "DETACH=1 gesetzt: Services laufen im Hintergrund."
  echo "Logs:"
  echo "  Backend:  $BACKEND_LOG"
  echo "  Frontend: $FRONTEND_LOG"
  echo "Stop: kill $(cat "$PID_FILE" 2>/dev/null) 2>/dev/null"
  exit 0
fi
echo "Press Ctrl+C to stop all services"

# Wait for any process to exit
wait
