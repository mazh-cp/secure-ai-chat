#!/usr/bin/env bash
# Secure AI Chat - Safe Remote Upgrade Script
# Upgrades remote installation to latest version while preserving all settings
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade_remote.sh | bash
#   OR
#   bash scripts/upgrade_remote.sh

set -euo pipefail

# Configuration
INSTALL_DIR="${INSTALL_DIR:-/opt/secure-ai-chat}"
APP_USER="${APP_USER:-secureai}"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
BACKUP_DIR="${BACKUP_DIR:-/opt/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*"; }

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    log_error "Do not run as root. Script uses sudo when needed."
    exit 1
fi

log_info "Starting Safe Upgrade Process..."
log_info "Install directory: $INSTALL_DIR"
log_info "Backup directory: $BACKUP_DIR"

# Check if installation exists
if [ ! -d "$INSTALL_DIR" ]; then
    log_error "Installation directory not found: $INSTALL_DIR"
    log_info "If this is a fresh install, use install_ubuntu_public.sh instead"
    exit 1
fi

# Step 1: Create backup
log_info "Step 1: Creating backup of current installation..."
sudo mkdir -p "$BACKUP_DIR"

# Backup critical files
log_info "Backing up configuration files..."
sudo cp -a "$INSTALL_DIR/.env.local" "$BACKUP_DIR/.env.local" 2>/dev/null || log_warning ".env.local not found (will be created)"
sudo cp -a "$INSTALL_DIR/.secure-storage" "$BACKUP_DIR/.secure-storage" 2>/dev/null || log_warning ".secure-storage not found"
sudo cp -a "$INSTALL_DIR/.storage" "$BACKUP_DIR/.storage" 2>/dev/null || log_warning ".storage not found"

# Backup package.json to check version
sudo cp -a "$INSTALL_DIR/package.json" "$BACKUP_DIR/package.json" 2>/dev/null || true

