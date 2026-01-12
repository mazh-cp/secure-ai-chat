#!/bin/bash
# Quick Permission Fix Script for Production
# Fixes permission issues that prevent npm install from working
#
# Usage:
#   sudo bash scripts/fix-permissions.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_DIR="${REPO_DIR:-/home/adminuser/secure-ai-chat}"
SERVICE_USER="${SERVICE_USER:-adminuser}"
SERVICE_GROUP="${SERVICE_GROUP:-adminuser}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Permission Fix Script for Production                  ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ This script must be run with sudo${NC}"
    echo "   Usage: sudo bash scripts/fix-permissions.sh"
    exit 1
fi

cd "$REPO_DIR"

echo -e "${BLUE}Repository:${NC} $REPO_DIR"
echo -e "${BLUE}Service User:${NC} $SERVICE_USER"
echo -e "${BLUE}Service Group:${NC} $SERVICE_GROUP"
echo ""

# Detect actual user/group from directory ownership
if [ -d "$REPO_DIR" ]; then
    ACTUAL_USER=$(stat -c '%U' "$REPO_DIR" 2>/dev/null || echo "$SERVICE_USER")
    ACTUAL_GROUP=$(stat -c '%G' "$REPO_DIR" 2>/dev/null || echo "$SERVICE_GROUP")
    
    if [ "$ACTUAL_USER" != "$SERVICE_USER" ]; then
        echo -e "${YELLOW}⚠️  Detected different user: $ACTUAL_USER${NC}"
        SERVICE_USER="$ACTUAL_USER"
    fi
    if [ "$ACTUAL_GROUP" != "$SERVICE_GROUP" ]; then
        echo -e "${YELLOW}⚠️  Detected different group: $ACTUAL_GROUP${NC}"
        SERVICE_GROUP="$ACTUAL_GROUP"
    fi
fi

echo -e "${BLUE}Using:${NC} $SERVICE_USER:$SERVICE_GROUP"
echo ""

# Step 1: Fix ownership
echo -e "${CYAN}Step 1: Fixing ownership...${NC}"
sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR" || {
    echo -e "${RED}❌ Failed to set ownership${NC}"
    exit 1
}
echo -e "${GREEN}✅ Ownership fixed${NC}"

# Step 2: Fix permissions
echo ""
echo -e "${CYAN}Step 2: Fixing permissions...${NC}"

# Make directory writable
sudo chmod -R u+w "$REPO_DIR" || true

# Fix specific files
sudo chmod 644 package.json 2>/dev/null || true
sudo chmod 644 package-lock.json 2>/dev/null || true
sudo chmod 755 . 2>/dev/null || true

# Fix .git directory
if [ -d ".git" ]; then
    sudo chmod -R u+w .git 2>/dev/null || true
    echo -e "${GREEN}✅ Git directory permissions fixed${NC}"
fi

# Fix secure storage
if [ -d ".secure-storage" ]; then
    sudo chmod -R 700 .secure-storage 2>/dev/null || true
    sudo chmod -R 600 .secure-storage/* 2>/dev/null || true
    echo -e "${GREEN}✅ Secure storage permissions fixed${NC}"
fi

# Fix storage
if [ -d ".storage" ]; then
    sudo chmod -R 755 .storage 2>/dev/null || true
    echo -e "${GREEN}✅ Storage permissions fixed${NC}"
fi

echo -e "${GREEN}✅ Permissions fixed${NC}"

# Step 3: Verify
echo ""
echo -e "${CYAN}Step 3: Verifying permissions...${NC}"

# Check if package.json is writable
if [ -w "package.json" ]; then
    echo -e "${GREEN}✅ package.json is writable${NC}"
else
    echo -e "${RED}❌ package.json is not writable${NC}"
    sudo chmod 644 package.json
fi

# Check if package-lock.json is writable (or can be created)
if [ -f "package-lock.json" ]; then
    if [ -w "package-lock.json" ]; then
        echo -e "${GREEN}✅ package-lock.json is writable${NC}"
    else
        echo -e "${RED}❌ package-lock.json is not writable${NC}"
        sudo chmod 644 package-lock.json
    fi
else
    echo -e "${YELLOW}⚠️  package-lock.json doesn't exist (will be created)${NC}"
    # Ensure directory is writable
    sudo chmod u+w .
fi

# Check directory ownership
DIR_OWNER=$(stat -c '%U' "$REPO_DIR" 2>/dev/null || echo "unknown")
if [ "$DIR_OWNER" = "$SERVICE_USER" ]; then
    echo -e "${GREEN}✅ Directory ownership correct${NC}"
else
    echo -e "${YELLOW}⚠️  Directory owned by $DIR_OWNER (expected $SERVICE_USER)${NC}"
fi

# Summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}✅ Permissions fixed${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Try npm install again:"
echo "     sudo -u $SERVICE_USER npm install --production=false"
echo ""
echo "  2. Or run the clean reinstall script:"
echo "     sudo bash scripts/clean-reinstall-production.sh"
echo ""
echo -e "${BLUE}To verify:${NC}"
echo "  ls -la package.json"
echo "  ls -la package-lock.json"
echo ""
