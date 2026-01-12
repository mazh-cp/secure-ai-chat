#!/bin/bash
# Quick Production Health Check Script
# Checks critical endpoints and service status

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Production Health Check                            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check service status
echo -e "${BLUE}1. Service Status:${NC}"
if systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
    echo -e "${GREEN}✅ Service is running${NC}"
    SERVICE_STATUS=$(systemctl is-active secure-ai-chat)
    echo "   Status: $SERVICE_STATUS"
else
    echo -e "${RED}❌ Service is not running${NC}"
    exit 1
fi

# Check recent errors
echo ""
echo -e "${BLUE}2. Recent Service Errors (last 10 lines):${NC}"
RECENT_ERRORS=$(sudo journalctl -u secure-ai-chat -n 10 --no-pager | grep -i "error\|exception\|failed" || echo "No recent errors found")
if [ "$RECENT_ERRORS" != "No recent errors found" ]; then
    echo -e "${YELLOW}⚠️  Found recent errors:${NC}"
    echo "$RECENT_ERRORS" | head -5
else
    echo -e "${GREEN}✅ No recent errors${NC}"
fi

# Check API endpoints
echo ""
echo -e "${BLUE}3. API Endpoints:${NC}"

# Health endpoint
if curl -s -f "${BASE_URL}/api/health" > /dev/null 2>&1; then
    HEALTH=$(curl -s "${BASE_URL}/api/health" | head -1)
    echo -e "${GREEN}✅ Health endpoint: OK${NC}"
    echo "   Response: $HEALTH"
else
    echo -e "${RED}❌ Health endpoint: FAILED${NC}"
fi

# Version endpoint
if curl -s -f "${BASE_URL}/api/version" > /dev/null 2>&1; then
    VERSION=$(curl -s "${BASE_URL}/api/version" | grep -oE '"version":"[^"]+"' | cut -d'"' -f4 || echo "unknown")
    echo -e "${GREEN}✅ Version endpoint: OK${NC}"
    echo "   Version: $VERSION"
else
    echo -e "${RED}❌ Version endpoint: FAILED${NC}"
fi

# Models endpoint
if curl -s -f "${BASE_URL}/api/models" > /dev/null 2>&1; then
    MODELS_COUNT=$(curl -s "${BASE_URL}/api/models" | grep -o '"id"' | wc -l || echo "0")
    if [ "$MODELS_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ Models endpoint: OK${NC}"
        echo "   Models available: $MODELS_COUNT"
    else
        echo -e "${YELLOW}⚠️  Models endpoint: No models (API key may not be configured)${NC}"
    fi
else
    ERROR_MSG=$(curl -s "${BASE_URL}/api/models" 2>&1 | grep -oE '"error":"[^"]+"' | cut -d'"' -f4 || echo "Unknown error")
    echo -e "${YELLOW}⚠️  Models endpoint: $ERROR_MSG${NC}"
fi

# Checkpoint TE endpoint
if curl -s -f "${BASE_URL}/api/te/config" > /dev/null 2>&1; then
    TE_CONFIGURED=$(curl -s "${BASE_URL}/api/te/config" | grep -oE '"configured":(true|false)' | grep -oE '(true|false)' || echo "unknown")
    echo -e "${GREEN}✅ Checkpoint TE endpoint: OK${NC}"
    echo "   Configured: $TE_CONFIGURED"
else
    echo -e "${RED}❌ Checkpoint TE endpoint: FAILED${NC}"
fi

# Check pages
echo ""
echo -e "${BLUE}4. Pages:${NC}"

# Home page
if curl -s -f "${BASE_URL}/" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Home page: OK${NC}"
else
    echo -e "${RED}❌ Home page: FAILED${NC}"
fi

# Release Notes page
if curl -s -f "${BASE_URL}/release-notes" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Release Notes page: OK${NC}"
else
    echo -e "${RED}❌ Release Notes page: FAILED${NC}"
fi

# Settings page
if curl -s -f "${BASE_URL}/settings" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Settings page: OK${NC}"
else
    echo -e "${RED}❌ Settings page: FAILED${NC}"
fi

# Check critical files
echo ""
echo -e "${BLUE}5. Critical Files:${NC}"

REPO_DIR="${REPO_DIR:-/home/adminuser/secure-ai-chat}"
cd "$REPO_DIR" 2>/dev/null || { echo -e "${RED}❌ Repository directory not found${NC}"; exit 1; }

FILES=(
    "app/release-notes/page.tsx"
    "components/ModelSelector.tsx"
    "components/SettingsForm.tsx"
    "app/api/chat/route.ts"
    "app/api/models/route.ts"
    "app/api/te/config/route.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $file"
    else
        echo -e "${RED}❌${NC} $file (missing)"
    fi
done

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Service: $(systemctl is-active secure-ai-chat 2>/dev/null || echo 'unknown')"
echo "Version: $(curl -s "${BASE_URL}/api/version" 2>/dev/null | grep -oE '"version":"[^"]+"' | cut -d'"' -f4 || echo 'unknown')"
echo ""
echo -e "${GREEN}✅ All critical checks completed${NC}"