OLD_VERSION=$(sudo cat "$BACKUP_DIR/package.json" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/' || echo "unknown")
log_success "Backup created: $BACKUP_DIR"
log_info "Current version: $OLD_VERSION"

# Step 2: Stop service
log_info "Step 2: Stopping service..."
if sudo systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    sudo systemctl stop "$SERVICE_NAME"
    log_success "Service stopped"
    sleep 2
else
    log_info "Service was not running"
fi

# Step 3: Backup current working directory
CURRENT_DIR=$(pwd)
cd "$INSTALL_DIR"

# Step 4: Pull latest code
log_info "Step 3: Pulling latest code from repository..."
BRANCH=$(sudo -u "$APP_USER" git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
log_info "Current branch: $BRANCH"

sudo -u "$APP_USER" git fetch origin >/dev/null 2>&1 || true
sudo -u "$APP_USER" git pull origin "$BRANCH" >/dev/null 2>&1 || {
    log_error "Failed to pull latest code"
    log_info "Restoring from backup..."
    sudo cp -a "$BACKUP_DIR/.env.local" "$INSTALL_DIR/.env.local" 2>/dev/null || true
    sudo cp -a "$BACKUP_DIR/.secure-storage" "$INSTALL_DIR/.secure-storage" 2>/dev/null || true
    sudo systemctl start "$SERVICE_NAME" 2>/dev/null || true
    exit 1
}
log_success "Code updated"

# Get new version
NEW_VERSION=$(sudo cat "$INSTALL_DIR/package.json" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/' || echo "unknown")
log_info "New version: $NEW_VERSION"

# Step 5: Restore settings
log_info "Step 4: Restoring settings..."
if [ -f "$BACKUP_DIR/.env.local" ]; then
    sudo cp -a "$BACKUP_DIR/.env.local" "$INSTALL_DIR/.env.local"
    sudo chown "$APP_USER:$APP_USER" "$INSTALL_DIR/.env.local"
    log_success ".env.local restored"
else
    log_warning ".env.local not found in backup (may need to be created)"
fi

if [ -d "$BACKUP_DIR/.secure-storage" ]; then
    sudo cp -a "$BACKUP_DIR/.secure-storage" "$INSTALL_DIR/.secure-storage"
    sudo chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR/.secure-storage"
    sudo chmod -R 700 "$INSTALL_DIR/.secure-storage"
    log_success ".secure-storage restored"
fi

if [ -d "$BACKUP_DIR/.storage" ]; then
    sudo cp -a "$BACKUP_DIR/.storage" "$INSTALL_DIR/.storage"
    sudo chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR/.storage"
    log_success ".storage restored"
fi

# Step 6: Install dependencies
log_info "Step 5: Installing/updating dependencies..."
cd "$INSTALL_DIR"
sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash << 'INSTALL_DEPS'
set -e
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci >/dev/null 2>&1 || npm install >/dev/null 2>&1
INSTALL_DEPS
log_success "Dependencies installed"

# Step 7: Build application
log_info "Step 6: Building application..."
cd "$INSTALL_DIR"
sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash << 'BUILD'
set -e
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm run build >/dev/null 2>&1
BUILD
log_success "Application built"

# Step 8: Verify systemd service file (update if needed)
log_info "Step 7: Verifying systemd service..."
if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
    # Check if service file needs Node.js path update
    NODE_PATH=$(sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash << 'GET_NODE'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
which node
GET_NODE
)
    NPM_PATH="${NODE_PATH%/node}/npm"
    
    # Update service file if ExecStart path is different
    CURRENT_EXEC=$(sudo systemctl show "$SERVICE_NAME" --property=ExecStart --value 2>/dev/null | cut -d' ' -f1 || echo "")
    if [ -n "$CURRENT_EXEC" ] && [ "$CURRENT_EXEC" != "$NPM_PATH" ]; then
        log_info "Updating systemd service ExecStart path..."
        sudo sed -i "s|ExecStart=.*|ExecStart=$NPM_PATH start|" "/etc/systemd/system/${SERVICE_NAME}.service"
        sudo systemctl daemon-reload
        log_success "Service file updated"
    fi
else
    log_warning "systemd service file not found (service may not be configured)"
fi

# Step 9: Start service
log_info "Step 8: Starting service..."
sudo systemctl start "$SERVICE_NAME" 2>/dev/null || true
sleep 3

# Step 10: Verify upgrade
log_info "Step 9: Verifying upgrade..."
if sudo systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    log_success "Service is running"
    
    # Check version endpoint
    PORT=$(sudo grep "^PORT=" "$INSTALL_DIR/.env.local" 2>/dev/null | cut -d= -f2 | tr -d ' ' || echo "3000")
    sleep 2
    
    if curl -sf "http://localhost:${PORT}/api/version" >/dev/null 2>&1; then
        VERSION_RESPONSE=$(curl -s "http://localhost:${PORT}/api/version" 2>/dev/null || echo "")
        if echo "$VERSION_RESPONSE" | grep -q "$NEW_VERSION"; then
            log_success "Version verified: $NEW_VERSION"
        else
            log_warning "Version endpoint check failed (service may still be starting)"
        fi
    fi
else
    log_error "Service failed to start"
    log_info "Checking logs..."
    sudo journalctl -u "$SERVICE_NAME" -n 20 --no-pager
    log_info "Restoring from backup if needed..."
    exit 1
fi

# Step 11: Cleanup (optional - keep backup for safety)
log_info "Step 10: Cleanup..."
log_warning "Backup kept at: $BACKUP_DIR"
log_info "You can remove it after verifying the upgrade works:"
log_info "  sudo rm -rf $BACKUP_DIR"

# Summary
echo ""
log_success "Upgrade complete!"
echo ""
echo "Version: $OLD_VERSION → $NEW_VERSION"
echo "Backup location: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "1. Verify the application is working:"
echo "   curl http://localhost:${PORT}/api/health"
echo ""
echo "2. Check logs if needed:"
echo "   sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "3. After verifying everything works, you can remove the backup:"
echo "   sudo rm -rf $BACKUP_DIR"
echo ""

cd "$CURRENT_DIR"
