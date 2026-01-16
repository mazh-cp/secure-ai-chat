#!/bin/bash
# Diagnostic script for OpenAI/Azure OpenAI errors
# Helps identify configuration issues

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     OpenAI/Azure OpenAI Error Diagnostic Tool               ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check server is running
echo -e "${CYAN}Step 1: Checking if server is running...${NC}"
if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${RED}❌ Server is not running. Please start it with: npm run dev${NC}"
    exit 1
fi
echo ""

# Step 2: Check API keys configuration
echo -e "${CYAN}Step 2: Checking API keys configuration...${NC}"
KEYS_RESPONSE=$(curl -sf http://localhost:3000/api/keys/retrieve 2>/dev/null || echo "{}")
echo "$KEYS_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    configured = data.get('configured', {})
    keys = data.get('keys', {})
    
    print('OpenAI Key:', '✅ Configured' if configured.get('openAiKey') else '❌ Not configured')
    if configured.get('openAiKey'):
        key_val = keys.get('openAiKey', '')
        if key_val and key_val != 'configured':
            print(f'  Format: {\"✅ Valid (starts with sk-)\" if key_val.startswith(\"sk-\") else \"⚠️  Invalid format (should start with sk-)\"}')
    
    print('Azure OpenAI Key:', '✅ Configured' if configured.get('azureOpenAiKey') else '❌ Not configured')
    if configured.get('azureOpenAiKey'):
        key_val = keys.get('azureOpenAiKey', '')
        if key_val and key_val != 'configured':
            print(f'  Length: {len(key_val)} characters')
    
    print('Azure OpenAI Endpoint:', '✅ Configured' if configured.get('azureOpenAiEndpoint') else '❌ Not configured')
    if configured.get('azureOpenAiEndpoint'):
        endpoint = keys.get('azureOpenAiEndpoint', '')
        if endpoint and endpoint != 'configured':
            print(f'  Endpoint: {endpoint}')
            if 'azure-api.net' in endpoint:
                print('  Type: ✅ APIM Gateway endpoint')
            elif 'openai.azure.com' in endpoint:
                print('  Type: ✅ Standard Azure OpenAI endpoint')
            else:
                print('  Type: ⚠️  Unknown endpoint format')
            if not endpoint.startswith('http'):
                print('  ⚠️  Warning: Endpoint should start with http:// or https://')
except Exception as e:
    print(f'Error parsing keys: {e}')
"
echo ""

# Step 3: Test OpenAI health endpoint
echo -e "${CYAN}Step 3: Testing OpenAI health endpoint...${NC}"
OPENAI_HEALTH=$(curl -sf -X POST http://localhost:3000/api/health/openai \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null || echo '{"ok":false,"error":"Request failed"}')

if echo "$OPENAI_HEALTH" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if data.get('ok') else 1)" 2>/dev/null; then
    echo -e "${GREEN}✅ OpenAI health check: PASSED${NC}"
else
    ERROR_MSG=$(echo "$OPENAI_HEALTH" | python3 -c "import sys, json; print(json.load(sys.stdin).get('error', 'Unknown error'))" 2>/dev/null || echo "Unknown error")
    echo -e "${RED}❌ OpenAI health check: FAILED${NC}"
    echo -e "   Error: ${ERROR_MSG}"
fi
echo ""

# Step 4: Test Azure OpenAI validation endpoint
echo -e "${CYAN}Step 4: Testing Azure OpenAI validation endpoint...${NC}"
AZURE_ENDPOINT=$(echo "$KEYS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('keys', {}).get('azureOpenAiEndpoint', ''))" 2>/dev/null || echo "")
AZURE_KEY=$(echo "$KEYS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('keys', {}).get('azureOpenAiKey', ''))" 2>/dev/null || echo "")

if [ -n "$AZURE_ENDPOINT" ] && [ "$AZURE_ENDPOINT" != "configured" ] && [ -n "$AZURE_KEY" ] && [ "$AZURE_KEY" != "configured" ]; then
    AZURE_VALIDATION=$(curl -sf -X POST http://localhost:3000/api/health/azure-openai \
        -H "Content-Type: application/json" \
        -d "{\"apiKey\":\"${AZURE_KEY}\",\"endpoint\":\"${AZURE_ENDPOINT}\"}" 2>/dev/null || echo '{"ok":false,"error":"Request failed"}')
    
    if echo "$AZURE_VALIDATION" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if data.get('ok') else 1)" 2>/dev/null; then
        echo -e "${GREEN}✅ Azure OpenAI validation: PASSED${NC}"
    else
        ERROR_MSG=$(echo "$AZURE_VALIDATION" | python3 -c "import sys, json; print(json.load(sys.stdin).get('error', 'Unknown error'))" 2>/dev/null || echo "Unknown error")
        echo -e "${RED}❌ Azure OpenAI validation: FAILED${NC}"
        echo -e "   Error: ${ERROR_MSG}"
        echo ""
        echo -e "${YELLOW}Common Azure OpenAI issues:${NC}"
        echo "   1. Deployment name doesn't match model name (case-sensitive)"
        echo "   2. Deployment not in 'Succeeded' state in Azure Portal"
        echo "   3. Endpoint URL format incorrect"
        echo "   4. API key invalid or expired"
        echo "   5. Region/capacity issues"
    fi
