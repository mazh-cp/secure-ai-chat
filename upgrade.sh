#!/bin/bash
# Production Upgrade Script for Secure AI Chat
# Fetches and upgrades the application with latest changes

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_DIR="${REPO_DIR:-/home/adminuser/secure-ai-chat}"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
BRANCH="${BRANCH:-release/v1.0.2}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Secure AI Chat - Production Upgrade Script            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ This script must be run as root or with sudo${NC}"
    exit 1
fi

# Check if repository directory exists
if [ ! -d "$REPO_DIR" ]; then
    echo -e "${RED}❌ Repository directory not found: $REPO_DIR${NC}"
    exit 1
fi

cd "$REPO_DIR"

# Detect package manager
PACKAGE_MANAGER="npm"
if [ -f "package-lock.json" ]; then
    PACKAGE_MANAGER="npm"
elif [ -f "yarn.lock" ]; then
    PACKAGE_MANAGER="yarn"
elif [ -f "pnpm-lock.yaml" ]; then
    PACKAGE_MANAGER="pnpm"
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Backup current state${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Backup current commit
CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

echo "Current branch: $CURRENT_BRANCH"
echo "Current commit: $CURRENT_COMMIT"

# Backup .env file if it exists
if [ -f ".env" ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✅ Environment file backed up${NC}"
fi

echo ""

# Step 2: Fetch latest changes
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Fetch latest changes${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

git fetch origin
echo -e "${GREEN}✅ Fetched latest changes from origin${NC}"
echo ""

# Step 3: Checkout and pull branch
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Update to latest version${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Checkout branch if not already on it
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "Switching to branch: $BRANCH"
    git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" origin/"$BRANCH"
fi

# Pull latest changes
git pull origin "$BRANCH" || {
    echo -e "${RED}❌ Failed to pull latest changes${NC}"
    exit 1
}

NEW_COMMIT=$(git rev-parse HEAD)
echo -e "${GREEN}✅ Updated to latest version${NC}"
echo "New commit: $NEW_COMMIT"
echo ""

# Step 4: Install dependencies
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Install dependencies${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Source Node.js if available
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
fi

# Install dependencies using lockfile-safe method
if [ "$PACKAGE_MANAGER" = "npm" ]; then
    npm ci --production=false || {
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    }
elif [ "$PACKAGE_MANAGER" = "yarn" ]; then
    yarn install --frozen-lockfile || {
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    }
elif [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    pnpm install --frozen-lockfile || {
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    }
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 5: Build application
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5: Build application${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$PACKAGE_MANAGER" = "npm" ]; then
    npm run build || {
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    }
elif [ "$PACKAGE_MANAGER" = "yarn" ]; then
    yarn build || {
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    }
elif [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    pnpm build || {
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    }
fi

echo -e "${GREEN}✅ Application built successfully${NC}"
echo ""

# Step 6: Restart service
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 6: Restart service${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "Restarting service: $SERVICE_NAME"
    systemctl restart "$SERVICE_NAME" || {
        echo -e "${RED}❌ Failed to restart service${NC}"
        exit 1
    }
    
    # Wait for service to start
    sleep 3
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${GREEN}✅ Service restarted successfully${NC}"
    else
        echo -e "${RED}❌ Service failed to start${NC}"
        systemctl status "$SERVICE_NAME" --no-pager -l | head -20
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Service not running, attempting to start...${NC}"
    systemctl start "$SERVICE_NAME" || {
        echo -e "${RED}❌ Failed to start service${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ Service started successfully${NC}"
fi
echo ""

# Step 7: Verify deployment
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 7: Verify deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

sleep 2

# Health check
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health endpoint responding${NC}"
    curl -s http://localhost:3000/api/health | head -1
else
    echo -e "${YELLOW}⚠️  Health endpoint not responding yet (may take a few seconds)${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}UPGRADE SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  ✅ UPGRADE COMPLETE                          ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Previous commit: ${CURRENT_COMMIT:0:8}                                    ║${NC}"
echo -e "${GREEN}║  New commit:      ${NEW_COMMIT:0:8}                                    ║${NC}"
echo -e "${GREEN}║  Branch:          $BRANCH                           ║${NC}"
echo -e "${GREEN}║  Service:         $SERVICE_NAME                                      ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Application upgraded and restarted successfully.             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo "Service status:"
systemctl status "$SERVICE_NAME" --no-pager -l | head -10
echo ""
