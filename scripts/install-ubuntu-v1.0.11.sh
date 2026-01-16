#!/bin/bash

# Secure AI Chat - Complete Installation Script for Ubuntu/Debian
# Version: 1.0.11 (Stable Release)
# Based on: v1.0.10 (stable) + v1.0.11 (updates)
# 
# This script installs Secure AI Chat with:
# - Azure OpenAI Integration (v1.0.11)
# - Check Point WAF Support (v1.0.11)
# - Automatic systemd service setup
# - All fixes and improvements from v1.0.10 and v1.0.11
#
# Usage:
#   TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh | bash
#   OR
#   bash scripts/install-ubuntu-v1.0.11.sh

set -eo pipefail

# Configuration
REPO_URL="https://github.com/mazh-cp/secure-ai-chat.git"
REPO_DIR="${REPO_DIR:-secure-ai-chat}"
BRANCH="${BRANCH:-main}"
TAG="${TAG:-v1.0.11}"  # Default to v1.0.11
NODE_VERSION="${NODE_VERSION:-25.2.1}"
APP_PORT="${PORT:-3000}"
INSTALL_DIR="${INSTALL_DIR:-/opt}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
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

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   print_error "Please do not run this script as root. It will use sudo when needed."
   exit 1
fi

print_header "Secure AI Chat - Complete Installation Script v1.0.11"
echo "This script will:"
echo "  1. Install system dependencies"
echo "  2. Install Node.js ${NODE_VERSION} via nvm"
echo "  3. Clone repository (tag: ${TAG})"
echo "  4. Install project dependencies"
echo "  5. Set up environment configuration"
echo "  6. Build the application"
echo "  7. Configure systemd service (automatic startup)"
echo "  8. Configure UFW firewall"
echo "  9. Start the application"
echo ""

# Check if running in non-interactive mode
if [ ! -t 0 ]; then
    print_info "Non-interactive mode detected. Proceeding automatically..."
else
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Installation cancelled."
        exit 0
    fi
fi

# Step 1: Update system packages
print_header "Step 1: Updating System Packages"
print_info "Updating package list..."
sudo apt-get update -qq

print_info "Installing required system packages..."
sudo apt-get install -y -qq \
    curl \
    git \
    build-essential \
    ca-certificates \
    gnupg \
    lsb-release \
    iproute2 \
    > /dev/null 2>&1

print_success "System packages installed"

# Step 2: Install Node.js via nvm
print_header "Step 2: Installing Node.js ${NODE_VERSION} via nvm"

# Install nvm if not already installed
if [ ! -d "$HOME/.nvm" ]; then
    print_info "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash > /dev/null 2>&1
    print_success "nvm installed"
else
    print_info "nvm is already installed"
fi

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install and use Node.js v25.2.1
if nvm list | grep -q "v${NODE_VERSION}"; then
    print_info "Node.js v${NODE_VERSION} is already installed via nvm"
    nvm use ${NODE_VERSION} > /dev/null 2>&1
    nvm alias default ${NODE_VERSION} > /dev/null 2>&1
else
    print_info "Installing Node.js v${NODE_VERSION} via nvm..."
    nvm install ${NODE_VERSION} > /dev/null 2>&1
    nvm use ${NODE_VERSION} > /dev/null 2>&1
    nvm alias default ${NODE_VERSION} > /dev/null 2>&1
    print_success "Node.js v${NODE_VERSION} installed"
fi

# Verify Node.js version
CURRENT_NODE=$(node -v)
if [ "$CURRENT_NODE" = "v${NODE_VERSION}" ]; then
    print_success "Node.js ${CURRENT_NODE} is active"
else
    print_error "Node.js version mismatch. Expected v${NODE_VERSION}, got ${CURRENT_NODE}"
    exit 1
fi

# Verify npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Something went wrong."
    exit 1
fi

print_success "npm $(npm -v) is available"

# Step 3: Clone or update repository
print_header "Step 3: Setting Up Repository"

