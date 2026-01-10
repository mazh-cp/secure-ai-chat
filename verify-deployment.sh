#!/bin/bash
# Deployment Verification Script for Secure AI Chat v1.0.1
# Run this on the Ubuntu VM after deployment to verify everything works

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SERVICE_NAME="secure-ai-chat"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Secure AI Chat v1.0.1 - Deployment Verification       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Service Status
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1. SERVICE STATUS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}✅ Service is active${NC}"
    sudo systemctl status ${SERVICE_NAME} --no-pager -l | head -15
else
    echo -e "${RED}❌ Service is not active${NC}"
    sudo systemctl status ${SERVICE_NAME} --no-pager -l | head -15
    exit 1
fi
echo ""

# 2. Health Check
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2. HEALTH CHECK${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

HEALTH_RESPONSE=$(curl -s http://localhost:3000/api/health || echo "ERROR")
if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✅ Health endpoint responding${NC}"
    echo "$HEALTH_RESPONSE" | jq . 2>/dev/null || echo "$HEALTH_RESPONSE"
else
    echo -e "${RED}❌ Health endpoint not responding${NC}"
    echo "$HEALTH_RESPONSE"
    exit 1
fi
echo ""

# 3. Check Point TE Configuration
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3. CHECK POINT TE CONFIGURATION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

TE_CONFIG=$(curl -s http://localhost:3000/api/te/config || echo "ERROR")
if echo "$TE_CONFIG" | grep -q "configured"; then
    CONFIGURED=$(echo "$TE_CONFIG" | jq -r '.configured' 2>/dev/null || echo "unknown")
    if [ "$CONFIGURED" = "true" ]; then
        echo -e "${GREEN}✅ Check Point TE API key is configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Check Point TE API key is not configured (can be set via Settings UI)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Could not check Check Point TE configuration${NC}"
fi
echo ""

# 4. PIN Configuration
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}4. PIN CONFIGURATION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PIN_CONFIG=$(curl -s http://localhost:3000/api/pin || echo "ERROR")
if echo "$PIN_CONFIG" | grep -q "configured"; then
    CONFIGURED=$(echo "$PIN_CONFIG" | jq -r '.configured' 2>/dev/null || echo "unknown")
    if [ "$CONFIGURED" = "true" ]; then
        echo -e "${GREEN}✅ PIN is configured${NC}"
    else
        echo -e "${YELLOW}⚠️  PIN is not configured (optional, can be set via Settings UI)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Could not check PIN configuration${NC}"
fi
echo ""

# 5. Service Logs (Last 200 lines)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}5. SERVICE LOGS (Last 200 lines)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

sudo journalctl -u ${SERVICE_NAME} -n 200 --no-pager | tail -50
echo ""

# 6. Restart Safety Test
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}6. RESTART SAFETY TEST${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Testing service restart..."
sudo systemctl restart ${SERVICE_NAME}
sleep 5

if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}✅ Service restarted successfully${NC}"
else
    echo -e "${RED}❌ Service failed to restart${NC}"
    exit 1
fi
echo ""

# 7. Git Commit Hash
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}7. GIT COMMIT HASH${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -d "/opt/secure-ai-chat" ]; then
    cd /opt/secure-ai-chat
    COMMIT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    COMMIT_MSG=$(git log --oneline -1 2>/dev/null || echo "unknown")
    BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    echo "Branch: ${BRANCH}"
    echo "Commit: ${COMMIT_HASH}"
    echo "Message: ${COMMIT_MSG}"
else
    echo -e "${YELLOW}⚠️  Repository directory not found${NC}"
fi
echo ""

# 8. Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}DEPLOYMENT VERIFICATION SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              ✅ DEPLOYMENT VERIFICATION COMPLETE              ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Application is running and ready for use                     ║${NC}"
echo -e "${GREEN}║  Service: ${SERVICE_NAME}                                      ║${NC}"
echo -e "${GREEN}║  Version: 1.0.1                                               ║${NC}"
echo -e "${GREEN}║  URL: http://localhost:3000                                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
