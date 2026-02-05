#!/usr/bin/env bash
# Start the app (production) and run smoke validation once ready.
# Usage: ./scripts/start-and-validate.sh   or: npm run local:start-validate

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
cd "$ROOT"

export NO_PROXY="localhost,127.0.0.1,::1"
export no_proxy="${NO_PROXY}"
PORT="${PORT:-3000}"
# Try localhost first (works when server listens on ::1)
BASE_URL="${BASE_URL:-http://localhost:3000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
ok()  { printf "${GREEN}✅ %s${NC}\n" "$*"; }
fail() { printf "${RED}❌ %s${NC}\n" "$*"; exit 1; }

# Kill existing process on port
say "Freeing port $PORT if in use..."
lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $2}' | while read pid; do kill "$pid" 2>/dev/null; done || true
sleep 2

# Start production server in background
say "Starting production server..."
npm run local:prod &
PROD_PID=$!
disown 2>/dev/null || true

# Wait for server (try both localhost and 127.0.0.1)
say "Waiting for server to be ready..."
max=90
n=0
while [ $n -lt $max ]; do
  if curl -s -o /dev/null --max-time 2 --noproxy "localhost,127.0.0.1,::1" "http://localhost:${PORT}/api/health" 2>/dev/null; then
    BASE_URL="http://localhost:${PORT}"
    ok "Server ready at $BASE_URL"
    break
  fi
  if curl -s -o /dev/null --max-time 2 --noproxy "localhost,127.0.0.1,::1" "http://127.0.0.1:${PORT}/api/health" 2>/dev/null; then
    BASE_URL="http://127.0.0.1:${PORT}"
    ok "Server ready at $BASE_URL"
    break
  fi
  n=$((n + 1))
  sleep 2
done
if [ $n -ge $max ]; then
  kill "$PROD_PID" 2>/dev/null || true
  fail "Server did not become ready within ${max}s"
fi

# Run smoke validation
say "Running smoke validation..."
BASE_URL="$BASE_URL" bash scripts/smoke.sh
ok "Start and validate complete."
echo ""
echo "App is running at $BASE_URL (PID $PROD_PID)."
echo "Open in browser: $BASE_URL"
echo "To stop: kill $PROD_PID"
echo ""
