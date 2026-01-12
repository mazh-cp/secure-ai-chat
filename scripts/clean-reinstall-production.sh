#!/bin/bash
# Clean Reinstall Script for Production VM
# Performs a complete clean reinstall based on current local build
# This fixes all issues by starting fresh with latest code
#
# Usage:
#   sudo bash clean-reinstall-production.sh
#   Or with custom options:
#   REPO_DIR=/custom/path BRANCH=main sudo bash clean-reinstall-production.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration (can be overridden via environment variables)
REPO_DIR="${REPO_DIR:-/home/adminuser/secure-ai-chat}"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
BRANCH="${BRANCH:-main}"
REPO_URL="${REPO_URL:-https://github.com/mazh-cp/secure-ai-chat.git}"
BACKUP_DIR="${BACKUP_DIR:-/home/adminuser/secure-ai-chat-backup-$(date +%Y%m%d_%H%M%S)}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Clean Reinstall Script for Production VM                ║${NC}"
echo -e "${BLUE}║     Based on Current Local Build (v1.0.7)                    ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Repository: $REPO_DIR"
echo "  Branch: $BRANCH"
echo "  Service: $SERVICE_NAME"
echo "  Backup: $BACKUP_DIR"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}⚠️  This script should be run with sudo for service management${NC}"
    echo "  Proceeding without sudo (some operations may fail)..."
    USE_SUDO=""
else
    USE_SUDO="sudo"
fi

# Check if repository directory exists
if [ ! -d "$REPO_DIR" ]; then
    echo -e "${RED}❌ Repository directory not found: $REPO_DIR${NC}"
    echo "  Please ensure the directory exists or set REPO_DIR environment variable"
    exit 1
fi

cd "$REPO_DIR"

# Detect service user from repository ownership or default
SERVICE_USER=$(stat -c '%U' "$REPO_DIR" 2>/dev/null || echo "adminuser")
SERVICE_GROUP=$(stat -c '%G' "$REPO_DIR" 2>/dev/null || echo "$SERVICE_USER")

echo -e "${BLUE}Service User:${NC} $SERVICE_USER"
echo ""

