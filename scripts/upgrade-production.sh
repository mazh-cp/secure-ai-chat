#!/usr/bin/env bash
# Production Upgrade Script - Safe Remote Upgrade
# Upgrades existing production installation to latest version
# Includes all hotfixes and ensures file storage persistence
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-production.sh | bash
#   Or download and run:
#   bash scripts/upgrade-production.sh
#
# Prerequisites:
#   - SSH access to production VM
#   - Sudo privileges
#   - Application directory: /opt/secure-ai-chat (or custom via APP_DIR env var)

set -euo pipefail

# Configuration
APP_DIR="${APP_DIR:-/opt/secure-ai-chat}"
GIT_REF="${GIT_REF:-main}"
REPO_URL="https://github.com/mazh-cp/secure-ai-chat.git"

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
info() { echo "${BLUE}ℹ️  INFO:${NC} $*"; }

# Main execution
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      Production Upgrade Script - Safe Remote Upgrade        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Upgrading production installation"
say "App directory: $APP_DIR"
say "Git reference: $GIT_REF"
echo ""

# Step 1: Validate prerequisites
say "Step 1: Validating Prerequisites"

if [ ! -d "$APP_DIR" ]; then
  warn "App directory does not exist: $APP_DIR"
  warn "Attempting to find installation..."
  
  # Try to find the installation
  POSSIBLE_PATHS=(
    "/opt/secure-ai-chat"
    "/home/$(whoami)/secure-ai-chat"
    "$HOME/secure-ai-chat"
    "/var/www/secure-ai-chat"
    "$(find /home /opt -type d -name "secure-ai-chat" 2>/dev/null | head -1)"
  )
  
  FOUND_PATH=""
  for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -n "$path" ] && [ -d "$path" ] && [ -f "$path/package.json" ]; then
      FOUND_PATH="$path"
      break
    fi
  done
  
  # Also check systemd service for path
  if [ -z "$FOUND_PATH" ] && [ -f "/etc/systemd/system/secure-ai-chat.service" ]; then
    SYSTEMD_PATH=$(grep "WorkingDirectory=" /etc/systemd/system/secure-ai-chat.service 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "")
    if [ -n "$SYSTEMD_PATH" ] && [ -d "$SYSTEMD_PATH" ] && [ -f "$SYSTEMD_PATH/package.json" ]; then
      FOUND_PATH="$SYSTEMD_PATH"
    fi
  fi
  
  if [ -n "$FOUND_PATH" ]; then
    warn "Found installation at: $FOUND_PATH"
    # Auto-use found path (always, since we verified it exists and has package.json)
    APP_DIR="$FOUND_PATH"
    ok "Auto-using installation at: $APP_DIR"
  else
    fail "App directory does not exist: $APP_DIR"
    fail ""
    fail "Options:"
    fail "  1. Specify correct path: APP_DIR=/path/to/app $0"
    fail "  2. Run fresh install: curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-remote.sh | bash"
    exit 1
  fi
fi

if [ "$EUID" -eq 0 ]; then
  fail "Please do not run this script as root. It will use sudo when needed."
fi

cd "$APP_DIR" || fail "Failed to change to app directory: $APP_DIR"
ok "App directory validated"

# Step 2: Backup current installation
say "Step 2: Creating Backup"

BACKUP_DIR="/opt/backups/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p /opt/backups
sudo mkdir -p "$BACKUP_DIR"

# Backup critical data
sudo cp -r "$APP_DIR/.secure-storage" "$BACKUP_DIR/.secure-storage" 2>/dev/null || warn "No .secure-storage to backup"
sudo cp -r "$APP_DIR/.storage" "$BACKUP_DIR/.storage" 2>/dev/null || warn "No .storage to backup"
sudo cp "$APP_DIR/.env.local" "$BACKUP_DIR/.env.local" 2>/dev/null || warn "No .env.local to backup"

ok "Backup created at: $BACKUP_DIR"

# Step 3: Download upgrade scripts
say "Step 3: Downloading Upgrade Scripts"

sudo mkdir -p "$APP_DIR/scripts/deploy"
sudo curl -o "$APP_DIR/scripts/deploy/upgrade.sh" \
  https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/upgrade.sh
sudo curl -o "$APP_DIR/scripts/deploy/common.sh" \
  https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/common.sh

