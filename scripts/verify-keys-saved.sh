#!/bin/bash
# Verify if API keys are actually saved to storage
#
# Usage:
#   sudo bash scripts/verify-keys-saved.sh

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
STORAGE_DIR="$REPO_DIR/.secure-storage"
KEYS_FILE="$STORAGE_DIR/api-keys.enc"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Verify API Keys Storage Status                    ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$REPO_DIR"

# Check storage directory
echo -e "${CYAN}Checking storage directory...${NC}"
if [ -d "$STORAGE_DIR" ]; then
    echo -e "${GREEN}✅ Storage directory exists: $STORAGE_DIR${NC}"
    ls -ld "$STORAGE_DIR" | awk '{print "   Permissions: " $1 " Owner: " $3 ":" $4}'
else
    echo -e "${RED}❌ Storage directory does not exist: $STORAGE_DIR${NC}"
    echo "   Run: sudo bash scripts/fix-key-storage.sh"
    exit 1
fi

echo ""

# Check keys file
echo -e "${CYAN}Checking keys file...${NC}"
if [ -f "$KEYS_FILE" ]; then
    FILE_SIZE=$(stat -f%z "$KEYS_FILE" 2>/dev/null || stat -c%s "$KEYS_FILE" 2>/dev/null || echo "0")
    if [ "$FILE_SIZE" -gt 0 ]; then
        echo -e "${GREEN}✅ Keys file exists: $KEYS_FILE${NC}"
        echo "   Size: $FILE_SIZE bytes"
        ls -l "$KEYS_FILE" | awk '{print "   Permissions: " $1 " Owner: " $3 ":" $4}'
    else
        echo -e "${YELLOW}⚠️  Keys file exists but is empty (0 bytes)${NC}"
        echo "   Keys have not been saved yet"
    fi
else
    echo -e "${YELLOW}⚠️  Keys file does not exist: $KEYS_FILE${NC}"
    echo "   Keys have not been saved yet"
fi

echo ""

# Check environment variables
echo -e "${CYAN}Checking environment variables...${NC}"
ENV_VARS_FOUND=false

if [ -n "${OPENAI_API_KEY:-}" ]; then
    if echo "$OPENAI_API_KEY" | grep -q "your_ope\|your-api-key\|placeholder"; then
        echo -e "${YELLOW}⚠️  OPENAI_API_KEY is set but contains placeholder${NC}"
    else
        echo -e "${GREEN}✅ OPENAI_API_KEY is set (env var takes priority)${NC}"
        ENV_VARS_FOUND=true
    fi
else
    echo -e "${CYAN}ℹ️  OPENAI_API_KEY not set in environment${NC}"
fi

if [ -n "${LAKERA_AI_KEY:-}" ]; then
    if echo "$LAKERA_AI_KEY" | grep -q "your\|placeholder"; then
        echo -e "${YELLOW}⚠️  LAKERA_AI_KEY is set but contains placeholder${NC}"
    else
        echo -e "${GREEN}✅ LAKERA_AI_KEY is set (env var takes priority)${NC}"
        ENV_VARS_FOUND=true
    fi
else
    echo -e "${CYAN}ℹ️  LAKERA_AI_KEY not set in environment${NC}"
fi

if [ -n "${LAKERA_PROJECT_ID:-}" ]; then
    if echo "$LAKERA_PROJECT_ID" | grep -q "your\|placeholder"; then
        echo -e "${YELLOW}⚠️  LAKERA_PROJECT_ID is set but contains placeholder${NC}"
    else
        echo -e "${GREEN}✅ LAKERA_PROJECT_ID is set (env var takes priority)${NC}"
        ENV_VARS_FOUND=true
    fi
else
    echo -e "${CYAN}ℹ️  LAKERA_PROJECT_ID not set in environment${NC}"
fi

echo ""

# Check .env file
echo -e "${CYAN}Checking .env file...${NC}"
ENV_FILE="$REPO_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    PLACEHOLDERS_FOUND=false
    
    if grep -q "OPENAI_API_KEY.*your_ope\|OPENAI_API_KEY.*your-api-key\|OPENAI_API_KEY.*placeholder" "$ENV_FILE" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  .env contains placeholder OPENAI_API_KEY${NC}"
        PLACEHOLDERS_FOUND=true
    fi
    
    if grep -q "LAKERA_AI_KEY.*your\|LAKERA_AI_KEY.*placeholder" "$ENV_FILE" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  .env contains placeholder LAKERA_AI_KEY${NC}"
        PLACEHOLDERS_FOUND=true
    fi
    
    if grep -q "LAKERA_PROJECT_ID.*your\|LAKERA_PROJECT_ID.*placeholder" "$ENV_FILE" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  .env contains placeholder LAKERA_PROJECT_ID${NC}"
        PLACEHOLDERS_FOUND=true
    fi
    
    if [ "$PLACEHOLDERS_FOUND" = false ]; then
        echo -e "${GREEN}✅ .env file does not contain placeholder values${NC}"
    else
        echo -e "${YELLOW}⚠️  Run: sudo bash scripts/clear-env-placeholders.sh${NC}"
    fi
else
    echo -e "${CYAN}ℹ️  .env file does not exist${NC}"
fi

echo ""

# Test API endpoint
echo -e "${CYAN}Testing API endpoint...${NC}"
if systemctl is-active --quiet secure-ai-chat; then
    RESPONSE=$(curl -s http://localhost:3000/api/keys/retrieve 2>/dev/null || echo "")
    if [ -n "$RESPONSE" ]; then
        echo -e "${GREEN}✅ API endpoint is accessible${NC}"
        echo ""
        echo "Response:"
        echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
        
        # Check if keys are configured
        if echo "$RESPONSE" | grep -q '"openAiKey":"configured"\|"openAiKey":true'; then
            echo ""
            echo -e "${GREEN}✅ OpenAI key is configured${NC}"
        elif echo "$RESPONSE" | grep -q '"openAiKey":null\|"openAiKey":false'; then
            echo ""
            echo -e "${YELLOW}⚠️  OpenAI key is NOT configured${NC}"
        fi
    else
        echo -e "${RED}❌ API endpoint is not responding${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Service is not running${NC}"
    echo "   Run: sudo systemctl start secure-ai-chat"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$ENV_VARS_FOUND" = true ]; then
    echo -e "${GREEN}✅ Keys are configured via environment variables${NC}"
    echo "   (Environment variables take priority over file storage)"
elif [ -f "$KEYS_FILE" ] && [ "$FILE_SIZE" -gt 0 ]; then
    echo -e "${GREEN}✅ Keys are saved to file storage${NC}"
else
    echo -e "${YELLOW}⚠️  Keys are NOT saved${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Clear placeholder env vars: sudo bash scripts/clear-env-placeholders.sh"
    echo "  2. Pull latest code: cd $REPO_DIR && git pull origin main"
    echo "  3. Rebuild: sudo -u $SERVICE_USER bash -c 'source ~/.nvm/nvm.sh && npm run build'"
    echo "  4. Restart: sudo systemctl restart secure-ai-chat"
    echo "  5. Save keys via Settings page"
fi

echo ""
