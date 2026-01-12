#!/bin/bash
# Key Security Verification Script
# This script verifies that API keys are properly secured and not committed to git

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 API Key Security Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Check 1: Verify .secure-storage/ is in .gitignore
echo "1. Checking .gitignore..."
if grep -q "^\.secure-storage/" .gitignore 2>/dev/null || grep -q "^\.secure-storage$" .gitignore 2>/dev/null; then
    echo -e "   ${GREEN}✅${NC} .secure-storage/ is in .gitignore"
else
    echo -e "   ${RED}❌${NC} .secure-storage/ NOT found in .gitignore"
    ERRORS=$((ERRORS + 1))
fi

# Check 2: Verify .secure-storage/ is not tracked in git
if [ -d ".git" ]; then
    echo ""
    echo "2. Checking git repository..."
    if git ls-files | grep -q "\.secure-storage"; then
        echo -e "   ${RED}❌${NC} .secure-storage/ files are tracked in git!"
        echo "   Files found:"
        git ls-files | grep "\.secure-storage" | sed 's/^/      - /'
        ERRORS=$((ERRORS + 1))
    else
        echo -e "   ${GREEN}✅${NC} No .secure-storage/ files in git"
    fi
else
    echo ""
    echo "2. Git repository check..."
    echo -e "   ${YELLOW}ℹ️${NC} Not a git repository (skipping git checks)"
fi

# Check 3: Verify .env files are in .gitignore
echo ""
echo "3. Checking .env files in .gitignore..."
if grep -q "^\.env" .gitignore 2>/dev/null; then
    echo -e "   ${GREEN}✅${NC} .env files are in .gitignore"
else
    echo -e "   ${YELLOW}⚠️${NC} .env files not explicitly in .gitignore"
    WARNINGS=$((WARNINGS + 1))
fi

# Check 4: Search for hardcoded API keys in source code
echo ""
echo "4. Scanning for hardcoded API keys..."
HARDCODED_KEYS=$(grep -r -i -E "sk-[a-zA-Z0-9]{32,}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v ".git" || true)
if [ -n "$HARDCODED_KEYS" ]; then
    echo -e "   ${RED}❌${NC} Potential hardcoded API keys found:"
    echo "$HARDCODED_KEYS" | sed 's/^/      /'
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}✅${NC} No hardcoded API keys found in source code"
fi

# Check 5: Verify .secure-storage/ directory permissions
echo ""
echo "5. Checking .secure-storage/ directory permissions..."
if [ -d ".secure-storage" ]; then
    PERMS=$(stat -f "%OLp" .secure-storage 2>/dev/null || stat -c "%a" .secure-storage 2>/dev/null || echo "unknown")
    if [ "$PERMS" = "700" ] || [ "$PERMS" = "0700" ]; then
        echo -e "   ${GREEN}✅${NC} .secure-storage/ has correct permissions (700)"
    else
        echo -e "   ${YELLOW}⚠️${NC} .secure-storage/ permissions: $PERMS (expected: 700)"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    # Check file permissions
    ENC_FILES=$(find .secure-storage -type f -name "*.enc" 2>/dev/null || true)
    if [ -n "$ENC_FILES" ]; then
        for file in $ENC_FILES; do
            FILE_PERMS=$(stat -f "%OLp" "$file" 2>/dev/null || stat -c "%a" "$file" 2>/dev/null || echo "unknown")
            if [ "$FILE_PERMS" = "600" ] || [ "$FILE_PERMS" = "0600" ]; then
                echo -e "   ${GREEN}✅${NC} $(basename $file) has correct permissions (600)"
            else
                echo -e "   ${YELLOW}⚠️${NC} $(basename $file) permissions: $FILE_PERMS (expected: 600)"
                WARNINGS=$((WARNINGS + 1))
            fi
        done
    fi
else
    echo -e "   ${YELLOW}ℹ️${NC} .secure-storage/ directory doesn't exist yet (will be created on first key save)"
fi

# Check 6: Verify storage persistence mechanism
echo ""
echo "6. Verifying key storage persistence..."
if [ -f "lib/checkpoint-te.ts" ] && [ -f "lib/api-keys-storage.ts" ]; then
    if grep -q "fs.writeFile" lib/checkpoint-te.ts && grep -q "fs.writeFile" lib/api-keys-storage.ts; then
        echo -e "   ${GREEN}✅${NC} Key storage uses file system persistence"
    else
        echo -e "   ${YELLOW}⚠️${NC} Key storage mechanism may not persist to disk"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "   ${RED}❌${NC} Key storage files not found"
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All security checks passed!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Security checks passed with $WARNINGS warning(s)${NC}"
    exit 0
else
    echo -e "${RED}❌ Security check failed with $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    exit 1
fi
