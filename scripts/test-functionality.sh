#!/bin/bash
# Test Application Functionality
# Tests key storage, chat, and RAG functionality

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Application Functionality Test                           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Wait for server to be ready
echo -e "${CYAN}Waiting for server to be ready...${NC}"
for i in {1..30}; do
    if curl -s "${BASE_URL}/api/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Server did not start in time${NC}"
        exit 1
    fi
    sleep 1
done
echo ""

# Test 1: Health Check
echo -e "${CYAN}Test 1: Health Check${NC}"
HEALTH=$(curl -s "${BASE_URL}/api/health")
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✅ Health check passed${NC}"
    echo "   Response: $HEALTH"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo "   Response: $HEALTH"
fi
echo ""

# Test 2: Version Check
echo -e "${CYAN}Test 2: Version Check${NC}"
VERSION=$(curl -s "${BASE_URL}/api/version")
if echo "$VERSION" | grep -q "1.0.7"; then
    echo -e "${GREEN}✅ Version check passed${NC}"
    echo "   Response: $VERSION"
else
    echo -e "${YELLOW}⚠️  Version check: $VERSION${NC}"
fi
echo ""

# Test 3: Keys Storage Check
echo -e "${CYAN}Test 3: Keys Storage Check${NC}"
KEYS_RESPONSE=$(curl -s "${BASE_URL}/api/keys/retrieve")
if echo "$KEYS_RESPONSE" | grep -q "configured"; then
    echo -e "${GREEN}✅ Keys storage check passed${NC}"
    echo "   Response: $KEYS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "   $KEYS_RESPONSE"
    
    # Check if keys are configured
    if echo "$KEYS_RESPONSE" | grep -q '"openAiKey":"configured"\|"openAiKey":true'; then
        echo -e "${GREEN}   ✅ OpenAI key is configured${NC}"
    else
        echo -e "${YELLOW}   ⚠️  OpenAI key is not configured${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Keys response: $KEYS_RESPONSE${NC}"
fi
echo ""

# Test 4: Models Endpoint
echo -e "${CYAN}Test 4: Models Endpoint${NC}"
MODELS_RESPONSE=$(curl -s "${BASE_URL}/api/models")
if echo "$MODELS_RESPONSE" | grep -q "models\|error"; then
    if echo "$MODELS_RESPONSE" | grep -q "error"; then
        echo -e "${YELLOW}⚠️  Models endpoint returned error (may need API key)${NC}"
        echo "   Response: $MODELS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "   $MODELS_RESPONSE"
    else
        echo -e "${GREEN}✅ Models endpoint working${NC}"
        echo "   Response: $(echo "$MODELS_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f\"Found {len(data.get('models', []))} models\")" 2>/dev/null || echo "Models found")"
    fi
else
    echo -e "${YELLOW}⚠️  Unexpected models response${NC}"
fi
echo ""

# Test 5: Files List Endpoint
echo -e "${CYAN}Test 5: Files List Endpoint${NC}"
FILES_RESPONSE=$(curl -s "${BASE_URL}/api/files/list")
if echo "$FILES_RESPONSE" | grep -q "files\|\[\]"; then
    echo -e "${GREEN}✅ Files list endpoint working${NC}"
    FILE_COUNT=$(echo "$FILES_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('files', [])))" 2>/dev/null || echo "0")
    echo "   Found $FILE_COUNT files"
else
    echo -e "${YELLOW}⚠️  Files list response: $FILES_RESPONSE${NC}"
fi
echo ""

# Test 6: Settings Status
echo -e "${CYAN}Test 6: Settings Status${NC}"
SETTINGS_RESPONSE=$(curl -s "${BASE_URL}/api/settings/status")
if echo "$SETTINGS_RESPONSE" | grep -q "pin\|checkpoint"; then
    echo -e "${GREEN}✅ Settings status endpoint working${NC}"
    echo "   Response: $SETTINGS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "   $SETTINGS_RESPONSE"
else
    echo -e "${YELLOW}⚠️  Settings status response: $SETTINGS_RESPONSE${NC}"
fi
echo ""

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Test Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Basic functionality tests completed${NC}"
echo ""
echo "Manual tests to perform:"
echo "  1. Open browser: ${BASE_URL}"
echo "  2. Go to Settings and verify keys are displayed"
echo "  3. Test chat: Send a message and verify response"
echo "  4. Test RAG: Upload a file, enable RAG, ask about file content"
echo "  5. Verify keys persist after page refresh"
echo ""
