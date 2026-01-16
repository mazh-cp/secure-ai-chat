#!/bin/bash

# Restart and update local installation script
# This script updates the codebase, rebuilds, and restarts the service

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_DIR="${APP_DIR:-$HOME/secure-ai-chat}"
TAG="${TAG:-v1.0.11}"
BRANCH="${BRANCH:-main}"

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

# Check if directory exists
if [ ! -d "$APP_DIR" ]; then
    print_error "Installation directory not found: $APP_DIR"
    print_info "Please run the installation script first"
    exit 1
fi

print_header "Restart and Update Secure AI Chat Installation"

echo "Installation directory: $APP_DIR"
echo "Target version: $TAG"
echo ""

# Step 1: Stop service
print_header "Step 1: Stopping Service"

if command -v systemctl &> /dev/null && sudo systemctl is-active secure-ai-chat &> /dev/null; then
    print_info "Stopping secure-ai-chat service..."
    if sudo systemctl stop secure-ai-chat; then
        print_success "Service stopped"
    else
        print_warning "Failed to stop service (may not be running)"
    fi
else
    print_info "Service is not running or systemd not available"
fi

# Step 2: Navigate to directory
print_header "Step 2: Updating Repository"

cd "$APP_DIR" || exit 1

# Step 3: Update repository
if [ -d ".git" ]; then
    print_info "Updating git repository..."
    
    # Fetch latest changes
    git fetch origin --tags -q
    print_success "Fetched latest changes"
    
    # Checkout specified tag or branch
    if [ -n "$TAG" ]; then
        print_info "Checking out tag: $TAG"
        if git checkout "$TAG" -q; then
            print_success "Checked out tag: $TAG"
        else
            print_error "Tag $TAG not found"
            print_info "Available tags:"
            git tag -l | tail -10
            exit 1
        fi
    else
        print_info "Checking out branch: $BRANCH"
        git checkout "$BRANCH" -q
        git pull origin "$BRANCH" -q
        print_success "Updated to latest $BRANCH"
    fi
else
    print_warning "Not a git repository. Skipping update."
    print_info "If you need to update, consider a clean install"
fi

# Step 4: Update Node.js version if needed
print_header "Step 3: Ensuring Correct Node.js Version"

if [ -f ".nvmrc" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    NODE_VERSION_FROM_NVMRC=$(cat .nvmrc | tr -d '[:space:]')
    print_info "Required Node.js version: $NODE_VERSION_FROM_NVMRC"
    
    if command -v nvm &> /dev/null; then
        nvm use ${NODE_VERSION_FROM_NVMRC} > /dev/null 2>&1 || nvm install ${NODE_VERSION_FROM_NVMRC} > /dev/null 2>&1
        nvm use ${NODE_VERSION_FROM_NVMRC} > /dev/null 2>&1
        print_success "Using Node.js $(node -v)"
    else
        print_warning "nvm not found. Please ensure Node.js version matches .nvmrc"
    fi
fi

# Step 5: Update dependencies
print_header "Step 4: Updating Dependencies"

print_info "Installing/updating npm dependencies..."
if [ -f "package-lock.json" ]; then
    if npm ci; then
        print_success "Dependencies updated via npm ci"
    else
        print_warning "npm ci failed, trying npm install..."
        npm install
        print_success "Dependencies updated via npm install"
    fi
else
    npm install
    print_success "Dependencies installed"
fi

# Step 6: Rebuild application
print_header "Step 5: Rebuilding Application"

print_info "Running type check..."
if npm run type-check --silent 2>/dev/null; then
    print_success "Type check passed"
else
    print_warning "Type check had warnings (continuing with build)"
fi

print_info "Building production bundle..."
if npm run build; then
    print_success "Application rebuilt successfully"
else
    print_error "Build failed"
    exit 1
fi

# Step 7: Ensure secure storage exists
print_header "Step 6: Verifying Secure Storage"

if [ ! -d ".secure-storage" ]; then
    print_info "Creating secure storage directory..."
    mkdir -p .secure-storage
    chmod 700 .secure-storage
    print_success "Secure storage directory created"
else
    print_info "Secure storage directory exists"
    # Ensure correct permissions
    chmod 700 .secure-storage 2>/dev/null || true
    print_success "Secure storage permissions verified"
fi

# Step 8: Restart service
print_header "Step 7: Restarting Service"

if command -v systemctl &> /dev/null; then
    print_info "Restarting secure-ai-chat service..."
    if sudo systemctl restart secure-ai-chat; then
        print_success "Service restarted"
        
        # Wait a moment for service to start
        sleep 5
        
        # Check status
        if sudo systemctl is-active --quiet secure-ai-chat; then
            print_success "Service is running"
        else
            print_warning "Service may not be running. Check status:"
            print_info "  sudo systemctl status secure-ai-chat"
        fi
    else
        print_error "Failed to restart service"
        print_info "Check logs: sudo journalctl -u secure-ai-chat -n 50"
        exit 1
    fi
else
    print_warning "systemctl not available. Please start manually:"
    print_info "  cd $APP_DIR && npm start"
fi

# Step 9: Verification
print_header "Step 8: Verification"

print_info "Waiting for service to be ready..."
sleep 3

# Check health endpoint
if command -v curl &> /dev/null; then
    if curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
        print_success "Health endpoint is responding"
        
        # Get version
        VERSION_RESPONSE=$(curl -s http://localhost:3000/api/version 2>/dev/null || echo "{}")
        print_info "Version: $VERSION_RESPONSE"
    else
        print_warning "Health endpoint not responding yet (service may still be starting)"
        print_info "Wait a few moments and check: curl http://localhost:3000/api/health"
    fi
else
    print_warning "curl not available (cannot test health endpoint)"
fi

# Summary
print_header "Update Complete!"

print_success "Installation has been updated and restarted"
echo ""
echo "Installation directory: $APP_DIR"
echo "Current version: $TAG"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Verify service: sudo systemctl status secure-ai-chat"
echo "  2. Check logs: sudo journalctl -u secure-ai-chat -f"
echo "  3. Test health: curl http://localhost:3000/api/health"
echo "  4. Run validation: cd $APP_DIR && bash scripts/validate-fresh-install.sh"
echo ""
echo -e "${GREEN}Update completed successfully!${NC}"