FULL_PATH="${INSTALL_DIR}/${REPO_DIR}"

if [ -d "$FULL_PATH" ]; then
    print_info "Repository directory exists. Updating..."
    cd "$FULL_PATH"
    if [ -d ".git" ]; then
        git fetch origin --tags -q
        if [ -n "$TAG" ]; then
            print_info "Checking out tag: $TAG"
            git checkout "$TAG" -q || {
                print_error "Tag $TAG not found. Available tags:"
                git tag -l | tail -10
                exit 1
            }
            print_success "Checked out tag: $TAG"
        else
            git checkout "$BRANCH" -q
            git pull origin "$BRANCH" -q
            print_success "Repository updated to $BRANCH"
        fi
    else
        print_warning "Directory exists but is not a git repository. Removing and cloning fresh..."
        cd "$INSTALL_DIR"
        rm -rf "$REPO_DIR"
        if [ -n "$TAG" ]; then
            print_info "Cloning repository with tag: $TAG"
            git clone "$REPO_URL" "$REPO_DIR" -q
            cd "$REPO_DIR"
            git checkout "$TAG" -q || {
                print_error "Tag $TAG not found"
                exit 1
            }
        else
            git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$REPO_DIR" -q
        fi
        print_success "Repository cloned"
    fi
else
    print_info "Cloning repository..."
    cd "$INSTALL_DIR"
    if [ -n "$TAG" ]; then
        print_info "Cloning repository with tag: $TAG"
        git clone "$REPO_URL" "$REPO_DIR" -q
        cd "$REPO_DIR"
        git checkout "$TAG" -q || {
            print_error "Tag $TAG not found. Available tags:"
            git tag -l | tail -10
            exit 1
        }
    else
        git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$REPO_DIR" -q
    fi
    print_success "Repository cloned to $FULL_PATH"
fi

cd "$FULL_PATH"

# Load nvm again after cd
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node version from .nvmrc if it exists
if [ -f ".nvmrc" ]; then
    NODE_VERSION_FROM_NVMRC=$(cat .nvmrc | tr -d '[:space:]')
    print_info "Using Node.js v${NODE_VERSION_FROM_NVMRC} from .nvmrc..."
    nvm use ${NODE_VERSION_FROM_NVMRC} > /dev/null 2>&1 || nvm install ${NODE_VERSION_FROM_NVMRC} > /dev/null 2>&1
    nvm use ${NODE_VERSION_FROM_NVMRC} > /dev/null 2>&1
fi

# Step 4: Fix Permissions
print_header "Step 4a: Fixing Permissions"

CURRENT_USER=$(whoami)
if [ "$CURRENT_USER" != "root" ]; then
    print_info "Setting ownership and permissions..."
    sudo chown -R $USER:$USER "$FULL_PATH" 2>/dev/null || true
    sudo chmod -R u+w "$FULL_PATH" 2>/dev/null || true
    sudo chmod 644 "$FULL_PATH/package.json" 2>/dev/null || true
    sudo chmod 644 "$FULL_PATH/package-lock.json" 2>/dev/null || true
    print_success "Permissions fixed"
else
    print_warning "Running as root - permissions may need manual adjustment"
fi

# Step 5: Install project dependencies
print_header "Step 4b: Installing Project Dependencies"

print_info "Installing npm dependencies (this may take a few minutes)..."
if [ -f "package-lock.json" ]; then
    print_info "Found package-lock.json, using 'npm ci' for reproducible builds..."
    if npm ci 2>&1; then
        print_success "Dependencies installed via npm ci"
    else
        print_warning "npm ci failed, trying npm install..."
        sudo chown -R $USER:$USER "$FULL_PATH" 2>/dev/null || true
        sudo chmod -R u+w "$FULL_PATH" 2>/dev/null || true
        if npm install 2>&1; then
            print_success "Dependencies installed and package-lock.json updated"
        else
            print_error "Failed to install dependencies"
            exit 1
        fi
    fi
else
    print_warning "package-lock.json not found, using 'npm install'..."
    if npm install 2>&1; then
        print_success "Dependencies installed"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
