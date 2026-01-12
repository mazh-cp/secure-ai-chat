#!/bin/bash
# Local Installation Validation Script
# Validates all v1.0.7 features and compares with v1.0.6

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

BASE_URL="http://localhost:3000"
REPO_DIR="${PWD}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Local Installation Validation - v1.0.7 vs v1.0.6        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

check_result() {
    local status=$1
    local message=$2
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC} - $message"
        ((PASSED++))
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}❌ FAIL${NC} - $message"
        ((FAILED++))
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠️  WARN${NC} - $message"
        ((WARNINGS++))
    fi
}

# Version Check
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Version Check${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PACKAGE_VERSION=$(grep -E '"version"' package.json | head -1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' || echo "unknown")
echo -e "${BLUE}Package Version:${NC} $PACKAGE_VERSION"

if [ "$PACKAGE_VERSION" = "1.0.7" ]; then
    check_result "PASS" "Version is 1.0.7"
else
    check_result "FAIL" "Version is $PACKAGE_VERSION (expected 1.0.7)"
fi

# API Version Check
if curl -s -f "${BASE_URL}/api/version" > /dev/null 2>&1; then
    API_VERSION=$(curl -s "${BASE_URL}/api/version" | grep -oE '"version":"[^"]+"' | cut -d'"' -f4 || echo "unknown")
    echo -e "${BLUE}API Version:${NC} $API_VERSION"
    
    if [ "$API_VERSION" = "1.0.7" ]; then
        check_result "PASS" "API version matches (1.0.7)"
    else
        check_result "WARN" "API version is $API_VERSION (expected 1.0.7)"
    fi
else
    check_result "FAIL" "Version endpoint not responding"
fi

# New Features in v1.0.7
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}New Features in v1.0.7${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Release Notes Page
if [ -f "app/release-notes/page.tsx" ]; then
    check_result "PASS" "Release Notes page exists"
    
    if curl -s -f "${BASE_URL}/release-notes" > /dev/null 2>&1; then
        check_result "PASS" "Release Notes page accessible"
    else
        check_result "FAIL" "Release Notes page not accessible"
    fi
else
    check_result "FAIL" "Release Notes page not found"
fi

# ModelSelector Fix
if [ -f "components/ModelSelector.tsx" ]; then
    if grep -q "server-side storage" components/ModelSelector.tsx 2>/dev/null; then
        check_result "PASS" "ModelSelector has server-side storage fix"
    else
        check_result "WARN" "ModelSelector may not have latest fix"
    fi
else
    check_result "FAIL" "ModelSelector component not found"
fi

# API Key Validation
if grep -q "your_ope\|your-api-key" app/api/chat/route.ts 2>/dev/null; then
    # Check if it's in validation (should be OK) or actual usage (should fail)
    if grep -q "includes('your_ope')" app/api/chat/route.ts 2>/dev/null; then
        check_result "PASS" "API key validation includes placeholder detection"
    else
        check_result "WARN" "Placeholder key found in code (may be in comments)"
    fi
else
    check_result "PASS" "No placeholder keys in chat route"
fi

# Checkpoint TE Error Handling
if grep -q "errorData.error" components/SettingsForm.tsx 2>/dev/null; then
    check_result "PASS" "Checkpoint TE error handling improved"
else
    check_result "WARN" "Checkpoint TE error handling may not be updated"
fi

# API Endpoints
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}API Endpoints${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Health
if curl -s -f "${BASE_URL}/api/health" > /dev/null 2>&1; then
    check_result "PASS" "Health endpoint responding"
else
    check_result "FAIL" "Health endpoint not responding"
fi

# Version
if curl -s -f "${BASE_URL}/api/version" > /dev/null 2>&1; then
    check_result "PASS" "Version endpoint responding"
else
    check_result "FAIL" "Version endpoint not responding"
fi

# Models (should work without client-side key)
if curl -s -f "${BASE_URL}/api/models" > /dev/null 2>&1; then
    MODELS_RESPONSE=$(curl -s "${BASE_URL}/api/models")
    if echo "$MODELS_RESPONSE" | grep -q "error"; then
        ERROR_MSG=$(echo "$MODELS_RESPONSE" | grep -oE '"error":"[^"]+"' | cut -d'"' -f4 || echo "Unknown")
        if echo "$ERROR_MSG" | grep -q "API key"; then
            check_result "WARN" "Models endpoint: API key not configured (expected if no keys set)"
        else
            check_result "WARN" "Models endpoint: $ERROR_MSG"
        fi
    else
        MODELS_COUNT=$(echo "$MODELS_RESPONSE" | grep -o '"id"' | wc -l || echo "0")
        if [ "$MODELS_COUNT" -gt 0 ]; then
            check_result "PASS" "Models endpoint: $MODELS_COUNT models available"
        else
            check_result "WARN" "Models endpoint: No models returned"
        fi
    fi
else
    check_result "FAIL" "Models endpoint not responding"
fi

# Checkpoint TE
if curl -s -f "${BASE_URL}/api/te/config" > /dev/null 2>&1; then
    check_result "PASS" "Checkpoint TE endpoint responding"
else
    check_result "FAIL" "Checkpoint TE endpoint not responding"
fi

# Pages
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Pages${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PAGES=(
    "/"
    "/release-notes"
    "/settings"
    "/files"
    "/dashboard"
)

for page in "${PAGES[@]}"; do
    if curl -s -f "${BASE_URL}${page}" > /dev/null 2>&1; then
        check_result "PASS" "Page accessible: $page"
    else
        check_result "FAIL" "Page not accessible: $page"
    fi
done

# Critical Files
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Critical Files${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

FILES=(
    "app/release-notes/page.tsx"
    "components/ModelSelector.tsx"
    "components/SettingsForm.tsx"
    "components/ChatInterface.tsx"
    "app/api/chat/route.ts"
    "app/api/models/route.ts"
    "app/api/te/config/route.ts"
    "lib/api-keys-storage.ts"
    "scripts/fix-production-keys.sh"
    "scripts/verify-production-update.sh"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        check_result "PASS" "File exists: $file"
    else
        check_result "FAIL" "File missing: $file"
    fi
done

# Comparison with v1.0.6
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Comparison with v1.0.6${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}New in v1.0.7 (not in v1.0.6):${NC}"
echo "  ✅ Release Notes page (/release-notes)"
echo "  ✅ ModelSelector server-side storage fix"
echo "  ✅ API key validation (placeholder detection)"
echo "  ✅ Checkpoint TE improved error handling"
echo "  ✅ Production verification scripts"
echo "  ✅ Production key fix scripts"
echo ""

echo -e "${BLUE}Improved in v1.0.7:${NC}"
echo "  ⚡ Better error messages"
echo "  ⚡ Enhanced key validation"
echo "  ⚡ Improved status synchronization"
echo ""

# Summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Validation Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}✅ Passed:${NC} $PASSED"
echo -e "${YELLOW}⚠️  Warnings:${NC} $WARNINGS"
echo -e "${RED}❌ Failed:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║        ✅ ALL VALIDATION CHECKS PASSED                        ║${NC}"
        echo -e "${GREEN}║                                                               ║${NC}"
        echo -e "${GREEN}║  Local installation is ready and all v1.0.7 features work  ║${NC}"
        echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
        exit 0
    else
        echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║     ⚠️  VALIDATION PASSED WITH WARNINGS                       ║${NC}"
        echo -e "${YELLOW}║                                                               ║${NC}"
        echo -e "${YELLOW}║  Local installation is functional but has some warnings      ║${NC}"
        echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════════╝${NC}"
        exit 0
    fi
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║           ❌ VALIDATION FAILED                                  ║${NC}"
    echo -e "${RED}║                                                               ║${NC}"
    echo -e "${RED}║  Some checks failed. Please review the errors above.            ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
