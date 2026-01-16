#!/bin/bash

# Validation script for fresh Ubuntu installation of Secure AI Chat v1.0.11
# This script performs comprehensive checks to ensure the installation is correct

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_DIR="${APP_DIR:-$HOME/secure-ai-chat}"
APP_PORT="${PORT:-3000}"
BASE_URL="${BASE_URL:-http://localhost:${APP_PORT}}"

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Print functions
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Test functions
test_check() {
    local name="$1"
    local command="$2"
    local expected_result="${3:-0}"
    
    if eval "$command" > /dev/null 2>&1; then
        if [ $? -eq $expected_result ]; then
            print_success "$name"
            return 0
        else
            print_error "$name (unexpected result)"
            return 1
        fi
    else
        print_error "$name"
        return 1
    fi
}

# Start validation
print_header "Secure AI Chat v1.0.11 - Fresh Install Validation"

echo "Installation Directory: $APP_DIR"
echo "Application Port: $APP_PORT"
echo "Base URL: $BASE_URL"
echo ""

# Step 1: Check Installation Directory
print_header "Step 1: Installation Directory Check"

if [ -d "$APP_DIR" ]; then
    print_success "Installation directory exists: $APP_DIR"
    
    if [ -w "$APP_DIR" ]; then
        print_success "Installation directory is writable"
    else
        print_error "Installation directory is not writable"
    fi
else
    print_error "Installation directory does not exist: $APP_DIR"
    echo "Please run the installation script first"
    exit 1
fi

# Step 2: Check Node.js and npm
print_header "Step 2: Node.js and npm Check"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js is installed: $NODE_VERSION"
    
    # Check if version is 25.x
    if echo "$NODE_VERSION" | grep -q "v25"; then
        print_success "Node.js version is 25.x (correct)"
    else
        print_warning "Node.js version is not 25.x (current: $NODE_VERSION)"
    fi
else
    print_error "Node.js is not installed"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm is installed: $NPM_VERSION"
else
    print_error "npm is not installed"
fi

# Step 3: Check Application Files
print_header "Step 3: Application Files Check"

cd "$APP_DIR" || exit 1

if [ -f "package.json" ]; then
    print_success "package.json exists"
    
    # Check version in package.json
    PACKAGE_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)
    if [ "$PACKAGE_VERSION" = "1.0.11" ]; then
        print_success "Package version is correct: $PACKAGE_VERSION"
    else
        print_warning "Package version mismatch (expected: 1.0.11, found: $PACKAGE_VERSION)"
    fi
else
    print_error "package.json not found"
fi

if [ -f "package-lock.json" ]; then
    print_success "package-lock.json exists"
else
    print_warning "package-lock.json not found (may need npm install)"
fi

if [ -d "node_modules" ]; then
    print_success "node_modules directory exists"
    
    # Check if node_modules has content
    if [ "$(ls -A node_modules 2>/dev/null | wc -l)" -gt 0 ]; then
        print_success "node_modules contains packages"
    else
        print_error "node_modules is empty"
    fi
else
    print_error "node_modules directory not found"
fi

# Step 4: Check Build Artifacts
print_header "Step 4: Build Artifacts Check"

if [ -d ".next" ]; then
    print_success ".next directory exists (build completed)"
    
    if [ -d ".next/standalone" ] || [ -d ".next/server" ]; then
        print_success "Build artifacts are present"
    else
        print_warning "Build artifacts may be incomplete"
    fi
else
    print_error ".next directory not found (build not completed)"
    print_info "Run: cd $APP_DIR && npm run build"
fi

# Step 5: Check Secure Storage
print_header "Step 5: Secure Storage Check"

if [ -d ".secure-storage" ]; then
    print_success ".secure-storage directory exists"
    
    # Check permissions
    STORAGE_PERMS=$(stat -c "%a" .secure-storage 2>/dev/null || stat -f "%OLp" .secure-storage 2>/dev/null || echo "unknown")
    if [ "$STORAGE_PERMS" = "700" ]; then
        print_success "Secure storage permissions are correct (700)"
    else
        print_warning "Secure storage permissions may need adjustment (current: $STORAGE_PERMS, expected: 700)"
    fi
else
    print_warning ".secure-storage directory not found (will be created on first API key save)"
fi

# Step 6: Check Environment Configuration
print_header "Step 6: Environment Configuration Check"

if [ -f ".env.local" ]; then
    print_success ".env.local file exists"
    
    # Check for important variables
    if grep -q "^HOSTNAME=" .env.local; then
        HOSTNAME_VALUE=$(grep "^HOSTNAME=" .env.local | cut -d'=' -f2)
        if [ "$HOSTNAME_VALUE" = "0.0.0.0" ]; then
            print_success "HOSTNAME is set to 0.0.0.0 (public access enabled)"
        else
            print_warning "HOSTNAME is set to $HOSTNAME_VALUE (may not allow public access)"
        fi
    else
        print_warning "HOSTNAME not set in .env.local"
    fi
    
    if grep -q "^PORT=" .env.local; then
        PORT_VALUE=$(grep "^PORT=" .env.local | cut -d'=' -f2)
        print_success "PORT is configured: $PORT_VALUE"
    else
        print_info "PORT not set in .env.local (using default: 3000)"
    fi
