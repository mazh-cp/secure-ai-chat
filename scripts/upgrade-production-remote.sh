#!/usr/bin/env bash
# Secure AI Chat - Remote Production Upgrade Script (Fresh)
# Performs a safe, in-place upgrade of an existing Secure AI Chat installation
# Includes all latest fixes: storage permissions, file persistence, and rollback
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-production-remote.sh | bash
#
# Configuration (can be set via environment variables):
#   APP_DIR: The absolute path to the application directory (default: auto-detected)
#   GIT_REF: The git branch or tag to upgrade to (default: main)
#   APP_USER: The user that owns the application files (default: auto-detected)

set -euo pipefail

# Configuration
APP_DIR="${APP_DIR:-}"
GIT_REF="${GIT_REF:-main}"
REPO_URL="https://github.com/mazh-cp/secure-ai-chat.git"
APP_USER="${APP_USER:-}"

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
echo -e "${BLUE}║      Secure AI Chat - Remote Production Upgrade (Fresh)     ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Starting remote production upgrade"
info "Git reference (Branch/Tag): $GIT_REF"
echo ""

# Step 1: Detect or find installation
say "Step 1: Locating Installation"

if [ -z "$APP_DIR" ]; then
  say "Auto-detecting installation directory..."
  
  # Try to detect from systemd service first
  if [ -f "/etc/systemd/system/secure-ai-chat.service" ]; then
    SYSTEMD_PATH=$(grep "WorkingDirectory=" /etc/systemd/system/secure-ai-chat.service 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "")
    if [ -n "$SYSTEMD_PATH" ] && [ -d "$SYSTEMD_PATH" ] && [ -f "$SYSTEMD_PATH/package.json" ]; then
      APP_DIR="$SYSTEMD_PATH"
      ok "Found installation via systemd service: $APP_DIR"
    fi
  fi
  
  # Try common locations
  if [ -z "$APP_DIR" ]; then
    POSSIBLE_PATHS=(
      "/opt/secure-ai-chat"
      "/home/$(whoami)/secure-ai-chat"
      "$HOME/secure-ai-chat"
      "/var/www/secure-ai-chat"
      "$(find /home /opt -type d -name "secure-ai-chat" -path "*/package.json" 2>/dev/null | head -1 | xargs dirname 2>/dev/null || echo "")"
    )
    
    for path in "${POSSIBLE_PATHS[@]}"; do
      if [ -n "$path" ] && [ -d "$path" ] && [ -f "$path/package.json" ]; then
        APP_DIR="$path"
        ok "Found installation: $APP_DIR"
        break
      fi
    done
  fi
  
  if [ -z "$APP_DIR" ]; then
    fail "Could not locate installation directory"
    fail ""
    fail "Please specify manually: APP_DIR=/path/to/app curl -fsSL ... | bash"
    exit 1
  fi
else
  if [ ! -d "$APP_DIR" ]; then
    fail "App directory does not exist: $APP_DIR"
    exit 1
  fi
  ok "Using specified app directory: $APP_DIR"
fi

cd "$APP_DIR" || fail "Failed to change to app directory: $APP_DIR"

# Step 2: Detect app user
say "Step 2: Detecting App User"

if [ -z "$APP_USER" ]; then
  if [ -f "/etc/systemd/system/secure-ai-chat.service" ]; then
    APP_USER=$(grep "^User=" /etc/systemd/system/secure-ai-chat.service 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "")
  fi
  
  if [ -z "$APP_USER" ]; then
    APP_USER=$(whoami)
    warn "Could not detect app user from systemd service, using: $APP_USER"
  else
    ok "App user detected: $APP_USER"
  fi
else
  ok "Using specified app user: $APP_USER"
fi

# Step 3: Create backup
say "Step 3: Creating Backup"

BACKUP_DIR="${APP_DIR}/.backups"
BACKUP_PATH="${BACKUP_DIR}/upgrade-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"
sudo mkdir -p "$BACKUP_PATH"

