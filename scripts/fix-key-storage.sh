#!/bin/bash
# Fix Key Storage Issues
# Fixes permissions and ensures storage directory is set up correctly
#
# Usage:
#   sudo bash scripts/fix-key-storage.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO_DIR="${REPO_DIR:-/home/adminuser/secure-ai-chat}"
SERVICE_USER="${SERVICE_USER:-adminuser}"
SERVICE_GROUP="${SERVICE_GROUP:-adminuser}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Fix Key Storage Issues                               ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ This script must be run with sudo${NC}"
    exit 1
fi

cd "$REPO_DIR"

# Step 1: Create storage directory
echo -e "${CYAN}Step 1: Creating Storage Directory${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

STORAGE_DIR="$REPO_DIR/.secure-storage"

if [ ! -d "$STORAGE_DIR" ]; then
    echo "Creating storage directory..."
    sudo -u ${SERVICE_USER} mkdir -p "$STORAGE_DIR"
    echo -e "${GREEN}✅ Storage directory created${NC}"
else
    echo -e "${GREEN}✅ Storage directory exists${NC}"
fi
echo ""

# Step 2: Fix permissions
echo -e "${CYAN}Step 2: Fixing Permissions${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Set ownership
echo "Setting ownership to ${SERVICE_USER}:${SERVICE_GROUP}..."
sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$STORAGE_DIR"
echo -e "${GREEN}✅ Ownership set${NC}"

# Set directory permissions
echo "Setting directory permissions to 700..."
sudo chmod 700 "$STORAGE_DIR"
echo -e "${GREEN}✅ Directory permissions set${NC}"

# Set file permissions (if files exist)
if [ -f "$STORAGE_DIR/api-keys.enc" ]; then
    echo "Setting file permissions to 600..."
    sudo chmod 600 "$STORAGE_DIR/api-keys.enc"
    echo -e "${GREEN}✅ File permissions set${NC}"
fi

echo ""

# Step 3: Verify permissions
echo -e "${CYAN}Step 3: Verifying Permissions${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DIR_OWNER=$(stat -c '%U:%G' "$STORAGE_DIR" 2>/dev/null || stat -f '%Su:%Sg' "$STORAGE_DIR" 2>/dev/null || echo "unknown")
DIR_PERMS=$(stat -c '%a' "$STORAGE_DIR" 2>/dev/null || stat -f '%A' "$STORAGE_DIR" 2>/dev/null || echo "unknown")

echo "Storage directory:"
echo "   Owner: $DIR_OWNER"
echo "   Permissions: $DIR_PERMS"

if [ "$DIR_OWNER" = "${SERVICE_USER}:${SERVICE_GROUP}" ] && [ "$DIR_PERMS" = "700" ]; then
    echo -e "${GREEN}✅ Permissions are correct${NC}"
else
    echo -e "${YELLOW}⚠️  Permissions may need adjustment${NC}"
fi

# Check if service user can write
if sudo -u ${SERVICE_USER} test -w "$STORAGE_DIR"; then
    echo -e "${GREEN}✅ Service user can write to storage directory${NC}"
else
    echo -e "${RED}❌ Service user cannot write to storage directory${NC}"
    echo "   Fixing..."
    sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$STORAGE_DIR"
    sudo chmod 700 "$STORAGE_DIR"
    echo -e "${GREEN}✅ Fixed${NC}"
fi
echo ""

# Step 4: Test write access
echo -e "${CYAN}Step 4: Testing Write Access${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TEST_FILE="$STORAGE_DIR/.write-test"
if sudo -u ${SERVICE_USER} touch "$TEST_FILE" 2>/dev/null; then
    sudo -u ${SERVICE_USER} rm -f "$TEST_FILE"
    echo -e "${GREEN}✅ Write access test passed${NC}"
else
    echo -e "${RED}❌ Write access test failed${NC}"
    echo "   Service user cannot write to storage directory"
    echo "   This will prevent keys from being saved"
fi
echo ""

# Step 5: Restart service
echo -e "${CYAN}Step 5: Restarting Service${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
    echo "Restarting service to apply changes..."
    sudo systemctl restart secure-ai-chat
    sleep 3
    if systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
        echo -e "${GREEN}✅ Service restarted${NC}"
    else
        echo -e "${YELLOW}⚠️  Service may have issues starting${NC}"
        sudo systemctl status secure-ai-chat --no-pager -l | head -10
    fi
else
    echo -e "${YELLOW}⚠️  Service is not running${NC}"
fi
echo ""

# Summary
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Key storage fixed${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Go to Settings page"
echo "  2. Paste your API keys"
echo "  3. Click Save"
echo "  4. Verify keys are saved by checking /api/keys endpoint"
echo ""
echo "To verify keys are saved:"
echo "  curl http://localhost:3000/api/keys"
echo ""