fi

# Step 6: Set up environment configuration
print_header "Step 5: Environment Configuration"

if [ ! -f ".env.local" ]; then
    print_info "Creating .env.local from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        print_success ".env.local created"
    else
        print_warning ".env.example not found. Creating basic .env.local..."
        cat > .env.local << EOF
# Secure AI Chat - Environment Variables
# Add your API keys here

# OpenAI Configuration
OPENAI_API_KEY=

# Azure OpenAI Configuration (v1.0.11)
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=

# Lakera AI Configuration
LAKERA_AI_KEY=
LAKERA_ENDPOINT=https://api.lakera.ai/v2/guard
LAKERA_PROJECT_ID=

# Check Point TE Configuration
CHECKPOINT_TE_API_KEY=

# Check Point WAF Configuration (v1.0.11 - Optional)
WAF_AUTH_ENABLED=false
WAF_API_KEY=

# Application Configuration
NEXT_PUBLIC_APP_NAME=Secure AI Chat
NEXT_PUBLIC_APP_VERSION=1.0.11
PORT=${APP_PORT}
HOSTNAME=0.0.0.0
EOF
        print_success ".env.local created"
    fi
    print_warning "Please edit .env.local and add your API keys before running the application"
else
    print_info ".env.local already exists, skipping..."
    # Ensure HOSTNAME is set to 0.0.0.0 for public access
    if ! grep -q "^HOSTNAME=" .env.local; then
        print_info "Adding HOSTNAME=0.0.0.0 to existing .env.local for public access..."
        echo "HOSTNAME=0.0.0.0" >> .env.local
        print_success "HOSTNAME added to .env.local"
    elif grep -q "^HOSTNAME=127.0.0.1" .env.local || grep -q "^HOSTNAME=localhost" .env.local; then
        print_warning "HOSTNAME is set to localhost/127.0.0.1. Updating to 0.0.0.0 for public access..."
        sed -i 's/^HOSTNAME=.*/HOSTNAME=0.0.0.0/' .env.local
        print_success "HOSTNAME updated to 0.0.0.0"
    else
        print_info "HOSTNAME is already configured in .env.local"
    fi
fi

# Step 7: Build the application
print_header "Step 6: Building Application"

print_info "Running type check..."
if npm run type-check --silent; then
    print_success "Type check passed"
else
    print_warning "Type check failed, but continuing with build..."
fi

print_info "Building production bundle (this may take a few minutes)..."
npm run build

if [ -d ".next" ]; then
    print_success "Application built successfully"
else
    print_error "Build failed - .next directory not found"
    exit 1
fi

# Step 8: Configure systemd Service for Automatic Startup
print_header "Step 7: Configuring Automatic Startup (systemd)"

# Find Node.js and npm paths
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use ${NODE_VERSION} > /dev/null 2>&1

NODE_PATH=$(which node 2>/dev/null || echo "")
NPM_PATH=$(which npm 2>/dev/null || echo "")

if [ -n "$NPM_PATH" ]; then
    print_info "Found npm at: $NPM_PATH"
    
    SERVICE_FILE="/etc/systemd/system/secure-ai-chat.service"
    
    print_info "Creating systemd service file..."
    sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Secure AI Chat (Next.js) - v1.0.11
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
Group=$CURRENT_USER
WorkingDirectory=$FULL_PATH
Environment="NODE_ENV=production"
Environment="PORT=$APP_PORT"
Environment="HOSTNAME=0.0.0.0"

# Source nvm, use Node.js, change to app directory, then run npm start
# The 'cd' command ensures we're in the correct directory before running npm
ExecStart=/usr/bin/env bash -lc 'source "/home/$CURRENT_USER/.nvm/nvm.sh" && nvm use ${NODE_VERSION} && cd "$FULL_PATH" && npm start'

Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=secure-ai-chat

# Security
NoNewPrivileges=true
PrivateTmp=true
ReadWritePaths=$FULL_PATH/.secure-storage $FULL_PATH/.next $FULL_PATH/.storage

