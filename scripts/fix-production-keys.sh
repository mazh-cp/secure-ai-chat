#!/bin/bash
# Fix Production API Keys Issue
# Clears build cache and verifies key storage

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_DIR="${REPO_DIR:-/home/adminuser/secure-ai-chat}"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Production API Keys Fix Script                      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$REPO_DIR"

# Step 1: Stop service
echo -e "${BLUE}Step 1: Stopping service...${NC}"
sudo systemctl stop "$SERVICE_NAME" || true
sleep 2

# Step 2: Clear build cache
echo -e "${BLUE}Step 2: Clearing build cache...${NC}"
rm -rf .next
echo -e "${GREEN}✅ Build cache cleared${NC}"

# Step 3: Check key storage
echo ""
echo -e "${BLUE}Step 3: Checking key storage...${NC}"

if [ -f ".secure-storage/api-keys.enc" ]; then
    echo -e "${GREEN}✅ Key storage file exists${NC}"
    FILE_SIZE=$(stat -c%s ".secure-storage/api-keys.enc" 2>/dev/null || echo "0")
    echo "   File size: $FILE_SIZE bytes"
    
    if [ "$FILE_SIZE" -lt 50 ]; then
        echo -e "${YELLOW}⚠️  Warning: Key file seems too small (may be empty or corrupted)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Key storage file not found${NC}"
    echo "   Keys may need to be reconfigured in Settings"
fi

# Step 4: Check environment variables
echo ""
echo -e "${BLUE}Step 4: Checking environment variables...${NC}"

if [ -f ".env" ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
    
    # Check for placeholder keys
    if grep -q "your_ope\|OPENAI_API_KEY.*=.*your\|sk-your" .env 2>/dev/null; then
        echo -e "${RED}❌ Found placeholder keys in .env file${NC}"
        echo "   Please update .env file with actual API keys"
    else
        echo -e "${GREEN}✅ No placeholder keys found in .env${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env file not found (this is OK if using Settings page)${NC}"
fi

# Step 5: Rebuild
echo ""
echo -e "${BLUE}Step 5: Rebuilding application...${NC}"

# Source Node.js if available
SERVICE_USER=$(stat -c '%U' "$REPO_DIR" 2>/dev/null || echo "adminuser")
if [ -f "/home/${SERVICE_USER}/.nvm/nvm.sh" ]; then
    source "/home/${SERVICE_USER}/.nvm/nvm.sh" 2>/dev/null || true
fi

npm run build
echo -e "${GREEN}✅ Application rebuilt${NC}"

# Step 6: Restart service
echo ""
echo -e "${BLUE}Step 6: Restarting service...${NC}"
sudo systemctl start "$SERVICE_NAME"
sleep 5

if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✅ Service restarted successfully${NC}"
else
    echo -e "${RED}❌ Service failed to start${NC}"
    sudo systemctl status "$SERVICE_NAME" --no-pager -l | head -20
    exit 1
fi

# Step 7: Verify
echo ""
echo -e "${BLUE}Step 7: Verifying...${NC}"

sleep 3

# Check health
if curl -s -f "http://localhost:3000/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health endpoint responding${NC}"
else
    echo -e "${RED}❌ Health endpoint not responding${NC}"
fi

# Check version
VERSION=$(curl -s "http://localhost:3000/api/version" 2>/dev/null | grep -oE '"version":"[^"]+"' | cut -d'"' -f4 || echo "unknown")
echo "   Version: $VERSION"

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Build cache cleared${NC}"
echo -e "${GREEN}✅ Application rebuilt${NC}"
echo -e "${GREEN}✅ Service restarted${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "   1. Go to Settings page and verify your API keys are saved"
echo "   2. If keys show as configured but still get errors, try:"
echo "      - Clear and re-save the keys in Settings"
echo "      - Check that keys are not placeholders"
echo "   3. Test chat functionality"
echo ""
echo -e "${BLUE}To check keys status:${NC}"
echo "   curl http://localhost:3000/api/keys"
echo ""
