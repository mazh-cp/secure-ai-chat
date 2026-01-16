#!/bin/bash

# Quick clean install script - removes existing installation and performs fresh install

set -e

INSTALL_DIR="${INSTALL_DIR:-$HOME}"
REPO_DIR="secure-ai-chat"
FULL_PATH="${INSTALL_DIR}/${REPO_DIR}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_header "Clean Installation - Remove Existing and Install Fresh"

# Check if directory exists
if [ -d "$FULL_PATH" ]; then
    print_warning "Existing installation found at: $FULL_PATH"
    echo ""
    echo "This will:"
    echo "  1. Stop the secure-ai-chat service (if running)"
    echo "  2. Remove the existing installation directory"
    echo "  3. Perform a fresh installation"
    echo ""
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Cancelled."
        exit 0
    fi
    
    # Stop service if running
    if command -v systemctl &> /dev/null && sudo systemctl is-active secure-ai-chat &> /dev/null; then
        print_info "Stopping secure-ai-chat service..."
        sudo systemctl stop secure-ai-chat || true
        print_success "Service stopped"
    fi
    
    # Remove existing directory
    print_info "Removing existing installation..."
    if [ "$INSTALL_DIR" = "/opt" ]; then
        sudo rm -rf "$FULL_PATH"
    else
        rm -rf "$FULL_PATH"
    fi
    print_success "Existing installation removed"
else
    print_info "No existing installation found. Proceeding with fresh install..."
fi

# Run installation script
print_header "Starting Fresh Installation"
print_info "Running installation script with CLEAN_INSTALL=true..."

cd "$INSTALL_DIR"
CLEAN_INSTALL=true bash "$(dirname "$0")/install-ubuntu-v1.0.11.sh"

print_header "Installation Complete"
print_success "Fresh installation completed!"
print_info "Run validation: cd $FULL_PATH && bash scripts/validate-fresh-install.sh"