[Install]
WantedBy=multi-user.target
EOF

    print_success "Systemd service file created"
    
    # Reload systemd
    print_info "Reloading systemd daemon..."
    sudo systemctl daemon-reload
    
    # Enable service (start on boot)
    print_info "Enabling service to start on boot..."
    sudo systemctl enable secure-ai-chat > /dev/null 2>&1
    
    # Start service
    print_info "Starting Secure AI Chat service..."
    if sudo systemctl start secure-ai-chat; then
        print_success "Service started successfully"
        
        # Wait a moment for service to start
        sleep 5
        
        # Check service status
        if sudo systemctl is-active --quiet secure-ai-chat; then
            print_success "Service is running"
        else
            print_warning "Service may not be running. Check status with: sudo systemctl status secure-ai-chat"
            print_info "Check logs with: sudo journalctl -u secure-ai-chat -n 50"
        fi
    else
        print_warning "Failed to start service automatically. You can start it manually with: sudo systemctl start secure-ai-chat"
    fi
else
    print_warning "Could not find npm path. Skipping systemd service setup."
    print_info "You can manually create the service file or start the app with: cd $FULL_PATH && npm start"
fi

# Step 9: Configure UFW Firewall
print_header "Step 8: Configuring UFW Firewall"

# Check if UFW is installed
if ! command -v ufw &> /dev/null; then
    print_info "UFW is not installed. Installing..."
    sudo apt-get install -y -qq ufw > /dev/null 2>&1
    print_success "UFW installed"
else
    print_info "UFW is already installed"
fi

# Check UFW status
UFW_STATUS=$(sudo ufw status | head -n 1)
if echo "$UFW_STATUS" | grep -q "Status: active"; then
    print_warning "UFW is already enabled. Adding rules..."
    UFW_ENABLED=true
else
    print_info "UFW is inactive. Configuring and enabling..."
    UFW_ENABLED=false
fi

# Allow SSH (critical - prevent lockout)
print_info "Allowing SSH (port 22) to prevent lockout..."
if sudo ufw status | grep -q "22/tcp"; then
    print_info "SSH (port 22) is already allowed"
else
    sudo ufw allow 22/tcp > /dev/null 2>&1
    print_success "SSH (port 22) allowed"
fi

# Allow application port
print_info "Allowing application port ${APP_PORT}/tcp for both localhost and public access..."
if sudo ufw status | grep -q "${APP_PORT}/tcp"; then
    print_info "Port ${APP_PORT}/tcp is already allowed"
else
    sudo ufw allow ${APP_PORT}/tcp > /dev/null 2>&1
    print_success "Port ${APP_PORT}/tcp allowed"
fi

# Enable UFW if not already enabled
if [ "$UFW_ENABLED" = false ]; then
    print_info "Enabling UFW..."
    echo "y" | sudo ufw --force enable > /dev/null 2>&1
    print_success "UFW enabled"
else
    print_info "Reloading UFW to apply new rules..."
    sudo ufw reload > /dev/null 2>&1
    print_success "UFW rules applied"
fi

# Display UFW status
print_info "Current UFW rules:"
sudo ufw status numbered | grep -E "(Status|${APP_PORT}|22/tcp)" || true
print_success "Firewall configuration complete"

# Step 10: Verification
print_header "Step 9: Verification"

# Check Node.js version matches .nvmrc
if [ -f ".nvmrc" ]; then
    EXPECTED_NODE=$(cat .nvmrc | tr -d '[:space:]')
    CURRENT_NODE=$(node -v | tr -d 'v')
    if [ "$CURRENT_NODE" = "$EXPECTED_NODE" ]; then
        print_success "Node.js version: $(node -v) ✓ (matches .nvmrc)"
    else
        print_error "Node.js version mismatch. Expected v${EXPECTED_NODE}, got v${CURRENT_NODE}"
        print_info "Run: nvm use"
        exit 1
    fi
