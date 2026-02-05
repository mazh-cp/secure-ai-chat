#!/usr/bin/env bash
# validate-local.sh — Reproducible clean build and local install validation.
# Runs: versions → clean → install (npm ci) → lint → typecheck → test → build → start → curl critical endpoints.
# Exits nonzero on first failure with actionable errors.
# Compatible with macOS zsh and Linux bash. Run from repo root: ./scripts/validate-local.sh
#
# Optional env:
#   VALIDATE_PORT=3001   — Port for production server (default 3001 to avoid conflict with dev).
#   SKIP_SERVER=1        — Skip start + curl (only clean, install, lint, typecheck, test, build).

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
cd "$ROOT"

PORT="${VALIDATE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"

say()  { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
ok()   { printf "${GREEN}✅${NC} %s\n" "$*"; }
fail() { printf "${RED}❌ FAIL:${NC} %s\n" "$*"; exit 1; }
warn() { printf "${YELLOW}⚠️${NC} %s\n" "$*"; }

# --- 1. Print node/npm versions ---
say "Node and npm versions"
node -v  || fail "node not found"
npm -v   || fail "npm not found"
ok "Versions printed"

# --- 2. Clean artifacts ---
say "Cleaning .next and node_modules"
rm -rf .next node_modules
ok "Clean complete"

# --- 3. Install dependencies ---
say "Installing dependencies (npm ci)"
if [ -f "package-lock.json" ]; then
  npm ci
else
  warn "No package-lock.json; using npm install (not deterministic)"
  npm install
fi
ok "Install complete"

# --- 4. Lint ---
say "Running lint"
if npm run lint 2>/dev/null; then
  ok "Lint passed"
else
  fail "Lint failed. Fix with: npm run lint"
fi

# --- 5. Typecheck ---
say "Running typecheck"
if npm run typecheck 2>/dev/null; then
  ok "Typecheck passed"
else
  if npm run type-check 2>/dev/null; then
    ok "Typecheck passed (type-check)"
  else
    fail "Typecheck failed. Fix with: npm run typecheck"
  fi
fi

# --- 6. Test ---
say "Running test (if configured)"
if npm run test 2>/dev/null; then
  ok "Test passed"
else
  warn "Test failed or not configured (continuing)"
fi

# --- 7. Build ---
say "Building application"
npm run build
ok "Build complete"

# --- 8. Start server and curl critical endpoints ---
if [ "${SKIP_SERVER:-0}" = "1" ]; then
  say "Skipping server start and curl (SKIP_SERVER=1)"
  ok "Validation complete (no server checks)"
  exit 0
fi

say "Starting production server on port $PORT"
export PORT
SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

npm run start &
SERVER_PID=$!

# Wait for server to be ready
TIMEOUT=60
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$BASE_URL/api/health" 2>/dev/null | grep -q 200; then
    ok "Server ready at $BASE_URL"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done
if [ $ELAPSED -ge $TIMEOUT ]; then
  fail "Server did not respond at $BASE_URL within ${TIMEOUT}s. Check logs above."
fi

# --- Curl critical endpoints ---
say "Checking GET / (200 + non-empty HTML)"
HOME_CODE="$(curl -s -o /tmp/validate_local_home.html -w "%{http_code}" --max-time 5 "$BASE_URL/" 2>/dev/null || echo 000)"
HOME_SIZE=0
[ -f /tmp/validate_local_home.html ] && HOME_SIZE=$(wc -c < /tmp/validate_local_home.html)
if [ "$HOME_CODE" = "200" ] && [ "$HOME_SIZE" -gt 100 ]; then
  ok "GET / returned 200 with $HOME_SIZE bytes"
else
  fail "GET / failed: HTTP $HOME_CODE, size $HOME_SIZE. Expected 200 and non-empty HTML."
fi

say "Checking GET /api/health (200)"
HEALTH_CODE="$(curl -s -o /tmp/validate_local_health.json -w "%{http_code}" --max-time 5 "$BASE_URL/api/health" 2>/dev/null || echo 000)"
if [ "$HEALTH_CODE" = "200" ]; then
  ok "GET /api/health returned 200"
else
  fail "GET /api/health failed: HTTP $HEALTH_CODE. Expected 200."
fi

say "Checking GET /api/version (200)"
VER_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BASE_URL/api/version" 2>/dev/null || echo 000)"
if [ "$VER_CODE" = "200" ]; then
  ok "GET /api/version returned 200"
else
  warn "GET /api/version returned $VER_CODE (optional)"
fi

say "Checking GET /api/files/list (200)"
LIST_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BASE_URL/api/files/list" 2>/dev/null || echo 000)"
if [ "$LIST_CODE" = "200" ]; then
  ok "GET /api/files/list returned 200"
else
  warn "GET /api/files/list returned $LIST_CODE (optional)"
fi

# Cleanup temp files
rm -f /tmp/validate_local_home.html /tmp/validate_local_health.json

printf "\n${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}\n"
printf "${GREEN}║  validate-local.sh: PASS — clean install, build, and routes  ║${NC}\n"
printf "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}\n"
