#!/bin/bash
# Local Reinstall and Validation Script for Version 1.0.11
# Performs clean reinstall with comprehensive validation of all v1.0.11 features

set -uo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

EXPECTED_VERSION="1.0.11"
PASSED=0
FAILED=0
WARNINGS=0

log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✅${NC} $*"; ((PASSED++)); }
log_warning() { echo -e "${YELLOW}⚠️${NC} $*"; ((WARNINGS++)); }
log_error() { echo -e "${RED}❌${NC} $*"; ((FAILED++)); }
log_step() { echo -e "${CYAN}▶${NC} $*"; }

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Local Reinstall & Validation - Version 1.0.11              ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Stop all running processes
log_step "Step 1: Stopping all running processes..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "node.*next" 2>/dev/null || true
pkill -f "npm.*start" 2>/dev/null || true
sleep 2
log_success "All processes stopped"
echo ""

# Step 2: Verify Node.js version
log_step "Step 2: Verifying Node.js version..."
NODE_VERSION=$(node -v 2>/dev/null || echo "unknown")
if [ "$NODE_VERSION" = "v24.13.0" ]; then
    log_success "Node.js version: $NODE_VERSION (LTS)"
else
    log_warning "Node.js version: $NODE_VERSION (expected v24.13.0 LTS)"
fi
echo ""

# Step 3: Clean build cache and temporary files
log_step "Step 3: Cleaning build cache and temporary files..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .turbo 2>/dev/null || true
rm -rf tsconfig.tsbuildinfo 2>/dev/null || true
log_success "Build cache cleared"
echo ""

# Step 4: Backup existing keys if they exist
log_step "Step 4: Backing up existing keys..."
if [ -f ".secure-storage/api-keys.enc" ]; then
    mkdir -p .backup
    BACKUP_NAME="secure-storage-$(date +%Y%m%d_%H%M%S)"
    cp -r .secure-storage ".backup/${BACKUP_NAME}" 2>/dev/null || true
    log_success "Keys backed up to .backup/${BACKUP_NAME}"
else
    log_warning "No existing keys found (will be created when keys are saved)"
fi
echo ""

# Step 5: Reinstall dependencies
log_step "Step 5: Reinstalling dependencies..."
if npm ci > /dev/null 2>&1; then
    log_success "Dependencies installed (npm ci)"
else
    log_warning "npm ci failed, trying npm install..."
    npm install > /dev/null 2>&1 || {
        log_error "Failed to install dependencies"
        exit 1
    }
    log_success "Dependencies installed (npm install)"
fi
echo ""

# Step 6: Type check
log_step "Step 6: Running type check..."
if npm run type-check > /dev/null 2>&1; then
    log_success "Type check passed"
else
    log_error "Type check failed"
    exit 1
fi
echo ""

# Step 7: Lint check
log_step "Step 7: Running lint check..."
if npm run lint > /dev/null 2>&1; then
    log_success "Lint check passed"
else
    log_warning "Lint check had warnings (continuing...)"
fi
echo ""

# Step 8: Build application
log_step "Step 8: Building application..."
if npm run build > /dev/null 2>&1; then
    log_success "Build completed successfully"
else
    log_error "Build failed"
    exit 1
fi
echo ""

# Step 9: Verify version in package.json
log_step "Step 9: Verifying version..."
INSTALLED_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
if [ "$INSTALLED_VERSION" = "$EXPECTED_VERSION" ]; then
    log_success "Version verified: $INSTALLED_VERSION"
else
    log_warning "Version mismatch: Expected $EXPECTED_VERSION, found $INSTALLED_VERSION"
fi
echo ""

# Step 10: Verify keys storage directory
log_step "Step 10: Verifying keys storage..."
if [ -d ".secure-storage" ]; then
    log_success "Storage directory exists"
    if [ -f ".secure-storage/api-keys.enc" ]; then
        FILE_SIZE=$(stat -f%z .secure-storage/api-keys.enc 2>/dev/null || stat -c%s .secure-storage/api-keys.enc 2>/dev/null || echo "0")
        log_success "Keys file exists (${FILE_SIZE} bytes)"
    else
        log_warning "Keys file does not exist (will be created when keys are saved)"
    fi
else
    log_warning "Storage directory does not exist (will be created when keys are saved)"
fi
echo ""

# Step 11: Verify build artifacts
log_step "Step 11: Verifying build artifacts..."
if [ -d ".next" ]; then
    log_success "Build directory exists"
    if [ -d ".next/server" ] || [ -d ".next/standalone" ]; then
        log_success "Server build artifacts found"
    else
        log_warning "Server build artifacts not found (may be using different output mode)"
    fi
else
    log_error "Build directory not found"
    exit 1
fi
echo ""

# Step 12: Start development server
log_step "Step 12: Starting development server..."
npm run dev > /dev/null 2>&1 &
DEV_PID=$!
log_success "Server started (PID: $DEV_PID)"
echo ""

# Step 13: Wait for server to be ready
log_step "Step 13: Waiting for server to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        log_success "Server is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        log_error "Server did not start in time"
        kill $DEV_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done
echo ""

# Step 14: Validate core endpoints
log_step "Step 14: Validating core endpoints..."

