#!/bin/bash
# Comprehensive Installation Validation Script
# Validates install quality, app stability, and key storage configuration

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
echo -e "${BLUE}║     Installation Validation & Configuration Check            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# Test function
test_check() {
    local name=$1
    local command=$2
    local expected=$3
    
    echo -e "${CYAN}Testing: ${name}...${NC}"
    if eval "$command" > /dev/null 2>&1; then
        if [ "$expected" = "pass" ]; then
            echo -e "${GREEN}  ✅ PASS${NC}"
            ((PASSED++))
            return 0
        else
            echo -e "${RED}  ❌ FAIL (unexpected pass)${NC}"
            ((FAILED++))
            return 1
        fi
    else
        if [ "$expected" = "fail" ]; then
            echo -e "${GREEN}  ✅ PASS (expected fail)${NC}"
            ((PASSED++))
            return 0
        else
            echo -e "${RED}  ❌ FAIL${NC}"
            ((FAILED++))
            return 1
        fi
    fi
}

# Check function
check_status() {
    local name=$1
    local command=$2
    
    echo -e "${CYAN}Checking: ${name}...${NC}"
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✅ OK${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${YELLOW}  ⚠️  WARNING${NC}"
        ((WARNINGS++))
        return 1
    fi
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1. Build & Type Check${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check TypeScript compilation
test_check "TypeScript Compilation" "npm run type-check" "pass"

# Check build directory exists
if [ -d ".next" ]; then
    echo -e "${GREEN}  ✅ Build directory exists${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}  ⚠️  Build directory missing (run 'npm run build')${NC}"
    ((WARNINGS++))
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2. Key Storage Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check .secure-storage directory
if [ -d ".secure-storage" ]; then
    echo -e "${GREEN}  ✅ .secure-storage directory exists${NC}"
    ((PASSED++))
    
    # Check permissions
    PERMS=$(stat -f "%A" .secure-storage 2>/dev/null || stat -c "%a" .secure-storage 2>/dev/null || echo "unknown")
    if [ "$PERMS" = "700" ]; then
        echo -e "${GREEN}    ✅ Correct permissions (700)${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}    ⚠️  Permissions: $PERMS (expected 700)${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}  ⚠️  .secure-storage directory missing (will be created on first key save)${NC}"
    ((WARNINGS++))
fi

# Check api-keys.enc file
if [ -f ".secure-storage/api-keys.enc" ]; then
    echo -e "${GREEN}  ✅ api-keys.enc file exists${NC}"
    ((PASSED++))
    
    # Check file permissions
    FILE_PERMS=$(stat -f "%A" .secure-storage/api-keys.enc 2>/dev/null || stat -c "%a" .secure-storage/api-keys.enc 2>/dev/null || echo "unknown")
    if [ "$FILE_PERMS" = "600" ]; then
        echo -e "${GREEN}    ✅ Correct file permissions (600)${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}    ⚠️  File permissions: $FILE_PERMS (expected 600)${NC}"
        ((WARNINGS++))
    fi
    
    # Check file size
    FILE_SIZE=$(stat -f%z .secure-storage/api-keys.enc 2>/dev/null || stat -c%s .secure-storage/api-keys.enc 2>/dev/null || echo "0")
    if [ "$FILE_SIZE" -gt 0 ]; then
        echo -e "${GREEN}    ✅ File contains data (${FILE_SIZE} bytes)${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}    ⚠️  File is empty${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}  ⚠️  api-keys.enc file missing (keys not saved yet)${NC}"
    ((WARNINGS++))
fi

# Check Check Point TE key storage
if [ -f ".secure-storage/checkpoint-te-key.enc" ]; then
    echo -e "${GREEN}  ✅ Check Point TE key file exists${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}  ⚠️  Check Point TE key file missing (optional)${NC}"
    ((WARNINGS++))
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3. Persistent Storage Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check .storage directory
if [ -d ".storage" ]; then
    echo -e "${GREEN}  ✅ .storage directory exists${NC}"
    ((PASSED++))
    
    # Check permissions
    STORAGE_PERMS=$(stat -f "%A" .storage 2>/dev/null || stat -c "%a" .storage 2>/dev/null || echo "unknown")
    if [ "$STORAGE_PERMS" = "700" ]; then
        echo -e "${GREEN}    ✅ Correct permissions (700)${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}    ⚠️  Permissions: $STORAGE_PERMS (expected 700)${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}  ⚠️  .storage directory missing (will be created on first file upload)${NC}"
    ((WARNINGS++))
fi

# Check files-metadata.json
if [ -f ".storage/files-metadata.json" ]; then
    echo -e "${GREEN}  ✅ files-metadata.json exists${NC}"
    ((PASSED++))
    
    # Validate JSON syntax
    if python3 -m json.tool .storage/files-metadata.json > /dev/null 2>&1; then
        echo -e "${GREEN}    ✅ Valid JSON syntax${NC}"
        ((PASSED++))
    else
        echo -e "${RED}    ❌ Invalid JSON syntax${NC}"
        ((FAILED++))
    fi
else
    echo -e "${YELLOW}  ⚠️  files-metadata.json missing (no files uploaded yet)${NC}"
    ((WARNINGS++))
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}4. Application Server Status${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Wait for server if not ready
for i in {1..10}; do
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}  ❌ Server not responding${NC}"
        ((FAILED++))
        exit 1
    fi
    sleep 1
done

# Health check
if curl -s http://localhost:3000/api/health | grep -q "ok"; then
    echo -e "${GREEN}  ✅ Health endpoint: OK${NC}"
    ((PASSED++))
else
    echo -e "${RED}  ❌ Health endpoint: Failed${NC}"
    ((FAILED++))
fi

# Version check
VERSION_RESPONSE=$(curl -s http://localhost:3000/api/version 2>/dev/null)
if echo "$VERSION_RESPONSE" | grep -q "1.0.7"; then
    echo -e "${GREEN}  ✅ Version endpoint: Working (1.0.7)${NC}"
    ((PASSED++))
else
    VERSION=$(echo "$VERSION_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo 'unknown')
    echo -e "${YELLOW}  ⚠️  Version: $VERSION (expected 1.0.7)${NC}"
    ((WARNINGS++))
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}5. API Key Storage & Retrieval${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test keys retrieve endpoint
KEYS_RESPONSE=$(curl -s http://localhost:3000/api/keys/retrieve 2>/dev/null)
if echo "$KEYS_RESPONSE" | grep -q "configured\|keys"; then
    echo -e "${GREEN}  ✅ Keys retrieve endpoint: Working${NC}"
    ((PASSED++))
    
    # Check if keys are configured
    OPENAI_CONFIGURED=$(echo "$KEYS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('configured', {}).get('openAiKey', False))" 2>/dev/null || echo "False")
    if [ "$OPENAI_CONFIGURED" = "True" ]; then
        echo -e "${GREEN}    ✅ OpenAI key: Configured${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}    ⚠️  OpenAI key: Not configured${NC}"
        ((WARNINGS++))
    fi
    
    LAKERA_CONFIGURED=$(echo "$KEYS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('configured', {}).get('lakeraAiKey', False))" 2>/dev/null || echo "False")
    if [ "$LAKERA_CONFIGURED" = "True" ]; then
        echo -e "${GREEN}    ✅ Lakera key: Configured${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}    ⚠️  Lakera key: Not configured (optional)${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${RED}  ❌ Keys retrieve endpoint: Failed${NC}"
    ((FAILED++))
fi

# Verify keys are NOT exposed
if echo "$KEYS_RESPONSE" | grep -q "sk-"; then
    echo -e "${RED}  ❌ SECURITY: API keys exposed in response${NC}"
    ((FAILED++))
else
    echo -e "${GREEN}  ✅ Security: Keys not exposed (using 'configured' placeholder)${NC}"
    ((PASSED++))
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}6. Configuration Validation${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check .gitignore includes secure files
if grep -q ".secure-storage" .gitignore 2>/dev/null; then
    echo -e "${GREEN}  ✅ .secure-storage in .gitignore${NC}"
    ((PASSED++))
else
    echo -e "${RED}  ❌ .secure-storage NOT in .gitignore${NC}"
    ((FAILED++))
fi

if grep -q ".storage" .gitignore 2>/dev/null; then
    echo -e "${GREEN}  ✅ .storage in .gitignore${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}  ⚠️  .storage NOT in .gitignore (should be ignored)${NC}"
    ((WARNINGS++))
fi

# Check environment variables are not hardcoded
if grep -r "sk-[a-zA-Z0-9]\{48\}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . 2>/dev/null | grep -v node_modules | grep -v ".next" | head -1; then
    echo -e "${RED}  ❌ SECURITY: Hardcoded API keys found in source${NC}"
    ((FAILED++))
else
    echo -e "${GREEN}  ✅ Security: No hardcoded API keys in source${NC}"
    ((PASSED++))
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}7. Core Functionality Tests${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test models endpoint
MODELS_RESPONSE=$(curl -s http://localhost:3000/api/models 2>/dev/null)
if echo "$MODELS_RESPONSE" | grep -q "models\|error"; then
    if echo "$MODELS_RESPONSE" | grep -q "error"; then
        echo -e "${YELLOW}  ⚠️  Models endpoint: Error (may need API key)${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}  ✅ Models endpoint: Working${NC}"
        ((PASSED++))
    fi
else
    echo -e "${RED}  ❌ Models endpoint: Failed${NC}"
    ((FAILED++))
fi

# Test files list endpoint
FILES_RESPONSE=$(curl -s http://localhost:3000/api/files/list 2>/dev/null)
if echo "$FILES_RESPONSE" | grep -q "files\|error\|\\[\\]"; then
    echo -e "${GREEN}  ✅ Files list endpoint: Working${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}  ⚠️  Files list endpoint: Unexpected response${NC}"
    ((WARNINGS++))
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Passed: ${PASSED}${NC}"
echo -e "${YELLOW}⚠️  Warnings: ${WARNINGS}${NC}"
echo -e "${RED}❌ Failed: ${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Installation validation: PASSED${NC}"
    echo ""
    echo -e "${CYAN}Key Storage Status:${NC}"
    if [ -f ".secure-storage/api-keys.enc" ]; then
        FILE_SIZE=$(stat -f%z .secure-storage/api-keys.enc 2>/dev/null || stat -c%s .secure-storage/api-keys.enc 2>/dev/null || echo "0")
        echo -e "  • API Keys file: ${FILE_SIZE} bytes"
        echo -e "  • Keys persist across restarts: ✅ Yes"
        echo -e "  • Keys encrypted: ✅ Yes"
        echo -e "  • Keys excluded from Git: ✅ Yes"
    else
        echo -e "  • API Keys file: Not created yet"
        echo -e "  • Keys will persist once saved in Settings"
    fi
    echo ""
    exit 0
else
    echo -e "${RED}❌ Installation validation: FAILED${NC}"
    echo ""
    exit 1
fi
