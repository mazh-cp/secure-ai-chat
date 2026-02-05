#!/usr/bin/env bash
# Clean local dev: kill processes on port 3000 (and 3001), wipe build/install artifacts and runtime data.
# Usage: ./scripts/clean-local.sh [--no-data]   (--no-data skips removing ./data)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

WIPE_DATA=true
[[ "${1:-}" = "--no-data" ]] && WIPE_DATA=false

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
ok() { echo -e "${GREEN}✅${NC} $*"; }
warn() { echo -e "${YELLOW}⚠️${NC} $*"; }

# Kill processes listening on 3000 and 3001
for PORT in 3000 3001; do
  if command -v lsof &>/dev/null; then
    PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
      say "Killing processes on port $PORT (PIDs: $PIDS)"
      echo "$PIDS" | xargs kill -9 2>/dev/null || true
      sleep 1
      ok "Port $PORT cleared"
    else
      say "Port $PORT already free"
    fi
  else
    warn "lsof not found; cannot check/kill port $PORT"
  fi
done

# Confirm 3000 is free
say "Confirming port 3000 is free"
if command -v lsof &>/dev/null; then
  if lsof -i :3000 &>/dev/null; then
    echo -e "${RED}Port 3000 still in use. Try: lsof -i :3000 then kill <PID>${NC}"
    exit 1
  fi
  ok "Port 3000 is free"
fi

# Wipe build/install artifacts
say "Removing build/install artifacts (.next, .turbo, dist, build, out, coverage, node_modules)"
rm -rf .next .turbo dist build out coverage node_modules 2>/dev/null || true
ok "Artifacts removed"

# Wipe local runtime data
if [ "$WIPE_DATA" = true ]; then
  say "Removing local runtime data (./data)"
  rm -rf ./data 2>/dev/null || true
  ok "Data removed"
else
  say "Skipping ./data (--no-data)"
fi

echo ""
echo -e "${GREEN}Clean complete. Port 3000 free; artifacts and data cleared.${NC}"
