#!/usr/bin/env bash
# Secure AI Chat - Curl one-liner upgrade for production VM
# Repo: https://github.com/mazh-cp/secure-ai-chat
# Default path: /home/adminuser/secure-ai-chat (override with APP_DIR)
# Default ref: main (override with GIT_REF). Use main for latest; tags (e.g. v1.0.15) are supported.
#
# Retry with main: If the build fails and GIT_REF is not main, the script automatically
# retries by checking out main, reinstalling dependencies, and building again so upgrades
# stay seamless even when a tag has a transient build issue.
#
# Usage (production VM via SSH):
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash
#
# With overrides:
#   APP_DIR=/home/adminuser/secure-ai-chat GIT_REF=main curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash
#   GIT_REF=v1.0.15 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash

set -euo pipefail

# Configuration (production VM defaults)
# Auto-detect: if unset, try default then /opt/secure-ai-chat (from install_fresh_v1.0.16 / install_ubuntu_clean)
if [ -z "${APP_DIR:-}" ]; then
  if [ -d "/home/adminuser/secure-ai-chat" ] && [ -f "/home/adminuser/secure-ai-chat/package.json" ]; then
    APP_DIR="/home/adminuser/secure-ai-chat"
  elif [ -d "/opt/secure-ai-chat" ] && [ -f "/opt/secure-ai-chat/package.json" ]; then
    APP_DIR="/opt/secure-ai-chat"
  else
    APP_DIR="/home/adminuser/secure-ai-chat"
  fi
fi
APP_DIR="${APP_DIR:-/home/adminuser/secure-ai-chat}"
GIT_REF="${GIT_REF:-main}"
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
  echo ""
  echo "  If the app is installed elsewhere, set APP_DIR:"
  echo "  APP_DIR=/opt/secure-ai-chat curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash"
  echo ""
  echo "  If this is a FRESH install (no existing app), use the install script instead:"
  echo "  curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_clean.sh | bash"
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

# Git fetch and checkout (ensure we get all remote changes)
say "Fetching and checking out: $GIT_REF"
cd "$APP_DIR" || fail "Cannot cd to $APP_DIR"
git fetch origin --tags 2>/dev/null || true
git checkout "$GIT_REF" 2>/dev/null || fail "Failed to checkout $GIT_REF (tag/branch may not exist)"
if git show-ref -q "origin/$GIT_REF" 2>/dev/null; then
  if ! git pull origin "$GIT_REF" 2>/dev/null; then
    warn "Pull failed, resetting to origin/$GIT_REF to fetch all remote changes..."
    git reset --hard "origin/$GIT_REF" 2>/dev/null || true
  fi
  ok "Checked out $GIT_REF (latest from origin)"
else
  ok "Checked out $GIT_REF (tag or ref)"
fi

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

# Build (retry with main if build fails, e.g. old tag had TypeScript error)
build_ok=false
for attempt in 1 2; do
  if [ "$attempt" -eq 2 ]; then say "Building application (retry with main)"; else say "Building application"; fi
  if [ "$(whoami)" = "$APP_USER" ]; then
    if (cd "$APP_DIR" && npm run build); then build_ok=true; break; fi
  else
    if sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && export HOME='${HOME}' && [ -s \"\$HOME/.nvm/nvm.sh\" ] && . \"\$HOME/.nvm/nvm.sh\"; npm run build"; then build_ok=true; break; fi
  fi
  if [ "$attempt" -eq 1 ] && [ "$GIT_REF" != "main" ]; then
    warn "Build failed. Retrying with main (latest fixes)..."
    cd "$APP_DIR" || true
    git fetch origin 2>/dev/null || true
    git checkout main 2>/dev/null || true
    GIT_REF=main
    [ -f "$BACKUP_DIR/.env.local" ] && cp -a "$BACKUP_DIR/.env.local" "$APP_DIR/" || true
    [ -d "$BACKUP_DIR/.secure-storage" ] && cp -a "$BACKUP_DIR/.secure-storage" "$APP_DIR/" || true
    say "Reinstalling dependencies after checkout main"
    if [ "$(whoami)" = "$APP_USER" ]; then
      (cd "$APP_DIR" && npm install) || (cd "$APP_DIR" && npm ci) || true
    else
      sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && export HOME='${HOME}' && [ -s \"\$HOME/.nvm/nvm.sh\" ] && . \"\$HOME/.nvm/nvm.sh\"; npm install || npm ci" || true
    fi
  else
    break
  fi
done
[ "$build_ok" = true ] || fail "Build failed. Try: GIT_REF=main curl -fsSL ... | bash"
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