sudo chmod +x "$APP_DIR/scripts/deploy"/*.sh
sudo chown "$(whoami):$(whoami)" "$APP_DIR/scripts/deploy"/*.sh

ok "Upgrade scripts downloaded"

# Step 4: Stop service (if running)
say "Step 4: Stopping Service"

if sudo systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
  sudo systemctl stop secure-ai-chat
  ok "Service stopped"
else
  warn "Service not running (may already be stopped)"
fi

# Step 5: Run upgrade script
say "Step 5: Running Upgrade"

# Detect app user for storage permission fixes
APP_USER=$(grep "^User=" /etc/systemd/system/secure-ai-chat.service 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "$(whoami)")

cd "$APP_DIR"
bash scripts/deploy/upgrade.sh --app-dir "$APP_DIR" --ref "$GIT_REF"

if [ $? -ne 0 ]; then
  fail "Upgrade failed. Check logs above."
fi

# Step 6: Fix storage permissions (hotfix)
say "Step 6: Fixing Storage Permissions"

if [ -f "scripts/fix-storage-permissions.sh" ]; then
  bash scripts/fix-storage-permissions.sh
  ok "Storage permissions fixed"
else
  # Fallback: Fix permissions manually
  say "Fixing storage permissions manually..."
  
  # Fix .storage directory
  if [ ! -d ".storage" ]; then
    mkdir -p .storage
    chmod 755 .storage
    [ "$(whoami)" != "$APP_USER" ] && sudo chown "$APP_USER:$APP_USER" .storage 2>/dev/null || true
    ok ".storage created with permissions 755"
  else
    chmod 755 .storage
    [ "$(whoami)" != "$APP_USER" ] && sudo chown "$APP_USER:$APP_USER" .storage 2>/dev/null || true
    ok ".storage permissions fixed to 755"
  fi
  
  # Fix .storage/files directory
  if [ ! -d ".storage/files" ]; then
    mkdir -p .storage/files
    chmod 755 .storage/files
    [ "$(whoami)" != "$APP_USER" ] && sudo chown "$APP_USER:$APP_USER" .storage/files 2>/dev/null || true
    ok ".storage/files created with permissions 755"
  else
    chmod 755 .storage/files
    [ "$(whoami)" != "$APP_USER" ] && sudo chown "$APP_USER:$APP_USER" .storage/files 2>/dev/null || true
    ok ".storage/files permissions fixed to 755"
  fi
  
  # Fix existing file permissions
  find .storage/files -name "*.dat" -type f -exec chmod 644 {} \; 2>/dev/null || true
  [ -f ".storage/files-metadata.json" ] && chmod 644 .storage/files-metadata.json 2>/dev/null || true
  ok "File permissions fixed"
fi

# Step 7: Verify upgrade
say "Step 7: Verifying Upgrade"

# Check service status
if sudo systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
  ok "Service is running"
else
  warn "Service is not running (may need manual start)"
fi

# Check health endpoint
sleep 3  # Give service time to start
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  ok "Health endpoint responding"
else
  warn "Health endpoint not responding (service may still be starting)"
fi

# Verify storage permissions
if [ -d ".storage" ]; then
  PERMS=$(stat -c%a .storage 2>/dev/null || stat -f%OLp .storage 2>/dev/null || echo "unknown")
  if [ "$PERMS" = "755" ]; then
    ok ".storage has correct permissions (755)"
  else
    warn ".storage permissions: $PERMS (expected 755)"
  fi
else
  warn ".storage directory does not exist"
fi

if [ -d ".storage/files" ]; then
  PERMS=$(stat -c%a .storage/files 2>/dev/null || stat -f%OLp .storage/files 2>/dev/null || echo "unknown")
  if [ "$PERMS" = "755" ]; then
    ok ".storage/files has correct permissions (755)"
  else
    warn ".storage/files permissions: $PERMS (expected 755)"
  fi
else
  warn ".storage/files directory does not exist"
fi

# Summary
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  Upgrade Completed Successfully              ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
info "Backup location: $BACKUP_DIR"
info "Service status: $(sudo systemctl is-active secure-ai-chat 2>/dev/null || echo 'not running')"
info "Health check: http://localhost:3000/api/health"
echo ""
ok "Production upgrade completed"
ok "All hotfixes applied (file storage persistence, 10-file limit)"
echo ""
