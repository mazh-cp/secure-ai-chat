#!/bin/bash

# Dry-run test script for installation validation
# This script validates the installation script without actually installing

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_SCRIPT="scripts/install-ubuntu-v1.0.11.sh"
VALIDATION_SCRIPT="scripts/validate-fresh-install.sh"

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

PASSED=0
FAILED=0

print_header "Installation Script Dry-Run Validation"

# Test 1: Script exists
print_info "Test 1: Checking if scripts exist..."
if [ -f "$INSTALL_SCRIPT" ]; then
    print_success "Installation script exists"
    ((PASSED++))
else
    print_error "Installation script not found: $INSTALL_SCRIPT"
    ((FAILED++))
    exit 1
fi

if [ -f "$VALIDATION_SCRIPT" ]; then
    print_success "Validation script exists"
    ((PASSED++))
else
    print_error "Validation script not found: $VALIDATION_SCRIPT"
    ((FAILED++))
fi

# Test 2: Syntax validation
print_info "Test 2: Syntax validation..."
if bash -n "$INSTALL_SCRIPT" 2>&1; then
    print_success "Installation script syntax is valid"
    ((PASSED++))
else
    print_error "Installation script has syntax errors"
    bash -n "$INSTALL_SCRIPT"
    ((FAILED++))
fi

if bash -n "$VALIDATION_SCRIPT" 2>&1; then
    print_success "Validation script syntax is valid"
    ((PASSED++))
else
    print_error "Validation script has syntax errors"
    bash -n "$VALIDATION_SCRIPT"
    ((FAILED++))
fi

# Test 3: Check for required functions
print_info "Test 3: Checking for required functions..."
REQUIRED_FUNCTIONS=("print_info" "print_success" "print_error" "print_warning" "print_header")
for func in "${REQUIRED_FUNCTIONS[@]}"; do
    if grep -q "^${func}()" "$INSTALL_SCRIPT"; then
        print_success "Function $func exists"
        ((PASSED++))
    else
        print_error "Function $func not found"
        ((FAILED++))
    fi
done

# Test 4: Check for required steps
print_info "Test 4: Checking for required installation steps..."
REQUIRED_STEPS=(
    "Step 1: Updating System Packages"
    "Step 2: Installing Node.js"
    "Step 3: Setting Up Repository"
    "Step 4: Installing Project Dependencies"
    "Step 5: Environment Configuration"
    "Step 6.5: Setting Up Secure Storage"
    "Step 7: Building Application"
    "Step 8: Configuring Automatic Startup"
    "Step 9: Configuring UFW Firewall"
    "Step 10: Verification"
)

for step in "${REQUIRED_STEPS[@]}"; do
    if grep -q "$step" "$INSTALL_SCRIPT"; then
        print_success "Step found: $step"
        ((PASSED++))
    else
        print_warning "Step not found: $step"
    fi
done

# Test 5: Check for error handling
print_info "Test 5: Checking for error handling..."
if grep -q "set -e" "$INSTALL_SCRIPT"; then
    print_success "Error handling enabled (set -e)"
    ((PASSED++))
else
    print_warning "Error handling not explicitly enabled"
fi

if grep -q "set -eo pipefail" "$INSTALL_SCRIPT"; then
    print_success "Pipe failure handling enabled"
    ((PASSED++))
else
    print_warning "Pipe failure handling not enabled"
fi

# Test 6: Check for clean install support
print_info "Test 6: Checking for clean install support..."
if grep -q "CLEAN_INSTALL" "$INSTALL_SCRIPT"; then
    print_success "Clean install support found"
    ((PASSED++))
else
    print_warning "Clean install support not found"
fi

# Test 7: Check for secure storage setup
print_info "Test 7: Checking for secure storage setup..."
if grep -q ".secure-storage" "$INSTALL_SCRIPT"; then
    print_success "Secure storage setup found"
    ((PASSED++))
else
    print_error "Secure storage setup not found"
    ((FAILED++))
fi

# Test 8: Check for systemd service setup
print_info "Test 8: Checking for systemd service setup..."
if grep -q "systemd" "$INSTALL_SCRIPT" && grep -q "secure-ai-chat.service" "$INSTALL_SCRIPT"; then
    print_success "Systemd service setup found"
    ((PASSED++))
else
    print_warning "Systemd service setup not found"
fi

# Test 9: Check for firewall configuration
print_info "Test 9: Checking for firewall configuration..."
if grep -q "ufw" "$INSTALL_SCRIPT"; then
    print_success "Firewall configuration found"
    ((PASSED++))
else
    print_warning "Firewall configuration not found"
fi

# Test 10: Check for validation script reference
print_info "Test 10: Checking for validation script reference..."
if grep -q "validate-fresh-install" "$INSTALL_SCRIPT"; then
    print_success "Validation script reference found"
    ((PASSED++))
else
    print_warning "Validation script reference not found"
fi

# Test 11: Check for proper permissions handling
print_info "Test 11: Checking for permissions handling..."
if grep -q "chmod.*700" "$INSTALL_SCRIPT" || grep -q "chmod 700" "$INSTALL_SCRIPT"; then
    print_success "Secure storage permissions handling found"
    ((PASSED++))
else
    print_warning "Secure storage permissions handling not found"
fi

# Test 12: Check for version information
print_info "Test 12: Checking for version information..."
if grep -q "1.0.11" "$INSTALL_SCRIPT"; then
    print_success "Version 1.0.11 referenced"
    ((PASSED++))
else
    print_warning "Version 1.0.11 not found"
fi

# Summary
print_header "Dry-Run Test Summary"
echo "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    print_success "All dry-run tests passed! Script is ready for installation."
    echo ""
    echo "Next steps:"
    echo "  1. Review the installation script"
    echo "  2. Run on a test VM or container"
    echo "  3. Execute: bash scripts/install-ubuntu-v1.0.11.sh"
    echo "  4. Validate: bash scripts/validate-fresh-install.sh"
    exit 0
else
    print_error "Some tests failed. Please review the errors above."
    exit 1
fi
