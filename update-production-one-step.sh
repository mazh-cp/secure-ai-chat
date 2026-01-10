#!/bin/bash
# One-Step Production Server Update Command
# Updates production server with latest changes from GitHub
#
# Usage (on production server):
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/v1.0.2/update-production.sh | sudo bash
#
# Or download and run:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/v1.0.2/update-production.sh -o update.sh && sudo bash update.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration (can be overridden via environment variables)
REPO_DIR="${REPO_DIR:-/home/adminuser/secure-ai-chat}"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
BRANCH="${BRANCH:-release/v1.0.2}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      Secure AI Chat - One-Step Production Update            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
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
    echo "  Please run deploy-ubuntu-vm.sh first to set up the repository"
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

# Detect service user
SERVICE_USER=$(stat -c '%U' "$REPO_DIR" 2>/dev/null || echo "adminuser")
SERVICE_GROUP=$(stat -c '%G' "$REPO_DIR" 2>/dev/null || echo "$SERVICE_USER")

echo -e "${BLUE}Configuration:${NC}"
echo "  Repository: $REPO_DIR"
echo "  Branch: $BRANCH"
echo "  Service: $SERVICE_NAME"
echo "  User: $SERVICE_USER"
echo "  Package Manager: $PACKAGE_MANAGER"
echo ""

# Step 1: Fix permissions
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Fix repository permissions${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$USE_SUDO" = "sudo" ]; then
    sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR" 2>/dev/null || true
    sudo chmod -R u+w "$REPO_DIR/.git" 2>/dev/null || true
else
    chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR" 2>/dev/null || true
    chmod -R u+w "$REPO_DIR/.git" 2>/dev/null || true
fi
echo -e "${GREEN}✅ Permissions fixed${NC}"
echo ""

# Step 2: Fetch and update
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Fetch latest changes from GitHub${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
git stash 2>/dev/null || true
git fetch origin
echo -e "${GREEN}✅ Fetched latest changes${NC}"
echo ""

# Step 3: Checkout and pull
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Update to latest version${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" origin/"$BRANCH"
fi

if git pull origin "$BRANCH" 2>&1; then
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
echo ""

# Step 4: Install dependencies
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Install dependencies${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Source Node.js if available
if [ -f "/home/${SERVICE_USER}/.nvm/nvm.sh" ]; then
    source "/home/${SERVICE_USER}/.nvm/nvm.sh" 2>/dev/null || true
elif [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh" 2>/dev/null || true
fi

if [ "$PACKAGE_MANAGER" = "npm" ]; then
    if [ "$USE_SUDO" = "sudo" ] && [ "$SERVICE_USER" != "$USER" ]; then
        sudo -u ${SERVICE_USER} npm ci --production=false || exit 1
    else
        npm ci --production=false || exit 1
    fi
elif [ "$PACKAGE_MANAGER" = "yarn" ]; then
    if [ "$USE_SUDO" = "sudo" ] && [ "$SERVICE_USER" != "$USER" ]; then
        sudo -u ${SERVICE_USER} yarn install --frozen-lockfile || exit 1
    else
        yarn install --frozen-lockfile || exit 1
    fi
elif [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    if [ "$USE_SUDO" = "sudo" ] && [ "$SERVICE_USER" != "$USER" ]; then
        sudo -u ${SERVICE_USER} pnpm install --frozen-lockfile || exit 1
    else
        pnpm install --frozen-lockfile || exit 1
    fi
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 5: Build
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5: Build application${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$PACKAGE_MANAGER" = "npm" ]; then
    if [ "$USE_SUDO" = "sudo" ] && [ "$SERVICE_USER" != "$USER" ]; then
        sudo -u ${SERVICE_USER} npm run build || exit 1
    else
        npm run build || exit 1
    fi
elif [ "$PACKAGE_MANAGER" = "yarn" ]; then
    if [ "$USE_SUDO" = "sudo" ] && [ "$SERVICE_USER" != "$USER" ]; then
        sudo -u ${SERVICE_USER} yarn build || exit 1
    else
        yarn build || exit 1
    fi
elif [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    if [ "$USE_SUDO" = "sudo" ] && [ "$SERVICE_USER" != "$USER" ]; then
        sudo -u ${SERVICE_USER} pnpm build || exit 1
    else
        pnpm build || exit 1
    fi
fi
echo -e "${GREEN}✅ Application built successfully${NC}"
echo ""

# Step 6: Restart service
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 6: Restart service${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    if [ "$USE_SUDO" = "sudo" ]; then
        sudo systemctl restart "$SERVICE_NAME" || exit 1
    else
        systemctl restart "$SERVICE_NAME" || exit 1
    fi
    sleep 5
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${GREEN}✅ Service restarted successfully${NC}"
    else
        echo -e "${RED}❌ Service failed to start${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Service not running, attempting to start...${NC}"
    if [ "$USE_SUDO" = "sudo" ]; then
        sudo systemctl start "$SERVICE_NAME" || exit 1
    else
        systemctl start "$SERVICE_NAME" || exit 1
    fi
    echo -e "${GREEN}✅ Service started successfully${NC}"
fi
echo ""

# Step 7: Verify
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 7: Verify deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
sleep 3
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health endpoint responding${NC}"
else
    echo -e "${YELLOW}⚠️  Health endpoint not responding yet (may take a few seconds)${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  ✅ UPDATE COMPLETE                          ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Branch:          $BRANCH                           ║${NC}"
echo -e "${GREEN}║  Commit:          ${NEW_COMMIT:0:8}                                    ║${NC}"
echo -e "${GREEN}║  Service:         $SERVICE_NAME                                      ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Application updated and restarted successfully.               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