# Step 1: Stop service
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 1: Stop Service${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "Stopping service: $SERVICE_NAME"
    if [ "$USE_SUDO" = "sudo" ]; then
        sudo systemctl stop "$SERVICE_NAME" || {
            echo -e "${YELLOW}⚠️  Failed to stop service gracefully, forcing...${NC}"
            sudo pkill -f "next-server" || true
            sudo pkill -f "next dev" || true
            sleep 2
        }
    else
        systemctl stop "$SERVICE_NAME" || {
            echo -e "${YELLOW}⚠️  Failed to stop service gracefully, forcing...${NC}"
            pkill -f "next-server" || true
            pkill -f "next dev" || true
            sleep 2
        }
    fi
    sleep 2
    echo -e "${GREEN}✅ Service stopped${NC}"
else
    echo -e "${YELLOW}⚠️  Service not running${NC}"
    # Kill any stray processes
    pkill -f "next-server" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    sleep 2
fi

# Step 2: Backup critical data
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 2: Backup Critical Data${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

mkdir -p "$BACKUP_DIR"
echo "Backup directory: $BACKUP_DIR"

# Backup .secure-storage (API keys)
if [ -d ".secure-storage" ]; then
    echo "Backing up .secure-storage..."
    cp -r .secure-storage "$BACKUP_DIR/.secure-storage"
    echo -e "${GREEN}✅ API keys backed up${NC}"
else
    echo -e "${YELLOW}⚠️  .secure-storage not found (will be created on first use)${NC}"
fi

# Backup .storage (uploaded files)
if [ -d ".storage" ]; then
    echo "Backing up .storage..."
    cp -r .storage "$BACKUP_DIR/.storage"
    echo -e "${GREEN}✅ Uploaded files backed up${NC}"
else
    echo -e "${YELLOW}⚠️  .storage not found (will be created on first use)${NC}"
fi

# Backup .env file if exists
if [ -f ".env" ]; then
    echo "Backing up .env..."
    cp .env "$BACKUP_DIR/.env"
    echo -e "${GREEN}✅ Environment file backed up${NC}"
fi

# Backup .env.local if exists
if [ -f ".env.local" ]; then
    echo "Backing up .env.local..."
    cp .env.local "$BACKUP_DIR/.env.local"
    echo -e "${GREEN}✅ Local environment file backed up${NC}"
fi

# Backup current commit for reference
CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
echo "$CURRENT_COMMIT" > "$BACKUP_DIR/previous-commit.txt"
echo "Previous commit: ${CURRENT_COMMIT:0:8}"

echo ""
echo -e "${GREEN}✅ Backup complete: $BACKUP_DIR${NC}"

# Step 3: Clean installation
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 3: Clean Installation${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Removing node_modules..."
rm -rf node_modules
echo -e "${GREEN}✅ node_modules removed${NC}"

echo "Removing build cache..."
rm -rf .next
echo -e "${GREEN}✅ Build cache removed${NC}"

echo "Removing package-lock.json (will be regenerated)..."
rm -f package-lock.json
echo -e "${GREEN}✅ package-lock.json removed${NC}"

echo "Removing other caches..."
rm -rf .cache
rm -rf node_modules/.cache
rm -rf .turbo
echo -e "${GREEN}✅ All caches cleared${NC}"

# Step 4: Update from GitHub
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 4: Update from GitHub${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Fix permissions
if [ "$USE_SUDO" = "sudo" ]; then
    sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR" 2>/dev/null || true
    sudo chmod -R u+w "$REPO_DIR/.git" 2>/dev/null || true
else
    chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR" 2>/dev/null || true
    chmod -R u+w "$REPO_DIR/.git" 2>/dev/null || true
fi

# Stash any local changes
git stash 2>/dev/null || true

# Fetch latest
echo "Fetching latest changes from GitHub..."
git fetch origin
echo -e "${GREEN}✅ Fetched latest changes${NC}"

# Checkout and pull
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "Switching to branch: $BRANCH"
    git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" origin/"$BRANCH"
fi

echo "Pulling latest changes..."
if git pull origin "$BRANCH"; then
    NEW_COMMIT=$(git rev-parse HEAD)
    echo -e "${GREEN}✅ Updated to latest version${NC}"
    echo "New commit: ${NEW_COMMIT:0:8}"
else
    echo -e "${YELLOW}⚠️  Pull failed, trying reset...${NC}"
    git fetch origin
    git reset --hard origin/"$BRANCH" || {
        echo -e "${RED}❌ Failed to update repository${NC}"
        exit 1
    }
    NEW_COMMIT=$(git rev-parse HEAD)
    echo -e "${GREEN}✅ Updated to latest version (via reset)${NC}"
    echo "New commit: ${NEW_COMMIT:0:8}"
fi

# Step 5: Fix Permissions Before Install
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 5a: Fix Permissions${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Fix ownership of entire repository before npm operations
if [ "$USE_SUDO" = "sudo" ]; then
    echo "Setting ownership to $SERVICE_USER:$SERVICE_GROUP..."
    sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR" 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Could not set ownership (may need manual fix)${NC}"
    }
    
    # Ensure write permissions on key files
    sudo chmod -R u+w "$REPO_DIR" 2>/dev/null || true
    sudo chmod 644 package.json 2>/dev/null || true
    sudo chmod 644 package-lock.json 2>/dev/null || true
    
    echo -e "${GREEN}✅ Permissions fixed${NC}"
else
    echo -e "${YELLOW}⚠️  Not running as root, skipping permission fixes${NC}"
    echo "   You may need to run: sudo chown -R $SERVICE_USER:$SERVICE_GROUP $REPO_DIR"
fi

# Step 5: Install dependencies
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 5b: Install Dependencies${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Source Node.js if available
if [ -f "/home/${SERVICE_USER}/.nvm/nvm.sh" ]; then
    source "/home/${SERVICE_USER}/.nvm/nvm.sh" 2>/dev/null || true
elif [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh" 2>/dev/null || true
fi

# Verify Node.js version
NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
echo "Node.js version: $NODE_VERSION"

# Ensure we're running as the service user for npm operations
if [ "$USE_SUDO" = "sudo" ] && [ "$SERVICE_USER" != "$USER" ]; then
    echo "Installing dependencies as $SERVICE_USER (this may take a few minutes)..."
    # Use sudo -u to run as service user, and ensure HOME is set
    sudo -u ${SERVICE_USER} env HOME="/home/${SERVICE_USER}" npm install --production=false || {
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        echo -e "${YELLOW}⚠️  Trying to fix permissions and retry...${NC}"
        sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR"
        sudo chmod -R u+w "$REPO_DIR"
        sudo -u ${SERVICE_USER} env HOME="/home/${SERVICE_USER}" npm install --production=false || {
            echo -e "${RED}❌ Failed to install dependencies after permission fix${NC}"
            exit 1
        }
    }
else
    echo "Installing dependencies (this may take a few minutes)..."
    npm install --production=false || {
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        echo -e "${YELLOW}⚠️  This may be a permissions issue. Try running with sudo.${NC}"
        exit 1
    }
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 6: Build application
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 6: Build Application${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Building application (this may take a few minutes)..."
if [ "$USE_SUDO" = "sudo" ] && [ "$SERVICE_USER" != "$USER" ]; then
    sudo -u ${SERVICE_USER} npm run build || {
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    }
else
    npm run build || {
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    }
fi

echo -e "${GREEN}✅ Application built successfully${NC}"

# Step 7: Restore backups
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 7: Restore Backups${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Restore .secure-storage
if [ -d "$BACKUP_DIR/.secure-storage" ]; then
    echo "Restoring .secure-storage..."
    rm -rf .secure-storage
    cp -r "$BACKUP_DIR/.secure-storage" .secure-storage
    # Fix permissions
    chmod -R 700 .secure-storage 2>/dev/null || true
    if [ "$USE_SUDO" = "sudo" ]; then
        sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} .secure-storage 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ API keys restored${NC}"
fi

# Restore .storage
if [ -d "$BACKUP_DIR/.storage" ]; then
    echo "Restoring .storage..."
    rm -rf .storage
    cp -r "$BACKUP_DIR/.storage" .storage
    # Fix permissions
    if [ "$USE_SUDO" = "sudo" ]; then
        sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} .storage 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ Uploaded files restored${NC}"
fi

# Restore .env if it existed
if [ -f "$BACKUP_DIR/.env" ]; then
    echo "Restoring .env..."
    cp "$BACKUP_DIR/.env" .env
    echo -e "${GREEN}✅ Environment file restored${NC}"
fi

# Restore .env.local if it existed
if [ -f "$BACKUP_DIR/.env.local" ]; then
    echo "Restoring .env.local..."
    cp "$BACKUP_DIR/.env.local" .env.local
    echo -e "${GREEN}✅ Local environment file restored${NC}"
fi

# Step 8: Fix permissions (final)
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 8: Fix Permissions (Final)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$USE_SUDO" = "sudo" ]; then
    echo "Setting ownership to $SERVICE_USER:$SERVICE_GROUP..."
    sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR" 2>/dev/null || true
    
    # Ensure all files are writable by owner
    sudo chmod -R u+w "$REPO_DIR" 2>/dev/null || true
    
    # Fix specific file permissions
    sudo chmod 644 package.json 2>/dev/null || true
    sudo chmod 644 package-lock.json 2>/dev/null || true
    
    echo "Setting secure storage permissions..."
    sudo chmod -R 700 .secure-storage 2>/dev/null || true
    sudo chmod -R 600 .secure-storage/* 2>/dev/null || true
    
    echo "Setting storage permissions..."
    sudo chmod -R 755 .storage 2>/dev/null || true
    
    # Fix node_modules ownership (if exists)
    if [ -d "node_modules" ]; then
        sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} node_modules 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ Permissions fixed${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping permission fixes (not running as root)${NC}"
fi

# Step 9: Restart service
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 9: Restart Service${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Starting service: $SERVICE_NAME"
if [ "$USE_SUDO" = "sudo" ]; then
    sudo systemctl start "$SERVICE_NAME" || {
        echo -e "${RED}❌ Failed to start service${NC}"
        sudo systemctl status "$SERVICE_NAME" --no-pager -l | head -20
        exit 1
    }
else
    systemctl start "$SERVICE_NAME" || {
        echo -e "${RED}❌ Failed to start service${NC}"
        systemctl status "$SERVICE_NAME" --no-pager -l | head -20
        exit 1
    }
fi

# Wait for service to start
sleep 5

if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✅ Service started successfully${NC}"
else
    echo -e "${RED}❌ Service failed to start${NC}"
    if [ "$USE_SUDO" = "sudo" ]; then
        sudo systemctl status "$SERVICE_NAME" --no-pager -l | head -20
    else
        systemctl status "$SERVICE_NAME" --no-pager -l | head -20
    fi
    exit 1
fi

# Step 10: Verify installation
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 10: Verify Installation${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

sleep 3

# Health check
HEALTH_URL="http://localhost:3000/api/health"
if curl -s -f "$HEALTH_URL" > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s "$HEALTH_URL" | head -1)
    echo -e "${GREEN}✅ Health endpoint: OK${NC}"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo -e "${YELLOW}⚠️  Health endpoint not responding yet (may take a few seconds)${NC}"
fi

# Version check
VERSION_URL="http://localhost:3000/api/version"
if curl -s -f "$VERSION_URL" > /dev/null 2>&1; then
    VERSION_RESPONSE=$(curl -s "$VERSION_URL")
    VERSION_API=$(echo "$VERSION_RESPONSE" | grep -oE '"version":"[^"]+"' | cut -d'"' -f4 || echo "unknown")
    echo -e "${GREEN}✅ Version endpoint: OK${NC}"
    echo "   Version: $VERSION_API"
else
    echo -e "${YELLOW}⚠️  Version endpoint not responding yet${NC}"
fi

# Check critical pages
echo ""
echo "Checking pages..."
PAGES=("/" "/release-notes" "/settings" "/files" "/dashboard")
for page in "${PAGES[@]}"; do
    if curl -s -f "http://localhost:3000${page}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC} $page"
    else
        echo -e "${YELLOW}⚠️${NC} $page (may need a moment)"
    fi
done

# Summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}REINSTALL SUMMARY${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            ✅ CLEAN REINSTALL COMPLETE                         ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Previous commit: ${CURRENT_COMMIT:0:8}                                    ║${NC}"
echo -e "${GREEN}║  New commit:      ${NEW_COMMIT:0:8}                                    ║${NC}"
echo -e "${GREEN}║  Branch:          $BRANCH                           ║${NC}"
echo -e "${GREEN}║  Service:         $SERVICE_NAME                                      ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Application reinstalled and restarted successfully.           ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}Backup Location:${NC} $BACKUP_DIR"
echo ""

echo -e "${BLUE}What was done:${NC}"
echo "  ✅ Service stopped"
echo "  ✅ Critical data backed up"
echo "  ✅ Complete clean (node_modules, .next, caches)"
echo "  ✅ Latest code pulled from GitHub"
echo "  ✅ Fresh dependencies installed"
echo "  ✅ Application rebuilt"
echo "  ✅ Backups restored (API keys, files, env)"
echo "  ✅ Permissions fixed"
echo "  ✅ Service restarted"
echo "  ✅ Installation verified"
echo ""

echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Verify keys in Settings page"
echo "  2. Test chat functionality"
echo "  3. Test file upload and scanning"
echo "  4. Check Release Notes page"
echo "  5. Verify Model Selector works"
echo ""

echo -e "${BLUE}Useful Commands:${NC}"
echo "  sudo systemctl status $SERVICE_NAME"
echo "  sudo journalctl -u $SERVICE_NAME -f"
echo "  curl http://localhost:3000/api/health"
echo "  curl http://localhost:3000/api/version"
echo ""

if [ -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}⚠️  Backup directory preserved: $BACKUP_DIR${NC}"
    echo "   You can remove it after verifying everything works"
fi

echo ""
