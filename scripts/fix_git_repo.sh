#!/usr/bin/env bash
# Fix Git Repository - Initialize or Re-clone Repository Properly
# Ensures single clean installation without duplicate repositories

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/secure-ai-chat}"
APP_USER="${APP_USER:-secureai}"
REPO_URL="https://github.com/mazh-cp/secure-ai-chat.git"
BRANCH="${BRANCH:-main}"

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

log_info "Fixing Git Repository Setup..."
log_info "Install directory: $INSTALL_DIR"

# Check if installation exists
if [ ! -d "$INSTALL_DIR" ]; then
    log_error "Installation directory not found: $INSTALL_DIR"
    exit 1
fi

# Step 1: Stop service
log_info "Step 1: Stopping service..."
if systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
    sudo systemctl stop secure-ai-chat
    log_success "Service stopped"
else
    log_info "Service not running"
fi

# Step 2: Create backup
log_info "Step 2: Creating backup..."
BACKUP_DIR="/tmp/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"
sudo cp -a "$INSTALL_DIR/.env.local" "$BACKUP_DIR/.env.local" 2>/dev/null || log_warning ".env.local not found"
sudo cp -a "$INSTALL_DIR/.secure-storage" "$BACKUP_DIR/.secure-storage" 2>/dev/null || log_warning ".secure-storage not found"
sudo cp -a "$INSTALL_DIR/.storage" "$BACKUP_DIR/.storage" 2>/dev/null || log_warning ".storage not found"
sudo cp -a "$INSTALL_DIR/package.json" "$BACKUP_DIR/package.json" 2>/dev/null || true
log_success "Backup created: $BACKUP_DIR"

# Step 3: Check if .git exists
cd "$INSTALL_DIR"

if [ -d ".git" ]; then
    log_info "Step 3: .git directory exists, checking repository status..."
    
    # Check if it's a valid git repo
    if sudo -u "$APP_USER" git rev-parse --git-dir >/dev/null 2>&1; then
        log_success "Valid git repository found"
        
        # Check remote
        REMOTE_URL=$(sudo -u "$APP_USER" git remote get-url origin 2>/dev/null || echo "")
        if [ -z "$REMOTE_URL" ]; then
            log_warning "No remote configured, adding origin..."
            sudo -u "$APP_USER" git remote add origin "$REPO_URL" 2>/dev/null || true
        fi
        
        # Fetch and update
        log_info "Fetching latest from remote..."
        sudo -u "$APP_USER" git fetch origin >/dev/null 2>&1 || true
        
        # Check current branch
        CURRENT_BRANCH=$(sudo -u "$APP_USER" git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
        log_info "Current branch: $CURRENT_BRANCH"
        
        # Pull latest
        log_info "Pulling latest code..."
        sudo -u "$APP_USER" git pull origin "$CURRENT_BRANCH" >/dev/null 2>&1 || {
            log_warning "Pull failed, trying to reset..."
            sudo -u "$APP_USER" git fetch origin
            sudo -u "$APP_USER" git reset --hard "origin/$CURRENT_BRANCH" >/dev/null 2>&1 || true
        }
        
        log_success "Repository updated"
    else
        log_warning "Invalid git repository, re-initializing..."
        sudo rm -rf "$INSTALL_DIR/.git"
        # Fall through to re-clone
    fi
else
    log_warning "No .git directory found"
fi

# Step 4: If no valid git repo, re-clone (preserving settings)
if [ ! -d ".git" ] || ! sudo -u "$APP_USER" git rev-parse --git-dir >/dev/null 2>&1; then
    log_info "Step 4: Re-cloning repository..."
    
    # Save current directory contents (except .git)
    TEMP_BACKUP="/tmp/secure-ai-chat-temp-$(date +%Y%m%d-%H%M%S)"
    sudo mkdir -p "$TEMP_BACKUP"
    
    # Move non-git files to temp
    sudo find "$INSTALL_DIR" -maxdepth 1 -not -name '.' -not -name '..' -not -name '.git' -exec mv {} "$TEMP_BACKUP/" \; 2>/dev/null || true
    
    # Clone fresh repository
    log_info "Cloning repository..."
    sudo rm -rf "$INSTALL_DIR"
    sudo mkdir -p "$INSTALL_DIR"
    sudo chown "$APP_USER:$APP_USER" "$INSTALL_DIR"
    
    sudo -u "$APP_USER" git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$INSTALL_DIR" >/dev/null 2>&1 || \
    sudo -u "$APP_USER" git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" >/dev/null 2>&1
    
    # Restore settings from backup
    log_info "Restoring settings..."
    if [ -f "$BACKUP_DIR/.env.local" ]; then
        sudo cp -a "$BACKUP_DIR/.env.local" "$INSTALL_DIR/.env.local"
        sudo chown "$APP_USER:$APP_USER" "$INSTALL_DIR/.env.local"
    fi
    if [ -d "$BACKUP_DIR/.secure-storage" ]; then
        sudo cp -a "$BACKUP_DIR/.secure-storage" "$INSTALL_DIR/.secure-storage"
        sudo chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR/.secure-storage"
    fi
    if [ -d "$BACKUP_DIR/.storage" ]; then
        sudo cp -a "$BACKUP_DIR/.storage" "$INSTALL_DIR/.storage"
        sudo chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR/.storage"
    fi
    
    # Clean up temp backup
    sudo rm -rf "$TEMP_BACKUP"
    
    log_success "Repository re-cloned and settings restored"
fi

# Step 5: Verify git repository
cd "$INSTALL_DIR"
if sudo -u "$APP_USER" git rev-parse --git-dir >/dev/null 2>&1; then
    CURRENT_BRANCH=$(sudo -u "$APP_USER" git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    REMOTE_URL=$(sudo -u "$APP_USER" git remote get-url origin 2>/dev/null || echo "none")
    VERSION=$(sudo cat "$INSTALL_DIR/package.json" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/' || echo "unknown")
    
    log_success "Git repository verified"
    log_info "  Branch: $CURRENT_BRANCH"
    log_info "  Remote: $REMOTE_URL"
    log_info "  Version: $VERSION"
else
    log_error "Failed to setup git repository"
    exit 1
fi

# Step 6: Install dependencies and rebuild
log_info "Step 5: Installing dependencies..."
cd "$INSTALL_DIR"
sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci >/dev/null 2>&1 || npm install >/dev/null 2>&1
EOF
log_success "Dependencies installed"

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
sudo systemctl start secure-ai-chat 2>/dev/null || true
sleep 3

# Step 8: Verify
log_info "Step 8: Verifying installation..."
if sudo systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
    log_success "Service is running"
    
    PORT=$(sudo grep "^PORT=" "$INSTALL_DIR/.env.local" 2>/dev/null | cut -d= -f2 | tr -d ' ' || echo "3000")
    sleep 2
    
    if curl -sf "http://localhost:${PORT}/api/version" >/dev/null 2>&1; then
        VERSION_RESPONSE=$(curl -s "http://localhost:${PORT}/api/version" 2>/dev/null || echo "")
        log_success "Version endpoint responding: $VERSION_RESPONSE"
    fi
else
    log_warning "Service status check failed (may still be starting)"
    log_info "Check logs: sudo journalctl -u secure-ai-chat -n 50"
fi

echo ""
log_success "Git repository fixed!"
echo ""
echo "Repository status:"
echo "  Location: $INSTALL_DIR"
echo "  Branch: $CURRENT_BRANCH"
echo "  Version: $VERSION"
echo ""
echo "Backup location: $BACKUP_DIR"
echo "You can remove it after verifying: sudo rm -rf $BACKUP_DIR"
echo ""