# Backup critical data
sudo cp -r "$APP_DIR/.secure-storage" "$BACKUP_PATH/.secure-storage" 2>/dev/null || warn "No .secure-storage to backup"
sudo cp -r "$APP_DIR/.storage" "$BACKUP_PATH/.storage" 2>/dev/null || warn "No .storage to backup"
sudo cp "$APP_DIR/.env.local" "$BACKUP_PATH/.env.local" 2>/dev/null || warn "No .env.local to backup"

# Backup .next if exists
if [ -d "$APP_DIR/.next" ]; then
  sudo cp -r "$APP_DIR/.next" "$BACKUP_PATH/.next" 2>/dev/null || warn "Failed to backup .next"
fi

# Save git ref if git repo
if [ -d "$APP_DIR/.git" ]; then
  CURRENT_REF=$(cd "$APP_DIR" && git rev-parse HEAD 2>/dev/null || echo "unknown")
  echo "$CURRENT_REF" > "$BACKUP_PATH/.git-ref"
fi

ok "Backup created: $BACKUP_PATH"

# Step 4: Download latest upgrade scripts
say "Step 4: Downloading Latest Upgrade Scripts"

DEPLOY_DIR="$APP_DIR/scripts/deploy"
sudo mkdir -p "$DEPLOY_DIR"

# Download upgrade.sh
if sudo curl -fsSL -o "$DEPLOY_DIR/upgrade.sh" "$REPO_URL/raw/$GIT_REF/scripts/deploy/upgrade.sh"; then
  ok "Downloaded upgrade.sh"
else
  fail "Failed to download upgrade.sh"
  exit 1
fi

# Download common.sh (required by upgrade.sh)
if sudo curl -fsSL -o "$DEPLOY_DIR/common.sh" "$REPO_URL/raw/$GIT_REF/scripts/deploy/common.sh"; then
  ok "Downloaded common.sh"
else
  fail "Failed to download common.sh"
  exit 1
fi

# Download fix-storage-permissions.sh
if sudo curl -fsSL -o "$APP_DIR/scripts/fix-storage-permissions.sh" "$REPO_URL/raw/$GIT_REF/scripts/fix-storage-permissions.sh"; then
  ok "Downloaded fix-storage-permissions.sh"
else
  warn "Failed to download fix-storage-permissions.sh (will apply fixes manually)"
fi

# Set executable permissions
sudo chmod +x "$DEPLOY_DIR/upgrade.sh"
sudo chmod +x "$DEPLOY_DIR/common.sh"
[ -f "$APP_DIR/scripts/fix-storage-permissions.sh" ] && sudo chmod +x "$APP_DIR/scripts/fix-storage-permissions.sh"

