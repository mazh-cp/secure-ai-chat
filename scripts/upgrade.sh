#!/usr/bin/env bash
# In-place upgrade to v1.0.16 (or GIT_REF). Preserves DATA_DIR and permissions.
# Run from app directory: bash scripts/upgrade.sh
# NEVER: deletes DATA_DIR, changes DATA_DIR permissions incorrectly, or moves storage into repo.

set -euo pipefail

GIT_REF="${GIT_REF:-v1.0.16}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DATA_DIR:-$APP_DIR/data}"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo -e "${RED}❌ FAIL:${NC} $*"; exit 1; }
ok() { echo -e "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo -e "${YELLOW}⚠ WARN:${NC} $*"; }

cd "$APP_DIR" || fail "Cannot cd to $APP_DIR"
[ -f package.json ] || fail "Not app directory (no package.json)"

say "Upgrade to $GIT_REF (app dir: $APP_DIR)"
say "DATA_DIR preserved: $DATA_DIR (never deleted or moved by this script)"

# Preflight: DATA_DIR writable
if [ -d "$DATA_DIR" ]; then
  [ -w "$DATA_DIR" ] || fail "DATA_DIR not writable: $DATA_DIR"
  ok "DATA_DIR writable"
else
  mkdir -p "$DATA_DIR" || fail "Cannot create DATA_DIR: $DATA_DIR"
  ok "DATA_DIR created"
fi

# Stop service
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  say "Stopping $SERVICE_NAME"
  sudo systemctl stop "$SERVICE_NAME" || true
  sleep 2
  ok "Stopped"
fi

# Fetch and checkout
say "Fetching and checking out: $GIT_REF"
git fetch origin 2>/dev/null || true
git checkout "$GIT_REF" 2>/dev/null || fail "Failed to checkout $GIT_REF"
ok "Checked out $GIT_REF"

# Frozen lockfile install
say "Installing dependencies (npm ci)"
npm ci || npm install || fail "npm install failed"
ok "Dependencies installed"

# Build
say "Building application"
npm run build || fail "Build failed"
ok "Build complete"

# Start service
say "Starting $SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME" 2>/dev/null || true
sleep 3

# Verify health
say "Verifying health endpoint"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"
status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" 2>/dev/null || echo "000")
[ "$status" = "200" ] && ok "Health $status" || warn "Health returned $status (check: curl $HEALTH_URL)"

# Verify DATA_DIR still writable
[ -w "$DATA_DIR" ] && ok "DATA_DIR still writable after upgrade" || warn "DATA_DIR not writable"

VERSION=$(grep '"version"' package.json 2>/dev/null | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/' || echo "unknown")
say "Upgrade complete. Version: $VERSION"
echo "  DATA_DIR unchanged: $DATA_DIR"
echo "  Health: curl -s $HEALTH_URL"
echo "  Logs:   sudo journalctl -u $SERVICE_NAME -f"