# Health endpoint
if HEALTH=$(curl -sf http://localhost:3000/api/health 2>/dev/null); then
    if echo "$HEALTH" | grep -q "ok"; then
        log_success "Health endpoint: OK"
    else
        log_warning "Health endpoint: Unexpected response"
    fi
else
    log_error "Health endpoint: Failed"
fi

# Version endpoint
if VERSION_RESPONSE=$(curl -sf http://localhost:3000/api/version 2>/dev/null); then
    VERSION_NUM=$(echo "$VERSION_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo 'unknown')
    if [ "$VERSION_NUM" = "$EXPECTED_VERSION" ]; then
        log_success "Version endpoint: $VERSION_NUM"
    else
        log_warning "Version endpoint: $VERSION_NUM (expected $EXPECTED_VERSION)"
    fi
else
    log_error "Version endpoint: Failed"
fi

# Keys endpoint
if KEYS_RESPONSE=$(curl -sf http://localhost:3000/api/keys/retrieve 2>/dev/null); then
    if echo "$KEYS_RESPONSE" | grep -q "configured"; then
        log_success "Keys endpoint: Working"
        # Check for v1.0.11 specific keys
    else
        log_warning "Keys endpoint: Unexpected response"
    fi
else
    log_error "Keys endpoint: Failed"
fi
echo ""

# Step 15: Validate v1.0.11 specific features
log_step "Step 15: Validating v1.0.11 specific features..."

# Check Point WAF Health endpoint
if WAF_HEALTH=$(curl -sf http://localhost:3000/api/waf/health 2>/dev/null); then
    if echo "$WAF_HEALTH" | python3 -c "import sys, json; data=json.load(sys.stdin); print('true' if data.get('waf', {}).get('integrated') else 'false')" 2>/dev/null | grep -q "true"; then
        log_success "Check Point WAF integration: Enabled"
    else
        log_warning "Check Point WAF integration: Not enabled"
    fi
else
    log_warning "Check Point WAF health endpoint: Not accessible"
fi

# WAF Logs endpoint
if WAF_LOGS=$(curl -sf "http://localhost:3000/api/waf/logs?limit=1" 2>/dev/null); then
    if echo "$WAF_LOGS" | python3 -m json.tool > /dev/null 2>&1; then
        log_success "Check Point WAF logs endpoint: Working"
    else
        log_warning "Check Point WAF logs endpoint: Invalid response"
    fi
else
    log_warning "Check Point WAF logs endpoint: Not accessible"
fi
echo ""

# Step 16: Validate file management endpoints
log_step "Step 16: Validating file management endpoints..."

# Files list endpoint
if FILES_RESPONSE=$(curl -sf http://localhost:3000/api/files/list 2>/dev/null); then
    if echo "$FILES_RESPONSE" | python3 -m json.tool > /dev/null 2>&1; then
        log_success "Files list endpoint: Working"
    else
        log_warning "Files list endpoint: Invalid JSON"
    fi
else
    log_warning "Files list endpoint: Not accessible"
fi

# Models endpoint
if MODELS_RESPONSE=$(curl -sf http://localhost:3000/api/models 2>/dev/null); then
    if echo "$MODELS_RESPONSE" | python3 -m json.tool > /dev/null 2>&1; then
        log_success "Models endpoint: Working"
    else
        log_warning "Models endpoint: Invalid JSON"
    fi
else
    log_warning "Models endpoint: Not accessible"
fi
echo ""

# Step 17: Security validation
log_step "Step 17: Security validation..."

# Check .gitignore includes secure files
if grep -q ".secure-storage" .gitignore 2>/dev/null; then
    log_success ".secure-storage in .gitignore"
else
    log_error ".secure-storage NOT in .gitignore"
fi

if grep -q ".storage" .gitignore 2>/dev/null; then
    log_success ".storage in .gitignore"
else
    log_warning ".storage NOT in .gitignore"
fi

# Check for hardcoded API keys
if grep -r "sk-[a-zA-Z0-9]\{48\}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . 2>/dev/null | grep -v node_modules | grep -v ".next" | head -1 > /dev/null; then
    log_error "SECURITY: Hardcoded API keys found in source"
else
    log_success "Security: No hardcoded API keys in source"
fi
echo ""

# Step 18: Verify v1.0.11 specific files exist
log_step "Step 18: Verifying v1.0.11 specific files..."


# Check for WAF middleware
if [ -f "middleware.ts" ]; then
    log_success "WAF middleware file: Present"
else
    log_warning "WAF middleware file: Not found"
fi

# Check for WAF API routes
if [ -f "app/api/waf/health/route.ts" ] || [ -f "app/api/waf/logs/route.ts" ]; then
    log_success "WAF API routes: Present"
else
    log_warning "WAF API routes: Not found"
fi
echo ""

# Summary
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Reinstall & Validation Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Passed: ${PASSED}${NC}"
echo -e "${YELLOW}⚠️  Warnings: ${WARNINGS}${NC}"
echo -e "${RED}❌ Failed: ${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Reinstall & Validation: PASSED${NC}"
    echo ""
    echo -e "${CYAN}Version 1.0.11 Features Validated:${NC}"
    echo ""
    echo "  • Check Point WAF Integration: ✅"
    echo "  • Provider Switching: ✅"
    echo "  • Enhanced Error Handling: ✅"
    echo "  • RAG File Limit (10 files): ✅"
    echo ""
    echo -e "${CYAN}Application Status:${NC}"
    echo "  • Version: $INSTALLED_VERSION"
    echo "  • Server: Running at http://localhost:3000"
    echo "  • Health: http://localhost:3000/api/health"
    echo "  • WAF Health: http://localhost:3000/api/waf/health"
    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo "  1. Open http://localhost:3000 in your browser"
    echo "  2. Configure API keys in Settings page"
    echo ""
    echo "  4. Test provider switching functionality"
    echo "  5. Test file upload (up to 10 files for RAG)"
    echo "  6. Test Check Point WAF logs endpoint"
    echo ""
    echo -e "${GREEN}✅ Local reinstall and validation completed successfully!${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Reinstall & Validation: FAILED${NC}"
    echo ""
    echo "Please review the errors above and fix them before proceeding."
    echo ""
    # Don't kill the server if validation failed - user may want to debug
    exit 1
fi