else
    echo -e "${YELLOW}⚠️  Azure OpenAI credentials not fully configured${NC}"
fi
echo ""

# Step 5: Check server logs for recent errors
echo -e "${CYAN}Step 5: Checking for recent errors in system logs...${NC}"
if [ -f ".secure-storage/system-logs.json" ]; then
    RECENT_ERRORS=$(python3 << 'PYTHON'
import json
import sys
from datetime import datetime, timedelta

try:
    with open('.secure-storage/system-logs.json', 'r') as f:
        logs = json.load(f)
    
    # Get errors from last hour
    one_hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
    recent_errors = [
        log for log in logs 
        if log.get('level') in ['error', 'warning'] and log.get('timestamp', '') > one_hour_ago
    ]
    
    if recent_errors:
        print(f"Found {len(recent_errors)} recent errors/warnings:")
        for log in recent_errors[:5]:  # Show last 5
            print(f"  [{log.get('level', 'unknown').upper()}] {log.get('service', 'unknown')}: {log.get('message', '')}")
            if log.get('details', {}).get('error'):
                print(f"    Error: {log.get('details', {}).get('error', '')}")
    else:
        print("✅ No recent errors found in system logs")
except Exception as e:
    print(f"Could not read system logs: {e}")
PYTHON
)
    echo "$RECENT_ERRORS"
else
    echo -e "${YELLOW}⚠️  System logs file not found${NC}"
fi
echo ""

# Step 6: Test a simple chat request
echo -e "${CYAN}Step 6: Testing a simple chat request...${NC}"
CHAT_TEST=$(curl -sf -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d '{
        "messages": [{"role": "user", "content": "Hello"}],
        "model": "gpt-4o-mini",
        "provider": "openai"
    }' 2>/dev/null || echo '{"error":"Request failed"}')

if echo "$CHAT_TEST" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(1 if 'error' in data else 0)" 2>/dev/null; then
    ERROR_MSG=$(echo "$CHAT_TEST" | python3 -c "import sys, json; print(json.load(sys.stdin).get('error', 'Unknown error'))" 2>/dev/null || echo "Unknown error")
    echo -e "${RED}❌ Chat request failed${NC}"
    echo -e "   Error: ${ERROR_MSG}"
    echo ""
    echo -e "${YELLOW}Troubleshooting steps:${NC}"
    echo "   1. Verify API key is valid and has credits"
    echo "   2. Check network connectivity"
    echo "   3. Verify model name is correct"
    echo "   4. Check if rate limits are exceeded"
else
    echo -e "${GREEN}✅ Chat request: SUCCESS${NC}"
fi
echo ""

# Summary
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Diagnostic Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the errors above"
echo "  2. Check Settings page: http://localhost:3000/settings"
echo "  3. Verify API keys are correct"
echo "  4. For Azure OpenAI: Check deployment name matches model name"
echo "  5. Check browser console (F12) for client-side errors"
echo "  6. Check server logs for detailed error messages"
echo ""
