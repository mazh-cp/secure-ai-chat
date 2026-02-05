#!/usr/bin/env bash
# Full local verification: reset, dev smoke, build, prod smoke.
# Starts dev/prod in background, waits for port, runs smoke, kills process. Single command.
# Usage: ./scripts/run-local-verify.sh   or: npm run local:verify

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
cd "$ROOT"

export NO_PROXY="localhost,127.0.0.1,::1"
export no_proxy="${NO_PROXY}"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
PORT="${PORT:-3000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
ok()  { printf "${GREEN}✅ %s${NC}\n" "$*"; }
fail() { printf "${RED}❌ %s${NC}\n" "$*"; exit 1; }

wait_for_port() {
  local port=$1
  local max=30
  local n=0
  while [ $n -lt $max ]; do
    if curl -s -o /dev/null --max-time 2 --noproxy "localhost,127.0.0.1,::1" "http://127.0.0.1:${port}/api/health" 2>/dev/null; then
      return 0
    fi
    n=$((n + 1))
    sleep 1
  done
  return 1
}

cleanup_dev() {
  if [ -n "${DEV_PID:-}" ]; then
    kill "$DEV_PID" 2>/dev/null || true
    wait "$DEV_PID" 2>/dev/null || true
    unset DEV_PID
  fi
}

cleanup_prod() {
  if [ -n "${PROD_PID:-}" ]; then
    kill "$PROD_PID" 2>/dev/null || true
    wait "$PROD_PID" 2>/dev/null || true
    unset PROD_PID
  fi
}

trap 'cleanup_dev; cleanup_prod' EXIT INT TERM

# 1. Reset
say "Step 1: local:reset"
bash scripts/clean-reinstall.sh
ok "Reset done"

# 2. Dev: start in background, wait for port, smoke, kill
say "Step 2: Start dev server (background), smoke, then stop"
export PORT HOSTNAME=127.0.0.1
npm run dev &
DEV_PID=$!
if ! wait_for_port "$PORT"; then
  cleanup_dev
  fail "Dev server did not become ready on port $PORT"
fi
ok "Dev server ready"
BASE_URL="http://127.0.0.1:${PORT}" bash scripts/smoke.sh
ok "Dev smoke passed"
cleanup_dev
ok "Dev server stopped"

# 3. Build
say "Step 3: rm .next and build"
rm -rf .next
npm run build
ok "Build done"

# 4. Prod: start in background, wait for port, smoke, kill
say "Step 4: Start prod server (background), smoke, then stop"
export NODE_ENV=production
npm run start &
PROD_PID=$!
if ! wait_for_port "$PORT"; then
  cleanup_prod
  fail "Prod server did not become ready on port $PORT"
fi
ok "Prod server ready"
BASE_URL="http://127.0.0.1:${PORT}" bash scripts/smoke.sh
ok "Prod smoke passed"
cleanup_prod
ok "Prod server stopped"

say "local:verify complete — dev works, prod works, smoke passes"
exit 0
