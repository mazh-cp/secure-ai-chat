#!/usr/bin/env bash
# Preflight checks for Secure AI Chat (v1.0.16+).
# Verifies: Node version, DATA_DIR exists, writable, disk space.
# Exit 0 = pass; 1 = fail.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

REQUIRED_NODE="${REQUIRED_NODE:-24.13.0}"
DATA_DIR="${DATA_DIR:-}"
[ -z "$DATA_DIR" ] && DATA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/data"

fail() { echo -e "${RED}❌ PREFLIGHT FAIL:${NC} $*"; exit 1; }
ok() { echo -e "${GREEN}✅${NC} $*"; }

# 1. Node version
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v 2>/dev/null | sed 's/^v//')
  if [ "$NODE_VER" = "$REQUIRED_NODE" ]; then
    ok "Node version: $NODE_VER"
  else
    echo -e "${YELLOW}⚠ Node $NODE_VER (recommended: $REQUIRED_NODE)${NC}"
  fi
else
  fail "Node not found. Install Node.js $REQUIRED_NODE (e.g. via nvm)."
fi

# 2. DATA_DIR exists or create
if [ -d "$DATA_DIR" ]; then
  ok "DATA_DIR exists: $DATA_DIR"
else
  mkdir -p "$DATA_DIR" || fail "Cannot create DATA_DIR: $DATA_DIR"
  ok "DATA_DIR created: $DATA_DIR"
fi

# 3. Writable
if [ -w "$DATA_DIR" ]; then
  ok "DATA_DIR is writable"
else
  fail "DATA_DIR not writable: $DATA_DIR (check permissions and ownership)"
fi

# 4. Disk space (at least 100MB free)
if command -v df >/dev/null 2>&1; then
  AVAIL=$(df -k "$DATA_DIR" 2>/dev/null | tail -1 | awk '{print $4}')
  [ -z "$AVAIL" ] && AVAIL=0
  MIN_KB=102400
  if [ "$AVAIL" -ge "$MIN_KB" ] 2>/dev/null; then
    ok "Disk space: sufficient ($(($AVAIL / 1024)) MB free)"
  else
    echo -e "${YELLOW}⚠ Low disk space: $(($AVAIL / 1024)) MB free (recommend >= 100 MB)${NC}"
  fi
fi

echo ""
echo "Preflight checks passed. DATA_DIR=$DATA_DIR"
