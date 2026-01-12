#!/bin/bash
# Check Key Storage Diagnostic Script
# Diagnoses why keys aren't being saved or retrieved
#
# Usage:
#   sudo bash scripts/check-key-storage.sh

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

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Key Storage Diagnostic Script                        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$REPO_DIR"

# Step 1: Check storage directory
echo -e "${CYAN}Step 1: Checking Storage Directory${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

STORAGE_DIR="$REPO_DIR/.secure-storage"
KEYS_FILE="$STORAGE_DIR/api-keys.enc"

if [ -d "$STORAGE_DIR" ]; then
    echo -e "${GREEN}✅ Storage directory exists: $STORAGE_DIR${NC}"
    ls -la "$STORAGE_DIR" | head -10
else
    echo -e "${RED}❌ Storage directory does not exist: $STORAGE_DIR${NC}"
    echo "   Creating storage directory..."
    sudo -u ${SERVICE_USER} mkdir -p "$STORAGE_DIR"
    sudo chmod 700 "$STORAGE_DIR"
    echo -e "${GREEN}✅ Storage directory created${NC}"
fi

if [ -f "$KEYS_FILE" ]; then
    echo -e "${GREEN}✅ Keys file exists: $KEYS_FILE${NC}"
    FILE_SIZE=$(stat -f%z "$KEYS_FILE" 2>/dev/null || stat -c%s "$KEYS_FILE" 2>/dev/null || echo "0")
    echo "   File size: $FILE_SIZE bytes"
    if [ "$FILE_SIZE" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  Keys file is empty${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Keys file does not exist: $KEYS_FILE${NC}"
    echo "   This is normal if no keys have been saved yet"
fi
echo ""

# Step 2: Check permissions
echo -e "${CYAN}Step 2: Checking Permissions${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "$STORAGE_DIR" ]; then
    DIR_OWNER=$(stat -c '%U:%G' "$STORAGE_DIR" 2>/dev/null || stat -f '%Su:%Sg' "$STORAGE_DIR" 2>/dev/null || echo "unknown")
    DIR_PERMS=$(stat -c '%a' "$STORAGE_DIR" 2>/dev/null || stat -f '%A' "$STORAGE_DIR" 2>/dev/null || echo "unknown")
    
    echo "Storage directory:"
    echo "   Owner: $DIR_OWNER"
    echo "   Permissions: $DIR_PERMS"
    
    if [ "$DIR_OWNER" = "${SERVICE_USER}:${SERVICE_USER}" ]; then
        echo -e "${GREEN}✅ Ownership is correct${NC}"
    else
        echo -e "${YELLOW}⚠️  Ownership is incorrect (should be ${SERVICE_USER}:${SERVICE_USER})${NC}"
        echo "   Fixing ownership..."
        sudo chown -R ${SERVICE_USER}:${SERVICE_USER} "$STORAGE_DIR"
        echo -e "${GREEN}✅ Ownership fixed${NC}"
    fi
    
    if [ "$DIR_PERMS" = "700" ]; then
        echo -e "${GREEN}✅ Permissions are correct (700)${NC}"
    else
        echo -e "${YELLOW}⚠️  Permissions are incorrect (should be 700)${NC}"
        echo "   Fixing permissions..."
        sudo chmod 700 "$STORAGE_DIR"
        if [ -f "$KEYS_FILE" ]; then
            sudo chmod 600 "$KEYS_FILE"
        fi
        echo -e "${GREEN}✅ Permissions fixed${NC}"
    fi
fi
echo ""

# Step 3: Test API endpoint
echo -e "${CYAN}Step 3: Testing API Endpoints${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Testing /api/keys (GET - status):"
STATUS_RESPONSE=$(curl -s http://localhost:3000/api/keys 2>/dev/null || echo "ERROR")
if [ "$STATUS_RESPONSE" != "ERROR" ]; then
    echo "$STATUS_RESPONSE" | head -5
    if echo "$STATUS_RESPONSE" | grep -q '"openAiKey":true'; then
        echo -e "${GREEN}✅ OpenAI key is configured${NC}"
    else
        echo -e "${YELLOW}⚠️  OpenAI key is not configured${NC}"
    fi
else
    echo -e "${RED}❌ Failed to reach /api/keys endpoint${NC}"
    echo "   Is the service running?"
fi

echo ""
echo "Testing /api/keys/retrieve:"
RETRIEVE_RESPONSE=$(curl -s http://localhost:3000/api/keys/retrieve 2>/dev/null || echo "ERROR")
if [ "$RETRIEVE_RESPONSE" != "ERROR" ]; then
    echo "$RETRIEVE_RESPONSE" | head -5
    if echo "$RETRIEVE_RESPONSE" | grep -q '"openAiKey":"configured"'; then
        echo -e "${GREEN}✅ OpenAI key is configured (returns 'configured')${NC}"
    elif echo "$RETRIEVE_RESPONSE" | grep -q '"openAiKey":null'; then
        echo -e "${YELLOW}⚠️  OpenAI key is not configured (returns null)${NC}"
    fi
else
    echo -e "${RED}❌ Failed to reach /api/keys/retrieve endpoint${NC}"
fi
echo ""

# Step 4: Check service logs
echo -e "${CYAN}Step 4: Checking Service Logs${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Recent logs (last 20 lines):"
sudo journalctl -u secure-ai-chat -n 20 --no-pager | grep -i "key\|error\|save" || echo "No relevant log entries"
echo ""

# Step 5: Test saving a key
echo -e "${CYAN}Step 5: Testing Key Save${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "To test saving a key, use the Settings UI or:"
echo "  curl -X POST http://localhost:3000/api/keys \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"keys\":{\"openAiKey\":\"test-key-123\"}}'"
echo ""

# Summary
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. If storage directory doesn't exist or has wrong permissions, fix them"
echo "  2. Check service logs for errors during key save"
echo "  3. Try saving keys again via Settings UI"
echo "  4. Verify keys are saved by checking /api/keys endpoint"
echo ""
