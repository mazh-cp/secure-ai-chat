#!/bin/bash
# Production Server Update Script for Secure AI Chat
# Updates the application on production server with latest changes from GitHub
#
# Usage:
#   sudo bash update-production.sh
#   Or with custom options:
#   REPO_DIR=/custom/path BRANCH=release/v1.0.2 sudo bash update-production.sh

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
REPO_URL="${REPO_URL:-https://github.com/mazh-cp/secure-ai-chat.git}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      Secure AI Chat - Production Server Update Script       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Repository: $REPO_DIR"
echo "  Branch: $BRANCH"
echo "  Service: $SERVICE_NAME"
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

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Backup current state${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Backup current commit
CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

echo "Current branch: $CURRENT_BRANCH"
echo "Current commit: $CURRENT_COMMIT"
echo "Target branch: $BRANCH"

# Backup .env file if it exists
if [ -f ".env" ]; then
    BACKUP_FILE=".env.backup.$(date +%Y%m%d_%H%M%S)"
    cp .env "$BACKUP_FILE"
    echo -e "${GREEN}✅ Environment file backed up to: $BACKUP_FILE${NC}"
fi

echo ""

# Step 2: Fix permissions before git operations
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Fix repository permissions${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Detect service user from repository ownership or default
SERVICE_USER=$(stat -c '%U' "$REPO_DIR" 2>/dev/null || echo "adminuser")
SERVICE_GROUP=$(stat -c '%G' "$REPO_DIR" 2>/dev/null || echo "$SERVICE_USER")

echo "Service user: $SERVICE_USER"
echo "Fixing ownership to $SERVICE_USER:$SERVICE_GROUP..."

if [ "$USE_SUDO" = "sudo" ]; then
    sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR" 2>/dev/null || true
    sudo chmod -R u+w "$REPO_DIR/.git" 2>/dev/null || true
else
    chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR" 2>/dev/null || true
    chmod -R u+w "$REPO_DIR/.git" 2>/dev/null || true
fi

echo -e "${GREEN}✅ Permissions fixed${NC}"
echo ""

# Step 3: Fetch and update from GitHub
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Fetch latest changes from GitHub${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Stash any local changes
git stash 2>/dev/null || true

# Fetch latest changes
git fetch origin
echo -e "${GREEN}✅ Fetched latest changes from origin${NC}"
echo ""

# Step 4: Checkout and pull branch
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Update to latest version${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Checkout branch if not already on it
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "Switching to branch: $BRANCH"
    git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" origin/"$BRANCH"
fi

# Pull latest changes
if git pull origin "$BRANCH"; then
    NEW_COMMIT=$(git rev-parse HEAD)
    echo -e "${GREEN}✅ Updated to latest version${NC}"
    echo "New commit: $NEW_COMMIT"
else
    echo -e "${YELLOW}⚠️  Pull failed, trying reset to origin/${BRANCH}...${NC}"
    git fetch origin
    git reset --hard origin/"$BRANCH" || {
        echo -e "${RED}❌ Failed to update repository${NC}"
        exit 1
    }
    NEW_COMMIT=$(git rev-parse HEAD)
    echo -e "${GREEN}✅ Updated to latest version (via reset)${NC}"
    echo "New commit: $NEW_COMMIT"
fi
echo ""

# Step 5: Install dependencies
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5: Install dependencies${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Source Node.js if available (for service user)
if [ -f "/home/${SERVICE_USER}/.nvm/nvm.sh" ]; then
    source "/home/${SERVICE_USER}/.nvm/nvm.sh" 2>/dev/null || true
elif [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh" 2>/dev/null || true
fi

# Install dependencies using lockfile-safe method
echo "Installing dependencies using $PACKAGE_MANAGER..."

if [ "$PACKAGE_MANAGER" = "npm" ]; then
    if [ "$USE_SUDO" = "sudo" ] && [ "$SERVICE_USER" != "$USER" ]; then
        sudo -u ${SERVICE_USER} npm ci --production=false || {
            echo -e "${RED}❌ Failed to install dependencies${NC}"
            exit 1
        }
    else
        npm ci --production=false || {
            echo -e "${RED}❌ Failed to install dependencies${NC}"
            exit 1
        }
    fi
elif [ "$PACKAGE_MANAGER" = "yarn" ]; then
    if [ "$USE_SUDO" = "sudo" ] && [ "$SERVICE_USER" != "$USER" ]; then
        sudo -u ${SERVICE_USER} yarn install --frozen-lockfile || {
            echo -e "${RED}❌ Failed to install dependencies${NC}"
            exit 1
        }
    else
        yarn install --frozen-lockfile || {
            echo -e "${RED}❌ Failed to install dependencies${NC}"
            exit 1
        }
    fi
elif [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    if [ "$USE_SUDO" = "sudo" ] && [ "$SERVICE_USER" != "$USER" ]; then
        sudo -u ${SERVICE_USER} pnpm install --frozen-lockfile || {
            echo -e "${RED}❌ Failed to install dependencies${NC}"
            exit 1
        }
    else
        pnpm install --frozen-lockfile || {
            echo -e "${RED}❌ Failed to install dependencies${NC}"
            exit 1
        }
    fi
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 6: Build application
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 6: Build application${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$PACKAGE_MANAGER" = "npm" ]; then
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
elif [ "$PACKAGE_MANAGER" = "yarn" ]; then
    if [ "$USE_SUDO" = "sudo" ] && [ "$SERVICE_USER" != "$USER" ]; then
        sudo -u ${SERVICE_USER} yarn build || {
            echo -e "${RED}❌ Build failed${NC}"
            exit 1
        }
    else
        yarn build || {
            echo -e "${RED}❌ Build failed${NC}"
            exit 1
        }
    fi
elif [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    if [ "$USE_SUDO" = "sudo" ] && [ "$SERVICE_USER" != "$USER" ]; then
        sudo -u ${SERVICE_USER} pnpm build || {
            echo -e "${RED}❌ Build failed${NC}"
            exit 1
        }
    else
        pnpm build || {
            echo -e "${RED}❌ Build failed${NC}"
            exit 1
        }
    fi
fi

echo -e "${GREEN}✅ Application built successfully${NC}"
echo ""

# Step 7: Restart service
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 7: Restart service${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "Restarting service: $SERVICE_NAME"
    if [ "$USE_SUDO" = "sudo" ]; then
        sudo systemctl restart "$SERVICE_NAME" || {
            echo -e "${RED}❌ Failed to restart service${NC}"
            exit 1
        }
    else
        systemctl restart "$SERVICE_NAME" || {
            echo -e "${RED}❌ Failed to restart service${NC}"
            exit 1
        }
    fi
    
    # Wait for service to start
    sleep 5
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${GREEN}✅ Service restarted successfully${NC}"
    else
        echo -e "${RED}❌ Service failed to start${NC}"
        if [ "$USE_SUDO" = "sudo" ]; then
            sudo systemctl status "$SERVICE_NAME" --no-pager -l | head -20
        else
            systemctl status "$SERVICE_NAME" --no-pager -l | head -20
        fi
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Service not running, attempting to start...${NC}"
    if [ "$USE_SUDO" = "sudo" ]; then
        sudo systemctl start "$SERVICE_NAME" || {
            echo -e "${RED}❌ Failed to start service${NC}"
            exit 1
        }
    else
        systemctl start "$SERVICE_NAME" || {
            echo -e "${RED}❌ Failed to start service${NC}"
            exit 1
        }
    fi
    echo -e "${GREEN}✅ Service started successfully${NC}"
fi
echo ""

# Step 8: Verify deployment
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 8: Verify deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

sleep 3

# Health check
HEALTH_URL="http://localhost:3000/api/health"
if curl -s "$HEALTH_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health endpoint responding${NC}"
    curl -s "$HEALTH_URL" | head -1
else
    echo -e "${YELLOW}⚠️  Health endpoint not responding yet (may take a few seconds)${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}UPDATE SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  ✅ UPDATE COMPLETE                          ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Previous commit: ${CURRENT_COMMIT:0:8}                                    ║${NC}"
echo -e "${GREEN}║  New commit:      ${NEW_COMMIT:0:8}                                    ║${NC}"
echo -e "${GREEN}║  Branch:          $BRANCH                           ║${NC}"
echo -e "${GREEN}║  Service:         $SERVICE_NAME                                      ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Application updated and restarted successfully.               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ -f "$BACKUP_FILE" ]; then
    echo "Backup file: $BACKUP_FILE"
fi

echo ""
echo "Service status:"
if [ "$USE_SUDO" = "sudo" ]; then
    sudo systemctl status "$SERVICE_NAME" --no-pager -l | head -10
else
    systemctl status "$SERVICE_NAME" --no-pager -l | head -10
fi
echo ""

echo -e "${BLUE}Useful commands:${NC}"
echo "  sudo systemctl status $SERVICE_NAME"
echo "  sudo systemctl restart $SERVICE_NAME"
echo "  sudo journalctl -u $SERVICE_NAME -f"
echo ""
