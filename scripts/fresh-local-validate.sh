#!/usr/bin/env bash
# Full clean-state local validation:
# 1. Clear build caches (.next, .turbo, dist, build, out)
# 2. Remove node_modules
# 3. Prune package manager cache (npm)
# 4. Optionally reset ./data (clean-state test) — set RESET_DATA=1
# 5. Reinstall with frozen lockfile (npm ci)
# 6. Run local smoke: upload→list→chat/RAG→delete/clear/reindex + persistence check
#
# Optionally starts the server for smoke (default). Set SKIP_SERVER=1 if server already running.
# Usage: ./scripts/fresh-local-validate.sh
#        RESET_DATA=1 ./scripts/fresh-local-validate.sh
#        SKIP_SERVER=1 ./scripts/fresh-local-validate.sh  # server already running

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo -e "${RED}❌ FAIL:${NC} $*"; exit 1; }
ok() { echo -e "${GREEN}✅${NC} $*"; }

# 1. Clear build caches
say "1. Clearing build caches (.next, .turbo, dist, build, out)"
rm -rf .next .turbo dist build out 2>/dev/null || true
ok "Caches cleared"

# 2. Remove node_modules
say "2. Removing node_modules"
rm -rf node_modules
ok "node_modules removed"

# 3. Prune package manager cache
say "3. Pruning npm cache"
npm cache prune --force 2>/dev/null || true
ok "Cache pruned"

# 4. Optionally reset ./data
if [ "${RESET_DATA:-0}" = "1" ]; then
  say "4. Resetting ./data (clean-state test)"
  rm -rf ./data
  ok "data cleared"
else
  say "4. Skipping data reset (use RESET_DATA=1 to clear ./data)"
fi

# 5. Reinstall with frozen lockfile and build
say "5. Reinstalling with frozen lockfile (npm ci)"
npm ci
say "Building application"
npm run build
ok "Install and build complete"

# 6. Run smoke validation
BASE_URL="${BASE_URL:-http://localhost:3000}"
SMOKE_SCRIPT="${ROOT}/scripts/smoke-file-rag-stability.sh"

if [ ! -x "$SMOKE_SCRIPT" ]; then
  chmod +x "$SMOKE_SCRIPT"
fi

if [ "${SKIP_SERVER:-0}" = "1" ]; then
  say "6. Running smoke validation (server assumed running at $BASE_URL)"
  bash "$SMOKE_SCRIPT" || fail "Smoke validation failed"
  ok "Smoke passed"
else
  say "6. Starting server and running smoke validation"
  # Start server in background; trap to kill on exit
  npm run start &
  SERVER_PID=$!
  trap "kill $SERVER_PID 2>/dev/null || true; wait $SERVER_PID 2>/dev/null || true" EXIT

  # Wait for server to be ready
  TIMEOUT=60
  ELAPSED=0
  while [ $ELAPSED -lt $TIMEOUT ]; do
    if curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${BASE_URL}/api/health" 2>/dev/null | grep -q 200; then
      ok "Server ready at $BASE_URL"
      break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
  done
  if [ $ELAPSED -ge $TIMEOUT ]; then
    kill $SERVER_PID 2>/dev/null || true
    fail "Server did not become ready within ${TIMEOUT}s"
  fi

  bash "$SMOKE_SCRIPT" || { kill $SERVER_PID 2>/dev/null || true; fail "Smoke validation failed"; }
  ok "Smoke passed"
  # Trap will kill server on exit
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Fresh local validation: PASS                          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
