#!/usr/bin/env bash
# Quick Upgrade Script - Safe Remote Upgrade
# Works without downloading from GitHub - run directly on remote VM

set -euo pipefail

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

# Check if installation exists
if [ ! -d "$INSTALL_DIR" ]; then
    log_error "Installation directory not found: $INSTALL_DIR"
    exit 1
fi

# Step 1: Create backup
log_info "Step 1: Creating backup..."
sudo mkdir -p "$BACKUP_DIR"
sudo cp -a "$INSTALL_DIR/.env.local" "$BACKUP_DIR/.env.local" 2>/dev/null || log_warning ".env.local not found"
sudo cp -a "$INSTALL_DIR/.secure-storage" "$BACKUP_DIR/.secure-storage" 2>/dev/null || log_warning ".secure-storage not found"
sudo cp -a "$INSTALL_DIR/.storage" "$BACKUP_DIR/.storage" 2>/dev/null || log_warning ".storage not found"

OLD_VERSION=$(sudo cat "$INSTALL_DIR/package.json" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/' || echo "unknown")
log_success "Backup created: $BACKUP_DIR (Current version: $OLD_VERSION)"

# Step 2: Stop service
log_info "Step 2: Stopping service..."
if sudo systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    sudo systemctl stop "$SERVICE_NAME"
    sleep 2
fi

# Step 3: Pull latest code
log_info "Step 3: Pulling latest code..."
cd "$INSTALL_DIR"
BRANCH=$(sudo -u "$APP_USER" git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
log_info "Current branch: $BRANCH"

sudo -u "$APP_USER" git fetch origin >/dev/null 2>&1 || true
sudo -u "$APP_USER" git pull origin "$BRANCH" >/dev/null 2>&1 || {
    log_error "Failed to pull code. Restoring from backup..."
    sudo cp -a "$BACKUP_DIR/.env.local" "$INSTALL_DIR/.env.local" 2>/dev/null || true
    sudo systemctl start "$SERVICE_NAME" 2>/dev/null || true
    exit 1
}

NEW_VERSION=$(sudo cat "$INSTALL_DIR/package.json" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/' || echo "unknown")
log_success "Code updated (Version: $OLD_VERSION → $NEW_VERSION)"

# Step 4: Restore settings
log_info "Step 4: Restoring settings..."
if [ -f "$BACKUP_DIR/.env.local" ]; then
    sudo cp -a "$BACKUP_DIR/.env.local" "$INSTALL_DIR/.env.local"
    sudo chown "$APP_USER:$APP_USER" "$INSTALL_DIR/.env.local"
fi
if [ -d "$BACKUP_DIR/.secure-storage" ]; then
    sudo cp -a "$BACKUP_DIR/.secure-storage" "$INSTALL_DIR/.secure-storage"
    sudo chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR/.secure-storage"
fi

# Step 5: Install dependencies
log_info "Step 5: Installing dependencies..."
cd "$INSTALL_DIR"
sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci >/dev/null 2>&1 || npm install >/dev/null 2>&1
EOF
log_success "Dependencies installed"

# Step 6: Build
log_info "Step 6: Building application..."
cd "$INSTALL_DIR"
sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm run build >/dev/null 2>&1
EOF
log_success "Application built"

# Step 7: Start service
log_info "Step 7: Starting service..."
sudo systemctl start "$SERVICE_NAME" 2>/dev/null || true
sleep 3

# Step 8: Verify
log_info "Step 8: Verifying upgrade..."
if sudo systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    log_success "Service is running"
    PORT=$(sudo grep "^PORT=" "$INSTALL_DIR/.env.local" 2>/dev/null | cut -d= -f2 | tr -d ' ' || echo "3000")
    sleep 2
    if curl -sf "http://localhost:${PORT}/api/version" >/dev/null 2>&1; then
        log_success "Version endpoint responding"
    fi
else
    log_error "Service failed to start. Check logs: sudo journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi

echo ""
log_success "Upgrade complete: $OLD_VERSION → $NEW_VERSION"
echo "Backup location: $BACKUP_DIR"
echo "Verify: curl http://localhost:${PORT}/api/version"
