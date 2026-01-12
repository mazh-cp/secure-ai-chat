#!/bin/bash
# Production Update Verification Script
# Verifies that production server has all required updates for v1.0.7
#
# Usage:
#   bash scripts/verify-production-update.sh
#   Or with custom path:
#   REPO_DIR=/custom/path bash scripts/verify-production-update.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
REPO_DIR="${REPO_DIR:-/home/adminuser/secure-ai-chat}"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
TARGET_VERSION="1.0.7"
HEALTH_URL="http://localhost:3000/api/health"
VERSION_URL="http://localhost:3000/api/version"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Production Update Verification Script v${TARGET_VERSION}        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Repository:${NC} $REPO_DIR"
echo -e "${BLUE}Service:${NC} $SERVICE_NAME"
echo -e "${BLUE}Target Version:${NC} $TARGET_VERSION"
echo ""

# Track verification results
PASSED=0
FAILED=0
WARNINGS=0

# Function to print check result
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

# Check 1: Repository exists
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 1: Repository Check${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ ! -d "$REPO_DIR" ]; then
    check_result "FAIL" "Repository directory not found: $REPO_DIR"
    exit 1
else
    check_result "PASS" "Repository directory exists"
fi

cd "$REPO_DIR"

# Check 2: Git repository
if [ ! -d ".git" ]; then
    check_result "FAIL" "Not a git repository"
    exit 1
else
    check_result "PASS" "Git repository found"
fi

# Check 3: Current branch and commit
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
REMOTE_COMMIT=$(git ls-remote origin main 2>/dev/null | cut -f1 || echo "unknown")

echo ""
echo -e "${BLUE}Current Branch:${NC} $CURRENT_BRANCH"
echo -e "${BLUE}Current Commit:${NC} ${CURRENT_COMMIT:0:8}"
echo -e "${BLUE}Remote Commit:${NC} ${REMOTE_COMMIT:0:8}"

if [ "$CURRENT_COMMIT" = "$REMOTE_COMMIT" ] && [ "$CURRENT_COMMIT" != "unknown" ]; then
    check_result "PASS" "Repository is up to date with remote"
elif [ "$CURRENT_COMMIT" != "unknown" ] && [ "$REMOTE_COMMIT" != "unknown" ]; then
    check_result "WARN" "Repository may not be up to date (local: ${CURRENT_COMMIT:0:8}, remote: ${REMOTE_COMMIT:0:8})"
else
    check_result "WARN" "Could not verify commit status"
fi

# Check 4: Package version
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 2: Version Check${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "package.json" ]; then
    PACKAGE_VERSION=$(grep -E '"version"' package.json | head -1 | sed -E 's/.*"version":\s*"([^"]+)".*/\1/' || echo "unknown")
    echo -e "${BLUE}Package Version:${NC} $PACKAGE_VERSION"
    
    if [ "$PACKAGE_VERSION" = "$TARGET_VERSION" ]; then
        check_result "PASS" "Package version matches target ($TARGET_VERSION)"
    else
        check_result "WARN" "Package version ($PACKAGE_VERSION) doesn't match target ($TARGET_VERSION)"
    fi
else
    check_result "FAIL" "package.json not found"
fi

# Check 5: Service status
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 3: Service Status${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    check_result "PASS" "Service is running"
    
    # Check service status
    SERVICE_STATUS=$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo "unknown")
    echo -e "${BLUE}Service Status:${NC} $SERVICE_STATUS"
else
    check_result "FAIL" "Service is not running"
fi

# Check 6: Health endpoint
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 4: API Endpoints${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Health check
if curl -s -f "$HEALTH_URL" > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s "$HEALTH_URL" | head -1)
    check_result "PASS" "Health endpoint responding"
    echo -e "${BLUE}Health Response:${NC} $HEALTH_RESPONSE"
else
    check_result "FAIL" "Health endpoint not responding"
fi

# Version check
if curl -s -f "$VERSION_URL" > /dev/null 2>&1; then
    VERSION_RESPONSE=$(curl -s "$VERSION_URL")
    VERSION_API=$(echo "$VERSION_RESPONSE" | grep -oE '"version":"[^"]+"' | cut -d'"' -f4 || echo "unknown")
    check_result "PASS" "Version endpoint responding"
    echo -e "${BLUE}API Version:${NC} $VERSION_API"
    
    if [ "$VERSION_API" = "$TARGET_VERSION" ]; then
        check_result "PASS" "API version matches target ($TARGET_VERSION)"
    else
        check_result "WARN" "API version ($VERSION_API) doesn't match target ($TARGET_VERSION)"
    fi
else
    check_result "FAIL" "Version endpoint not responding"
