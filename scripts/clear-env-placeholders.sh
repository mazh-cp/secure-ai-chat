#!/bin/bash
# Clear Placeholder Environment Variables
# Removes placeholder values from .env file that prevent key saving
#
# Usage:
#   sudo bash scripts/clear-env-placeholders.sh

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
echo -e "${BLUE}║        Clear Placeholder Environment Variables             ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ This script must be run with sudo${NC}"
    exit 1
fi

cd "$REPO_DIR"

ENV_FILE="$REPO_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  .env file does not exist${NC}"
    exit 0
fi

echo -e "${CYAN}Checking .env file for placeholder values...${NC}"
echo ""

# Backup .env file
BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
sudo cp "$ENV_FILE" "$BACKUP_FILE"
echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
echo ""

# Check for placeholder values
HAS_PLACEHOLDERS=false

if grep -q "OPENAI_API_KEY.*your_ope" "$ENV_FILE" || grep -q "OPENAI_API_KEY.*your-api-key" "$ENV_FILE" || grep -q "OPENAI_API_KEY.*placeholder" "$ENV_FILE"; then
    echo -e "${YELLOW}⚠️  Found placeholder OPENAI_API_KEY${NC}"
    HAS_PLACEHOLDERS=true
    # Remove the line or comment it out
    sudo sed -i '/^OPENAI_API_KEY.*your_ope/d' "$ENV_FILE"
    sudo sed -i '/^OPENAI_API_KEY.*your-api-key/d' "$ENV_FILE"
    sudo sed -i '/^OPENAI_API_KEY.*placeholder/d' "$ENV_FILE"
    echo -e "${GREEN}✅ Removed placeholder OPENAI_API_KEY${NC}"
fi

if grep -q "LAKERA_AI_KEY.*your" "$ENV_FILE" || grep -q "LAKERA_AI_KEY.*placeholder" "$ENV_FILE"; then
    echo -e "${YELLOW}⚠️  Found placeholder LAKERA_AI_KEY${NC}"
    HAS_PLACEHOLDERS=true
    sudo sed -i '/^LAKERA_AI_KEY.*your/d' "$ENV_FILE"
    sudo sed -i '/^LAKERA_AI_KEY.*placeholder/d' "$ENV_FILE"
    echo -e "${GREEN}✅ Removed placeholder LAKERA_AI_KEY${NC}"
fi

if grep -q "LAKERA_PROJECT_ID.*your" "$ENV_FILE" || grep -q "LAKERA_PROJECT_ID.*placeholder" "$ENV_FILE"; then
    echo -e "${YELLOW}⚠️  Found placeholder LAKERA_PROJECT_ID${NC}"
    HAS_PLACEHOLDERS=true
    sudo sed -i '/^LAKERA_PROJECT_ID.*your/d' "$ENV_FILE"
    sudo sed -i '/^LAKERA_PROJECT_ID.*placeholder/d' "$ENV_FILE"
    echo -e "${GREEN}✅ Removed placeholder LAKERA_PROJECT_ID${NC}"
fi

if [ "$HAS_PLACEHOLDERS" = false ]; then
    echo -e "${GREEN}✅ No placeholder values found in .env file${NC}"
else
    echo ""
    echo -e "${GREEN}✅ Placeholder values removed${NC}"
    echo ""
    echo "Updated .env file:"
    grep -E "^(OPENAI_API_KEY|LAKERA_AI_KEY|LAKERA_PROJECT_ID)=" "$ENV_FILE" || echo "  (no API key env vars found)"
fi

# Fix permissions
sudo chown ${SERVICE_USER}:${SERVICE_USER} "$ENV_FILE"
sudo chmod 600 "$ENV_FILE"

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Placeholder environment variables cleared${NC}"
echo ""
echo "Next steps:"
echo "  1. Restart service: sudo systemctl restart secure-ai-chat"
echo "  2. Go to Settings and save your API keys"
echo "  3. Keys should now save properly to file storage"
echo ""