else
    print_warning ".nvmrc not found, skipping version check"
fi

# Check npm
print_success "npm version: $(npm -v) ✓"

# Check build artifacts
if [ -d ".next" ] && [ -f "package.json" ]; then
    print_success "Build artifacts present ✓"
else
    print_error "Build artifacts missing"
    exit 1
fi

# Check service status
if command -v systemctl &> /dev/null && sudo systemctl is-enabled secure-ai-chat &> /dev/null; then
    if sudo systemctl is-active --quiet secure-ai-chat; then
        print_success "Service is running ✓"
    else
        print_warning "Service is enabled but not running. Check: sudo systemctl status secure-ai-chat"
    fi
fi

# Final summary
print_header "Installation Complete!"

echo -e "${GREEN}✅ Secure AI Chat v1.0.11 has been successfully installed!${NC}"
echo ""
echo "Installation directory: $FULL_PATH"
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"
echo "Application version: 1.0.11"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. Configure environment variables:"
echo "   cd $FULL_PATH"
echo "   nano .env.local"
echo ""
echo "2. Add your API keys in .env.local:"
echo "   - OPENAI_API_KEY (required for OpenAI provider)"
echo "   - AZURE_OPENAI_API_KEY (optional, for Azure OpenAI provider)"
echo "   - AZURE_OPENAI_ENDPOINT (optional, for Azure OpenAI provider)"
echo "   - LAKERA_AI_KEY (optional, for security scanning)"
echo "   - CHECKPOINT_TE_API_KEY (optional, for Check Point TE)"
echo ""
echo "3. Application Status:"
if command -v systemctl &> /dev/null && sudo systemctl is-enabled secure-ai-chat &> /dev/null; then
    echo "   ✅ Service is enabled and should start automatically on boot"
    echo "   Check status: sudo systemctl status secure-ai-chat"
    echo "   View logs: sudo journalctl -u secure-ai-chat -f"
    echo "   Restart: sudo systemctl restart secure-ai-chat"
else
    echo "   Start manually:"
    echo "   cd $FULL_PATH"
    echo "   npm start"
fi
echo ""
echo "4. Access the application:"
echo "   Local:   http://localhost:${APP_PORT}"
echo "   Network: http://\$(hostname -I | awk '{print \$1}'):${APP_PORT}"
echo ""
echo -e "${BLUE}New Features in v1.0.11:${NC}"
echo "   ✅ Azure OpenAI Integration (with APIM gateway support)"
echo "   ✅ Check Point WAF Integration"
echo "   ✅ Provider switching (OpenAI / Azure OpenAI)"
echo "   ✅ Enhanced RAG (up to 10 files)"
echo "   ✅ Automatic startup via systemd"
echo "   ✅ Improved error handling"
echo ""
echo -e "${BLUE}Firewall Configuration:${NC}"
echo "   - UFW firewall has been configured"
echo "   - SSH (port 22) is allowed"
echo "   - Application port ${APP_PORT} is allowed for both localhost and public access"
echo ""
echo -e "${YELLOW}Important: Cloud Provider Firewalls${NC}"
echo "   If using AWS/GCP/Azure, you may also need to configure:"
echo "   - AWS: Security Groups (allow inbound on port ${APP_PORT})"
echo "   - GCP: Firewall Rules (allow tcp:${APP_PORT})"
echo "   - Azure: Network Security Groups (allow port ${APP_PORT})"
echo ""
echo -e "${BLUE}Verification Commands:${NC}"
echo "   After starting the app, verify it's listening on all interfaces:"
echo "   sudo ss -tlnp | grep :${APP_PORT}"
echo "   Should show: 0.0.0.0:${APP_PORT} (NOT 127.0.0.1:${APP_PORT})"
echo ""
echo -e "${BLUE}Health Check:${NC}"
echo "   curl http://localhost:${APP_PORT}/api/health"
echo "   curl http://localhost:${APP_PORT}/api/version"
echo ""
echo -e "${GREEN}Installation script completed successfully!${NC}"
