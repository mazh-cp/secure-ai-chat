#!/bin/bash
# Quick Fix for npm Path Issue
# Ensures nvm and Node.js are properly installed for the service user
#
# Usage:
#   sudo bash scripts/fix-npm-path.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SERVICE_USER="${SERVICE_USER:-adminuser}"
NODE_VERSION="${NODE_VERSION:-25.2.1}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Fix npm Path for Service User                         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ This script must be run with sudo${NC}"
    exit 1
fi

echo -e "${BLUE}Service User:${NC} $SERVICE_USER"
echo -e "${BLUE}Node Version:${NC} $NODE_VERSION"
echo ""

# Step 1: Install nvm for service user
echo -e "${CYAN}Step 1: Installing NVM for ${SERVICE_USER}${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -d "/home/${SERVICE_USER}/.nvm" ]; then
    echo "Installing NVM..."
    sudo -u ${SERVICE_USER} bash -c 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash' || {
        echo -e "${RED}❌ Failed to install NVM${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ NVM installed${NC}"
else
    echo -e "${GREEN}✅ NVM already installed${NC}"
fi
echo ""

# Step 2: Install Node.js for service user
echo -e "${CYAN}Step 2: Installing Node.js ${NODE_VERSION} for ${SERVICE_USER}${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sudo -u ${SERVICE_USER} bash -c "
    export NVM_DIR=\"/home/${SERVICE_USER}/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && source \"\$NVM_DIR/nvm.sh\"
    
    if nvm list | grep -q \"v${NODE_VERSION}\"; then
        echo 'Node.js v${NODE_VERSION} already installed'
        nvm use ${NODE_VERSION}
    else
        echo 'Installing Node.js v${NODE_VERSION}...'
        nvm install ${NODE_VERSION}
        nvm use ${NODE_VERSION}
    fi
    nvm alias default ${NODE_VERSION}
    
    echo 'Verifying installation...'
    node -v
    npm -v
" || {
    echo -e "${RED}❌ Failed to install Node.js${NC}"
    exit 1
}

echo -e "${GREEN}✅ Node.js ${NODE_VERSION} installed${NC}"
echo ""

# Step 3: Verify npm works
echo -e "${CYAN}Step 3: Verifying npm${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

NPM_PATH=$(sudo -u ${SERVICE_USER} bash -c "
    export NVM_DIR=\"/home/${SERVICE_USER}/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && source \"\$NVM_DIR/nvm.sh\"
    nvm use ${NODE_VERSION} > /dev/null 2>&1
    which npm
" 2>/dev/null || echo "")

if [ -n "$NPM_PATH" ]; then
    echo -e "${GREEN}✅ npm found at: $NPM_PATH${NC}"
    NPM_VERSION=$(sudo -u ${SERVICE_USER} bash -c "
        export NVM_DIR=\"/home/${SERVICE_USER}/.nvm\"
        [ -s \"\$NVM_DIR/nvm.sh\" ] && source \"\$NVM_DIR/nvm.sh\"
        nvm use ${NODE_VERSION} > /dev/null 2>&1
        npm -v
    " 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✅ npm version: $NPM_VERSION${NC}"
else
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi
echo ""

# Summary
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ npm path fixed${NC}"
echo ""
echo "You can now run:"
echo "  cd /home/${SERVICE_USER}/secure-ai-chat"
echo "  sudo -u ${SERVICE_USER} bash -c 'source ~/.nvm/nvm.sh && npm install'"
echo ""
