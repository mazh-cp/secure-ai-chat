#!/bin/bash
# Release Gate Script - Pre-deployment validation
# Ensures code correctness, security, stability, and backwards compatibility
# Exit codes: 0 = PASS, 1 = FAIL

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FAILED=0

# Print header
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           RELEASE GATE - PRE-DEPLOYMENT VALIDATION           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Detect package manager from lockfiles
PACKAGE_MANAGER="npm"
if [ -f "package-lock.json" ]; then
    PACKAGE_MANAGER="npm"
elif [ -f "yarn.lock" ]; then
    PACKAGE_MANAGER="yarn"
elif [ -f "pnpm-lock.yaml" ]; then
    PACKAGE_MANAGER="pnpm"
fi

echo -e "${BLUE}📦 Package Manager: ${PACKAGE_MANAGER}${NC}"
echo ""

# Function to run check and track failures
run_check() {
    local name="$1"
    local command="$2"
    
    echo -e "${YELLOW}⏳ Running: ${name}...${NC}"
    if eval "$command" > /tmp/release-gate-${name// /-}.log 2>&1; then
        echo -e "${GREEN}✅ PASS: ${name}${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL: ${name}${NC}"
        echo -e "${RED}   See log: /tmp/release-gate-${name// /-}.log${NC}"
        cat /tmp/release-gate-${name// /-}.log | tail -10
        FAILED=1
        return 1
    fi
}

# 1. Clean Install
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1. CLEAN INSTALL${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$PACKAGE_MANAGER" = "npm" ]; then
    run_check "Clean Install" "rm -rf node_modules package-lock.json .next && npm install"
elif [ "$PACKAGE_MANAGER" = "yarn" ]; then
    run_check "Clean Install" "rm -rf node_modules yarn.lock .next && yarn install"
elif [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    run_check "Clean Install" "rm -rf node_modules pnpm-lock.yaml .next && pnpm install"
fi
echo ""

# 2. Type Check
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2. TYPE CHECK${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$PACKAGE_MANAGER" = "npm" ]; then
    run_check "TypeScript Type Check" "npm run type-check"
elif [ "$PACKAGE_MANAGER" = "yarn" ]; then
    run_check "TypeScript Type Check" "yarn type-check"
elif [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    run_check "TypeScript Type Check" "pnpm type-check"
fi
echo ""

# 3. Lint
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3. LINT${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$PACKAGE_MANAGER" = "npm" ]; then
    run_check "ESLint" "npm run lint"
elif [ "$PACKAGE_MANAGER" = "yarn" ]; then
    run_check "ESLint" "yarn lint"
elif [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    run_check "ESLint" "pnpm lint"
fi
echo ""

# 4. Security: API Key Leakage Check (Comprehensive)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}4. SECURITY: COMPREHENSIVE API KEY LEAKAGE CHECK${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

run_check "Security Audit: No API Keys in Client Components" "bash scripts/check-security.sh"
echo ""

# 5. Security: Build Output Check
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}5. SECURITY: BUILD OUTPUT CHECK${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# First build, then check
if [ "$PACKAGE_MANAGER" = "npm" ]; then
    if npm run build > /tmp/release-gate-build.log 2>&1; then
        echo -e "${GREEN}✅ PASS: Build successful${NC}"
        
        # Check for API keys in build output (look for actual key patterns, not variable/function names)
        # Check for actual API key patterns: TE_API_KEY_ followed by a long string (40+ chars), or CHECKPOINT_TE_API_KEY env var pattern
        if grep -r "TE_API_KEY_[A-Za-z0-9]\{40,\}\|CHECKPOINT_TE_API_KEY=[A-Za-z0-9]\{40,\}" .next/static 2>/dev/null | grep -v ".map"; then
            echo -e "${RED}❌ FAIL: Actual API keys found in build output!${NC}"
            grep -r "TE_API_KEY_[A-Za-z0-9]\{40,\}\|CHECKPOINT_TE_API_KEY=[A-Za-z0-9]\{40,\}" .next/static 2>/dev/null | grep -v ".map" | head -5
            FAILED=1
        else
            echo -e "${GREEN}✅ PASS: No actual API keys in build output (variable/function names are safe)${NC}"
        fi
    else
        echo -e "${RED}❌ FAIL: Build failed${NC}"
        cat /tmp/release-gate-build.log | tail -20
        FAILED=1
    fi
elif [ "$PACKAGE_MANAGER" = "yarn" ]; then
    if yarn build > /tmp/release-gate-build.log 2>&1; then
        echo -e "${GREEN}✅ PASS: Build successful${NC}"
        
        if grep -r "TE_API_KEY\|CHECKPOINT_TE_API_KEY\|getTeApiKey\|setTeApiKey" .next/static 2>/dev/null | grep -v ".map" | grep -v "checkpointTeConfigured\|checkpointTeSandboxEnabled"; then
            echo -e "${RED}❌ FAIL: API keys found in build output!${NC}"
            grep -r "TE_API_KEY\|CHECKPOINT_TE_API_KEY\|getTeApiKey\|setTeApiKey" .next/static 2>/dev/null | grep -v ".map" | head -5
            FAILED=1
        else
            echo -e "${GREEN}✅ PASS: No API keys in build output${NC}"
        fi
    else
        echo -e "${RED}❌ FAIL: Build failed${NC}"
        cat /tmp/release-gate-build.log | tail -20
        FAILED=1
    fi
elif [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    if pnpm build > /tmp/release-gate-build.log 2>&1; then
        echo -e "${GREEN}✅ PASS: Build successful${NC}"
        
        if grep -r "TE_API_KEY\|CHECKPOINT_TE_API_KEY\|getTeApiKey\|setTeApiKey" .next/static 2>/dev/null | grep -v ".map" | grep -v "checkpointTeConfigured\|checkpointTeSandboxEnabled"; then
            echo -e "${RED}❌ FAIL: API keys found in build output!${NC}"
            grep -r "TE_API_KEY\|CHECKPOINT_TE_API_KEY\|getTeApiKey\|setTeApiKey" .next/static 2>/dev/null | grep -v ".map" | head -5
            FAILED=1
        else
            echo -e "${GREEN}✅ PASS: No API keys in build output${NC}"
        fi
    else
        echo -e "${RED}❌ FAIL: Build failed${NC}"
        cat /tmp/release-gate-build.log | tail -20
        FAILED=1
    fi
fi
echo ""

# 6. Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}RELEASE GATE SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    ✅ RELEASE GATE: PASS                      ║${NC}"
    echo -e "${GREEN}║                                                               ║${NC}"
    echo -e "${GREEN}║  All checks passed. Ready for deployment.                    ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                    ❌ RELEASE GATE: FAIL                      ║${NC}"
    echo -e "${RED}║                                                               ║${NC}"
    echo -e "${RED}║  One or more checks failed. Do not deploy.                   ║${NC}"
    echo -e "${RED}║  Review the errors above and fix before proceeding.          ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    exit 1
fi