else
    print_warning ".env.local file not found"
    print_info "Create it with: cd $APP_DIR && cp .env.example .env.local"
fi

# Step 7: Check Systemd Service
print_header "Step 7: Systemd Service Check"

if command -v systemctl &> /dev/null; then
    if systemctl list-unit-files | grep -q "secure-ai-chat.service"; then
        print_success "Systemd service file exists"
        
        if systemctl is-enabled secure-ai-chat &> /dev/null; then
            print_success "Service is enabled (will start on boot)"
        else
            print_warning "Service is not enabled"
        fi
        
        if systemctl is-active secure-ai-chat &> /dev/null; then
            print_success "Service is running"
        else
            print_warning "Service is not running"
            print_info "Start with: sudo systemctl start secure-ai-chat"
        fi
    else
        print_warning "Systemd service not found"
    fi
else
    print_warning "systemctl not available (may not be systemd-based system)"
fi

# Step 8: Check Application Health (if running)
print_header "Step 8: Application Health Check"

# Check if port is listening
if command -v ss &> /dev/null; then
    if ss -tlnp 2>/dev/null | grep -q ":${APP_PORT}"; then
        print_success "Port ${APP_PORT} is listening"
        
        # Try to connect to health endpoint
        if command -v curl &> /dev/null; then
            if curl -s -f "${BASE_URL}/api/health" > /dev/null 2>&1; then
                print_success "Health endpoint is responding"
                
                # Get health response
                HEALTH_RESPONSE=$(curl -s "${BASE_URL}/api/health")
                if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
                    print_success "Health check passed"
                else
                    print_warning "Health check response: $HEALTH_RESPONSE"
                fi
            else
                print_warning "Health endpoint not responding (app may not be fully started)"
            fi
            
            # Check version endpoint
            if curl -s -f "${BASE_URL}/api/version" > /dev/null 2>&1; then
                VERSION_RESPONSE=$(curl -s "${BASE_URL}/api/version")
                print_success "Version endpoint is responding"
                print_info "Version: $VERSION_RESPONSE"
            fi
        else
            print_warning "curl not available (cannot test HTTP endpoints)"
        fi
    else
        print_warning "Port ${APP_PORT} is not listening (application may not be running)"
        print_info "Start with: cd $APP_DIR && npm start"
    fi
else
    print_warning "ss command not available (cannot check port)"
fi

# Step 9: Check Firewall Configuration
print_header "Step 9: Firewall Configuration Check"

if command -v ufw &> /dev/null; then
    UFW_STATUS=$(sudo ufw status | head -n 1)
    if echo "$UFW_STATUS" | grep -q "Status: active"; then
        print_success "UFW firewall is active"
        
        if sudo ufw status | grep -q "${APP_PORT}/tcp"; then
            print_success "Port ${APP_PORT} is allowed in UFW"
        else
            print_warning "Port ${APP_PORT} may not be allowed in UFW"
            print_info "Allow with: sudo ufw allow ${APP_PORT}/tcp"
        fi
    else
        print_warning "UFW firewall is not active"
    fi
else
    print_info "UFW not installed (firewall check skipped)"
fi

# Step 10: Check Git Repository
print_header "Step 10: Git Repository Check"

if [ -d ".git" ]; then
    print_success "Git repository exists"
    
    if command -v git &> /dev/null; then
        CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
        print_success "Git repository is valid"
        print_info "Current branch/tag: $CURRENT_BRANCH"
        
        # Check for tag
        if git describe --tags --exact-match HEAD &> /dev/null; then
            CURRENT_TAG=$(git describe --tags --exact-match HEAD)
            print_success "On tag: $CURRENT_TAG"
        fi
    fi
else
    print_warning "Git repository not found (may be a deployed build)"
fi

# Summary
print_header "Validation Summary"

echo "Total Checks: $((PASSED + FAILED + WARNINGS))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ All checks passed! Installation is complete and ready.${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Installation is functional but has some warnings.${NC}"
        echo "Review the warnings above and address them if needed."
        exit 0
    fi
else
    echo -e "${RED}❌ Some checks failed. Please review the errors above.${NC}"
    echo ""
    echo "Common fixes:"
    echo "  1. Run build: cd $APP_DIR && npm run build"
    echo "  2. Start service: sudo systemctl start secure-ai-chat"
    echo "  3. Check logs: sudo journalctl -u secure-ai-chat -n 50"
    exit 1
fi
