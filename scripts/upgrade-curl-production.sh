#!/usr/bin/env bash
# Secure AI Chat - Curl one-liner upgrade for production VM
# Repo: https://github.com/mazh-cp/secure-ai-chat
# Default path: /home/adminuser/secure-ai-chat (override with APP_DIR)
# Default ref: v1.0.15 (override with GIT_REF)
#
# Usage (production VM via SSH):
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash
#
# With overrides:
#   APP_DIR=/home/adminuser/secure-ai-chat GIT_REF=v1.0.15 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash
#   GIT_REF=main curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash

set -euo pipefail

# Configuration (production VM defaults)
APP_DIR="${APP_DIR:-/home/adminuser/secure-ai-chat}"
GIT_REF="${GIT_REF:-v1.0.15}"
REPO_URL="https://github.com/mazh-cp/secure-ai-chat.git"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; exit 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Secure AI Chat - Production Upgrade (curl one-liner)      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "App directory: $APP_DIR"
say "Git reference: $GIT_REF"
echo ""

if [ ! -d "$APP_DIR" ]; then
  fail "App directory not found: $APP_DIR"
  echo "  Set APP_DIR to your installation path, e.g.:"
  echo "  APP_DIR=/path/to/secure-ai-chat curl -fsSL ... | bash"
  exit 1
fi

if [ ! -f "$APP_DIR/package.json" ]; then
  fail "Not a secure-ai-chat app directory (no package.json): $APP_DIR"
  exit 1
fi

# Detect app user (systemd User= or owner of APP_DIR)
APP_USER="${APP_USER:-}"
if [ -z "$APP_USER" ] && [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
  APP_USER=$(grep "^User=" "/etc/systemd/system/${SERVICE_NAME}.service" 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "")
fi
if [ -z "$APP_USER" ]; then
  APP_USER=$(stat -c '%U' "$APP_DIR" 2>/dev/null || stat -f '%Su' "$APP_DIR" 2>/dev/null || echo "$(whoami)")
fi
say "App user: $APP_USER"

# Backup (use /tmp to avoid permission issues inside APP_DIR; /tmp may be cleared on reboot)
BACKUP_DIR="/tmp/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)"
say "Creating backup at $BACKUP_DIR"
mkdir -p "$BACKUP_DIR" || fail "Cannot create backup dir $BACKUP_DIR. Check: df /tmp (disk full?), ls -ld /tmp (writable?). Note: backups live in /tmp and may be cleared on reboot."
[ -f "$APP_DIR/.env.local" ] && cp -a "$APP_DIR/.env.local" "$BACKUP_DIR/" || true
[ -d "$APP_DIR/.secure-storage" ] && cp -a "$APP_DIR/.secure-storage" "$BACKUP_DIR/" || true
[ -d "$APP_DIR/.storage" ] && cp -a "$APP_DIR/.storage" "$BACKUP_DIR/" 2>/dev/null || true
ok "Backup done"

# Stop service
say "Stopping service: $SERVICE_NAME"
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  sudo systemctl stop "$SERVICE_NAME" || true
  sleep 2
  ok "Service stopped"
else
  warn "Service not running"
fi

# Git fetch and checkout
say "Fetching and checking out: $GIT_REF"
cd "$APP_DIR" || fail "Cannot cd to $APP_DIR"
git fetch origin 2>/dev/null || true
git checkout "$GIT_REF" 2>/dev/null || fail "Failed to checkout $GIT_REF (tag/branch may not exist)"
ok "Checked out $GIT_REF"

# Restore backup over any changed config
[ -f "$BACKUP_DIR/.env.local" ] && cp -a "$BACKUP_DIR/.env.local" "$APP_DIR/" || true
[ -d "$BACKUP_DIR/.secure-storage" ] && cp -a "$BACKUP_DIR/.secure-storage" "$APP_DIR/" || true

# npm install (with nvm if present)
say "Installing dependencies (npm install)"
export HOME="${HOME:-$APP_DIR}"
if [ -d "$HOME/.nvm" ]; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi
if [ "$(whoami)" = "$APP_USER" ]; then
  (cd "$APP_DIR" && npm install) || (cd "$APP_DIR" && npm ci) || fail "npm install failed"
else
  sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && export HOME='${HOME}' && [ -s \"\$HOME/.nvm/nvm.sh\" ] && . \"\$HOME/.nvm/nvm.sh\"; npm install || npm ci" || fail "npm install failed"
fi
ok "Dependencies installed"

# Build
say "Building application"
if [ "$(whoami)" = "$APP_USER" ]; then
  (cd "$APP_DIR" && npm run build) || fail "Build failed"
else
  sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && export HOME='${HOME}' && [ -s \"\$HOME/.nvm/nvm.sh\" ] && . \"\$HOME/.nvm/nvm.sh\"; npm run build" || fail "Build failed"
fi
ok "Build complete"

# Start service
say "Starting service: $SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME" 2>/dev/null || true
sleep 3
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  ok "Service started"
else
  warn "Service may not have started; check: sudo journalctl -u $SERVICE_NAME -n 30"
fi

# Version check
NEW_VERSION=$(grep '"version"' "$APP_DIR/package.json" 2>/dev/null | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/' || echo "unknown")
say "Upgrade complete. Version: $NEW_VERSION"
echo ""
echo "  Backup: $BACKUP_DIR"
echo "  (Backup is in /tmp; move it elsewhere if you need to keep it after reboot.)"
echo "  Health: curl -s http://localhost:3000/api/health"
echo "  Logs:   sudo journalctl -u $SERVICE_NAME -f"
echo ""