fi

# Check 7: Key features - Release Notes page
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 5: Key Features${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check Release Notes page exists
if [ -f "app/release-notes/page.tsx" ]; then
    check_result "PASS" "Release Notes page exists"
else
    check_result "FAIL" "Release Notes page not found"
fi

# Check Release Notes endpoint
if curl -s -f "http://localhost:3000/release-notes" > /dev/null 2>&1; then
    check_result "PASS" "Release Notes page accessible"
else
    check_result "WARN" "Release Notes page not accessible (may need to check after service restart)"
fi

# Check ModelSelector component
if [ -f "components/ModelSelector.tsx" ]; then
    # Check if it has the fix (doesn't check apiKey prop)
    if grep -q "The /api/models endpoint gets the API key from server-side storage" components/ModelSelector.tsx 2>/dev/null; then
        check_result "PASS" "ModelSelector has server-side storage fix"
    else
        check_result "WARN" "ModelSelector may not have the latest fix"
    fi
else
    check_result "FAIL" "ModelSelector component not found"
fi

# Check 8: Build artifacts
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 6: Build Artifacts${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -d ".next" ]; then
    check_result "PASS" "Build directory exists"
    
    # Check if build is recent (within last 24 hours)
    BUILD_AGE=$(find .next -type f -name "*.js" -mtime -1 2>/dev/null | wc -l)
    if [ "$BUILD_AGE" -gt 0 ]; then
        check_result "PASS" "Build artifacts are recent"
    else
        check_result "WARN" "Build artifacts may be stale (older than 24 hours)"
    fi
else
    check_result "FAIL" "Build directory not found - application may not be built"
fi

# Check 9: Storage directories
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 7: Storage Directories${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check secure storage
if [ -d ".secure-storage" ]; then
    STORAGE_PERMS=$(stat -c "%a" .secure-storage 2>/dev/null || echo "unknown")
    check_result "PASS" "Secure storage directory exists (perms: $STORAGE_PERMS)"
    
    if [ "$STORAGE_PERMS" = "700" ] || [ "$STORAGE_PERMS" = "750" ]; then
        check_result "PASS" "Secure storage has correct permissions"
    else
        check_result "WARN" "Secure storage permissions may be incorrect (expected 700, got $STORAGE_PERMS)"
    fi
else
    check_result "WARN" "Secure storage directory not found (will be created on first use)"
fi

# Check file storage
if [ -d ".storage" ]; then
    check_result "PASS" "File storage directory exists"
else
    check_result "WARN" "File storage directory not found (will be created on first use)"
fi

# Check 10: Dependencies
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 8: Dependencies${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -d "node_modules" ]; then
    check_result "PASS" "Dependencies installed"
    
    # Check if package-lock.json matches node_modules
    if [ -f "package-lock.json" ]; then
        check_result "PASS" "package-lock.json exists"
    else
        check_result "WARN" "package-lock.json not found"
    fi
else
    check_result "FAIL" "Dependencies not installed"
fi

# Check 11: Critical files
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 9: Critical Files${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

CRITICAL_FILES=(
    "app/api/models/route.ts"
    "app/api/te/config/route.ts"
    "app/release-notes/page.tsx"
    "components/ModelSelector.tsx"
    "components/SettingsForm.tsx"
    "components/ChatInterface.tsx"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        check_result "PASS" "Critical file exists: $file"
    else
        check_result "FAIL" "Critical file missing: $file"
    fi
done

# Summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Verification Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}✅ Passed:${NC} $PASSED"
echo -e "${YELLOW}⚠️  Warnings:${NC} $WARNINGS"
echo -e "${RED}❌ Failed:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║              ✅ ALL CHECKS PASSED                            ║${NC}"
        echo -e "${GREEN}║                                                               ║${NC}"
        echo -e "${GREEN}║  Production server has all required updates for v${TARGET_VERSION}    ║${NC}"
        echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
        exit 0
    else
        echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║           ⚠️  CHECKS PASSED WITH WARNINGS                     ║${NC}"
        echo -e "${YELLOW}║                                                               ║${NC}"
        echo -e "${YELLOW}║  Production server appears updated but has some warnings     ║${NC}"
        echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════════╝${NC}"
        exit 0
    fi
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║              ❌ VERIFICATION FAILED                           ║${NC}"
    echo -e "${RED}║                                                               ║${NC}"
    echo -e "${RED}║  Production server is missing required updates                ║${NC}"
    echo -e "${RED}║  Please run the upgrade script to update the server           ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}To update the server, run:${NC}"
    echo "  curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/upgrade-production-v1.0.7.sh | sudo bash"
    exit 1
fi