# Fix ownership
if [ "$(whoami)" != "$APP_USER" ]; then
  sudo chown "$APP_USER:$APP_USER" "$DEPLOY_DIR"/*.sh 2>/dev/null || true
  sudo chown "$APP_USER:$APP_USER" "$APP_DIR/scripts/fix-storage-permissions.sh" 2>/dev/null || true
fi

ok "Upgrade scripts downloaded and configured"

# Step 5: Stop service (if running)
say "Step 5: Stopping Service"

if sudo systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
  sudo systemctl stop secure-ai-chat
  ok "Service stopped"
else
  warn "Service not running (may already be stopped)"
fi

# Step 6: Run upgrade script
say "Step 6: Running Upgrade"

cd "$APP_DIR"

# Source common.sh for helper functions
if [ -f "$DEPLOY_DIR/common.sh" ]; then
  source "$DEPLOY_DIR/common.sh"
fi

# Run upgrade script
if bash "$DEPLOY_DIR/upgrade.sh" --app-dir "$APP_DIR" --ref "$GIT_REF"; then
  ok "Upgrade completed successfully"
else
  UPGRADE_EXIT_CODE=$?
  warn "Upgrade failed with exit code: $UPGRADE_EXIT_CODE"
  warn "Check logs above for details"
  
  # Rollback will be handled by upgrade.sh if ROLLBACK_ON_FAILURE=true
  # But we ensure service is restarted with old build here
  if [ -d "$BACKUP_PATH/.next" ]; then
    say "Restoring previous build from backup..."
    sudo rm -rf "$APP_DIR/.next"
    sudo cp -r "$BACKUP_PATH/.next" "$APP_DIR/.next"
    sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR/.next" 2>/dev/null || true
    ok "Previous build restored"
  fi
  
  # Restart service with old build
  if sudo systemctl restart secure-ai-chat 2>/dev/null; then
    ok "Service restarted with previous version"
  else
    warn "Service restart may have failed"
  fi
  
  fail "Upgrade failed. System rolled back to previous version."
  fail "Backup location: $BACKUP_PATH"
  exit $UPGRADE_EXIT_CODE
fi

# Step 7: Fix storage permissions (critical for file persistence)
say "Step 7: Fixing Storage Permissions"

if [ -f "$APP_DIR/scripts/fix-storage-permissions.sh" ]; then
  # Use the dedicated script if available
  if bash "$APP_DIR/scripts/fix-storage-permissions.sh" 2>/dev/null; then
    ok "Storage permissions fixed via script"
  else
    warn "Storage fix script failed, applying fixes manually..."
    apply_storage_fixes_manually
  fi
else
  warn "Storage fix script not found, applying fixes manually..."
  apply_storage_fixes_manually
fi

# Function to apply storage fixes manually
apply_storage_fixes_manually() {
  say "Applying storage permission fixes manually..."
  
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
  [ "$(whoami)" != "$APP_USER" ] && sudo find .storage/files -name "*.dat" -type f -exec chown "$APP_USER:$APP_USER" {} \; 2>/dev/null || true
  [ -f ".storage/files-metadata.json" ] && [ "$(whoami)" != "$APP_USER" ] && sudo chown "$APP_USER:$APP_USER" .storage/files-metadata.json 2>/dev/null || true
  
  ok "Storage permissions fixed manually"
}

# Step 8: Verify storage permissions
say "Step 8: Verifying Storage Permissions"

STORAGE_PERMS=$(stat -c%a .storage 2>/dev/null || stat -f%OLp .storage 2>/dev/null || echo "unknown")
FILES_PERMS=$(stat -c%a .storage/files 2>/dev/null || stat -f%OLp .storage/files 2>/dev/null || echo "unknown")

if [ "$STORAGE_PERMS" = "755" ] && [ "$FILES_PERMS" = "755" ]; then
  ok ".storage permissions verified (755)"
  ok ".storage/files permissions verified (755)"
else
  warn ".storage permissions: $STORAGE_PERMS (expected 755)"
  warn ".storage/files permissions: $FILES_PERMS (expected 755)"
  warn "Re-applying fixes..."
  apply_storage_fixes_manually
fi

# Step 9: Restart service
say "Step 9: Restarting Service"

if sudo systemctl restart secure-ai-chat 2>/dev/null; then
  sleep 3
  if sudo systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
    ok "Service restarted and running"
  else
    warn "Service may not be running - check status: sudo systemctl status secure-ai-chat"
  fi
else
  warn "Service restart failed - manual restart may be required"
fi

# Step 10: Post-upgrade verification
say "Step 10: Post-Upgrade Verification"

# Check service status
if sudo systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
  ok "Service is running"
else
  warn "Service is not running"
fi

# Check health endpoint (with timeout)
sleep 2
if curl -s --max-time 5 http://localhost:3000/api/health > /dev/null 2>&1; then
  ok "Health endpoint responding"
else
  warn "Health endpoint not responding (service may still be starting)"
fi

# Final summary
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         🎉 Secure AI Chat Upgrade Complete! 🎉              ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
info "Application Directory: $APP_DIR"
info "App User: $APP_USER"
info "Backup Location: $BACKUP_PATH"
info "Storage Permissions: .storage (755), .storage/files (755)"
echo ""
info "Access your application at: http://YOUR_VM_IP:3000 (or configured port)"
info "To view service logs: sudo journalctl -u secure-ai-chat -f"
info "To restart service: sudo systemctl restart secure-ai-chat"
echo ""
ok "Upgrade completed successfully!"
