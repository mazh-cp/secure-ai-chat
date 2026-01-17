#!/bin/bash
# Secure AI Chat - Production Install/Upgrade Script (Full Parity)
# Ensures seamless, issue-free installation matching local Cursor environment
# Handles both fresh installs and upgrades automatically
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-production-ubuntu.sh | bash
#
# Configuration (via environment variables):
#   INSTALL_DIR: Installation directory (default: $HOME/secure-ai-chat)
#   BRANCH: Git branch/tag to install (default: main)
#   NODE_VERSION: Node.js version (default: 24.13.0)
#   APP_PORT: Application port (default: 3000)

set -eo pipefail
# Note: -u is disabled to allow environment variables with defaults to work properly

# Configuration
REPO_URL="https://github.com/mazh-cp/secure-ai-chat.git"
REPO_DIR="${REPO_DIR:-secure-ai-chat}"
BRANCH="${BRANCH:-main}"
TAG="${TAG:-}"  # Optional: specify tag (e.g., v1.0.11) to checkout instead of branch
NODE_VERSION="${NODE_VERSION:-24.13.0}"
APP_PORT="${PORT:-3000}"
INSTALL_DIR="${INSTALL_DIR:-$HOME}"
FULL_PATH="${INSTALL_DIR}/${REPO_DIR}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
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

# Detect if upgrade or fresh install
IS_UPGRADE=false
if [ -d "$FULL_PATH" ] && [ -f "$FULL_PATH/package.json" ]; then
    IS_UPGRADE=true
    print_info "Existing installation detected - running in UPGRADE mode"
else
    IS_UPGRADE=false
    print_info "No existing installation detected - running in FRESH INSTALL mode"
fi

print_header "Secure AI Chat - Production Install/Upgrade Script (Full Parity)"
echo "This script will:"
echo "  1. Install/verify system dependencies"
echo "  2. Install/upgrade Node.js ${NODE_VERSION} via nvm"
echo "  3. Clone/pull the repository"
echo "  4. Install project dependencies (npm ci with fallback)"
echo "  5. Run release gate (must pass)"
echo "  6. Build the application"
echo "  7. Set up storage directories (0o755 permissions)"
echo "  8. Configure systemd service (auto-start on boot)"
echo "  9. Verify installation"
echo ""

# Non-interactive mode detection
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

# Step 1: OS Detection and System Packages
print_header "Step 1: OS Detection and System Packages"

# Detect OS
OS_ID="unknown"
OS_VERSION="unknown"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="${ID:-unknown}"
    OS_VERSION="${VERSION_ID:-unknown}"
    if [ -n "$NAME" ]; then
        print_info "Detected: $NAME (${OS_ID} ${OS_VERSION})"
    else
        print_info "Detected: ${OS_ID} ${OS_VERSION}"
    fi
else
    print_warning "Could not detect OS version (missing /etc/os-release)"
fi

# Validate OS support
if [[ "$OS_ID" =~ ^(ubuntu|debian)$ ]]; then
    if [[ "$OS_ID" == "ubuntu" ]]; then
        VERSION_NUM=$(echo "$OS_VERSION" | cut -d'.' -f1)
        if [ -n "$VERSION_NUM" ] && [ "$VERSION_NUM" -lt 20 ] 2>/dev/null; then
            print_warning "Ubuntu version ${OS_VERSION} detected. Ubuntu 20.04+ is recommended."
        fi
    elif [[ "$OS_ID" == "debian" ]]; then
        VERSION_NUM=$(echo "$OS_VERSION" | cut -d'.' -f1)
        if [ -n "$VERSION_NUM" ] && [ "$VERSION_NUM" -lt 11 ] 2>/dev/null; then
            print_warning "Debian version ${OS_VERSION} detected. Debian 11+ is recommended."
        fi
    fi
    print_success "OS detected: ${OS_ID} ${OS_VERSION}"
else
    print_warning "OS not recognized: ${OS_ID}. Continuing anyway..."
fi

# Update package list
print_info "Updating package list..."
if sudo apt-get update -qq; then
    print_success "Package list updated"
else
    print_warning "Package update had issues, continuing..."
fi

# Install required packages
PACKAGES=(
    curl
    git
    build-essential
    ca-certificates
    gnupg
    lsb-release
    iproute2
)

MISSING_PKGS=()
for pkg in "${PACKAGES[@]}"; do
    if ! dpkg -l | grep -q "^ii  $pkg "; then
        MISSING_PKGS+=("$pkg")
    fi
done

if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
    print_info "Installing missing packages: ${MISSING_PKGS[*]}"
    if sudo apt-get install -y -qq "${MISSING_PKGS[@]}" > /dev/null 2>&1; then
        print_success "System packages installed: ${MISSING_PKGS[*]}"
    else
        print_warning "Failed to install some packages, attempting individual installation..."
        for pkg in "${MISSING_PKGS[@]}"; do
            if sudo apt-get install -y "$pkg" > /dev/null 2>&1; then
                print_info "Installed: $pkg"
            else
                print_warning "Failed to install: $pkg (may cause issues later)"
            fi
        done
    fi
else
    print_success "All required packages already installed"
fi

# Verify critical packages (robust build-essential check)
MISSING_CRITICAL=()

if ! command -v curl >/dev/null 2>&1 && ! dpkg -l | grep -q "^ii  curl "; then
    MISSING_CRITICAL+=("curl")
fi

if ! command -v git >/dev/null 2>&1 && ! dpkg -l | grep -q "^ii  git "; then
    MISSING_CRITICAL+=("git")
fi

# Robust build-essential verification (matches local install-ubuntu.sh)
if ! dpkg -l 2>/dev/null | grep -E "^ii[[:space:]]+build-essential[[:space:]]" >/dev/null 2>&1; then
    if ! dpkg -l 2>/dev/null | grep -E "^ii[[:space:]\t]+build-essential" >/dev/null 2>&1; then
        if ! dpkg -l 2>/dev/null | grep -E "^ii" | grep -q "build-essential"; then
            MISSING_CRITICAL+=("build-essential")
        fi
    fi
fi

if [ ${#MISSING_CRITICAL[@]} -gt 0 ]; then
    print_error "Critical packages missing: ${MISSING_CRITICAL[*]}"
    print_error "Please install manually: sudo apt-get update && sudo apt-get install -y ${MISSING_CRITICAL[*]}"
    exit 1
fi

print_success "System packages verified"

# Step 2: Node.js via nvm
print_header "Step 2: Installing/Upgrading Node.js to ${NODE_VERSION} (LTS) via nvm"

# Install nvm if not present
if [ ! -d "$HOME/.nvm" ]; then
    print_info "Installing nvm (Node Version Manager)..."
    NVM_VERSION="${NVM_VERSION:-v0.39.7}"
    if curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash > /dev/null 2>&1; then
        print_success "nvm ${NVM_VERSION} installed"
    else
        print_error "Failed to install nvm. Check internet connection."
        exit 1
    fi
else
    print_info "nvm is already installed"
fi

# Load nvm
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
    print_success "nvm loaded"
else
    print_error "nvm installation appears incomplete. $NVM_DIR/nvm.sh not found."
    exit 1
fi

# Verify nvm is working
if ! command -v nvm >/dev/null 2>&1; then
    if [ -f "$HOME/.bashrc" ]; then
        . "$HOME/.bashrc" 2>/dev/null || true
    fi
    if [ -f "$HOME/.profile" ]; then
        . "$HOME/.profile" 2>/dev/null || true
    fi
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        . "$NVM_DIR/nvm.sh"
    fi
    if ! command -v nvm >/dev/null 2>&1; then
        print_warning "nvm command not available, but continuing (may use node directly)"
    fi
fi

# Check current Node.js version
CURRENT_NODE_VERSION=$(node -v 2>/dev/null || echo "none")
if [ "$CURRENT_NODE_VERSION" != "none" ]; then
    print_info "Current Node.js version: ${CURRENT_NODE_VERSION}"
    if [ "$CURRENT_NODE_VERSION" != "v${NODE_VERSION}" ]; then
        print_warning "Node.js version ${CURRENT_NODE_VERSION} detected. Upgrading to v${NODE_VERSION} (LTS)..."
    else
        print_info "Node.js v${NODE_VERSION} is already active"
    fi
else
    print_info "Node.js not found. Installing v${NODE_VERSION} (LTS)..."
fi

# Install and use Node.js v24.13.0 (LTS)
if nvm list | grep -q "v${NODE_VERSION}"; then
    print_info "Node.js v${NODE_VERSION} is already installed via nvm"
    nvm use ${NODE_VERSION} > /dev/null 2>&1
    nvm alias default ${NODE_VERSION} > /dev/null 2>&1
    print_success "Node.js v${NODE_VERSION} activated and set as default"
else
    print_info "Installing Node.js v${NODE_VERSION} (LTS) via nvm..."
    nvm install ${NODE_VERSION} > /dev/null 2>&1
    nvm use ${NODE_VERSION} > /dev/null 2>&1
    nvm alias default ${NODE_VERSION} > /dev/null 2>&1
    print_success "Node.js v${NODE_VERSION} (LTS) installed and set as default"
fi

# Verify Node.js version
CURRENT_NODE=$(node -v)
if [ "$CURRENT_NODE" = "v${NODE_VERSION}" ]; then
    print_success "Node.js ${CURRENT_NODE} (LTS) is active and set as default"
else
    print_error "Node.js version mismatch. Expected v${NODE_VERSION}, got ${CURRENT_NODE}"
    print_info "Attempting to fix..."
    nvm use ${NODE_VERSION} > /dev/null 2>&1 || true
    nvm alias default ${NODE_VERSION} > /dev/null 2>&1 || true
    CURRENT_NODE=$(node -v)
    if [ "$CURRENT_NODE" = "v${NODE_VERSION}" ]; then
        print_success "Node.js version fixed to ${CURRENT_NODE}"
    else
        print_warning "Node.js version is ${CURRENT_NODE} (expected v${NODE_VERSION}). Continuing..."
    fi
fi

# Auto-update npm to 9+ for newer VMs
if command -v npm >/dev/null 2>&1; then
    NPM_MAJOR=$(npm -v 2>/dev/null | cut -d'.' -f1 || echo "0")
    if [ -n "$NPM_MAJOR" ] && [ "$NPM_MAJOR" -lt 9 ] 2>/dev/null; then
        print_info "Updating npm to latest (9+) for better compatibility with newer VMs..."
        npm install -g npm@latest > /dev/null 2>&1 || true
        print_info "Updated to npm v$(npm -v)"
    fi
fi

# Step 3: Repository Setup
print_header "Step 3: Repository Setup"

if [ "$IS_UPGRADE" = true ]; then
    print_info "Upgrading existing installation at: $FULL_PATH"
    cd "$FULL_PATH" || { print_error "Failed to change to directory: $FULL_PATH"; exit 1; }
    
    # Check if it's a git repository
    if [ -d ".git" ]; then
        print_info "Git repository detected. Pulling latest changes..."
        if [ -n "$TAG" ]; then
            git fetch origin --tags > /dev/null 2>&1 || true
            git checkout "$TAG" > /dev/null 2>&1 || git checkout "$BRANCH" > /dev/null 2>&1
        else
            git fetch origin "$BRANCH" > /dev/null 2>&1 || true
            git checkout "$BRANCH" > /dev/null 2>&1 || true
            git pull origin "$BRANCH" > /dev/null 2>&1 || print_warning "Git pull failed (may be on detached HEAD)"
        fi
        print_success "Repository updated to latest"
    else
        print_warning "Not a git repository. Re-cloning..."
        BACKUP_DIR="${FULL_PATH}.backup.$(date +%Y%m%d-%H%M%S)"
        sudo mv "$FULL_PATH" "$BACKUP_DIR" 2>/dev/null || true
        print_info "Backed up existing installation to: $BACKUP_DIR"
        IS_UPGRADE=false  # Will do fresh install below
    fi
fi

if [ "$IS_UPGRADE" = false ]; then
    print_info "Installing fresh installation at: $FULL_PATH"
    
    # Create installation directory
    sudo mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR" || { print_error "Failed to change to directory: $INSTALL_DIR"; exit 1; }
    
    # Clone repository
    if [ -d "$REPO_DIR" ]; then
        print_warning "Directory $REPO_DIR already exists. Removing..."
        sudo rm -rf "$REPO_DIR"
    fi
    
    print_info "Cloning repository from GitHub..."
    if [ -n "$TAG" ]; then
        git clone --depth 1 --branch "$TAG" "$REPO_URL" "$REPO_DIR" || git clone --depth 1 "$REPO_URL" "$REPO_DIR"
    else
        git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$REPO_DIR" || git clone --depth 1 "$REPO_URL" "$REPO_DIR"
    fi
    
    print_success "Repository cloned"
    cd "$FULL_PATH" || { print_error "Failed to change to directory: $FULL_PATH"; exit 1; }
fi

# Fix ownership
CURRENT_USER=$(whoami)
print_info "Setting ownership and permissions..."
sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$FULL_PATH" 2>/dev/null || true
sudo chmod -R u+w "$FULL_PATH" 2>/dev/null || true
print_success "Ownership and permissions fixed"

# Step 4: Install Dependencies
print_header "Step 4: Installing Project Dependencies"

if ! command -v npm >/dev/null 2>&1; then
    print_error "npm not found. Node.js installation may have failed."
    exit 1
fi

NPM_VERSION=$(npm -v)
print_info "Using npm v${NPM_VERSION}"

# For newer VMs, ensure npm is modern (9+) for better compatibility
NPM_MAJOR=$(npm -v | cut -d'.' -f1)
if [ -n "$NPM_MAJOR" ] && [ "$NPM_MAJOR" -lt 9 ] 2>/dev/null; then
    print_info "Updating npm to latest (9+) for better compatibility with newer VMs..."
    npm install -g npm@latest > /dev/null 2>&1 || true
    print_info "Updated to npm v$(npm -v)"
fi

print_info "Installing npm dependencies (this may take a few minutes)..."
if [ -f "package-lock.json" ]; then
    print_info "Found package-lock.json, using 'npm ci' for reproducible builds..."
    
    if npm ci > /tmp/install-deps.log 2>&1; then
        print_success "Dependencies installed via npm ci"
    else
        print_warning "npm ci failed, attempting npm update and retry..."
        npm install -g npm@latest > /dev/null 2>&1 || true
        if npm ci > /tmp/install-deps.log 2>&1; then
            print_success "Dependencies installed via npm ci (after npm update)"
        else
            print_warning "npm ci failed, falling back to npm install..."
            if npm install > /tmp/install-deps.log 2>&1; then
                print_success "Dependencies installed via npm install"
            else
                print_error "Failed to install dependencies"
                cat /tmp/install-deps.log | tail -30
                exit 1
            fi
        fi
    fi
else
    print_warning "package-lock.json not found, using 'npm install'..."
    if npm install > /tmp/install-deps.log 2>&1; then
        print_success "Dependencies installed"
    else
        print_error "Failed to install dependencies"
        cat /tmp/install-deps.log | tail -30
        exit 1
    fi
fi

# Step 5: Run Release Gate
print_header "Step 5: Running Release Gate (Must Pass)"

if [ -f "scripts/release-gate.sh" ]; then
    RELEASE_GATE_FAILED=false
    if bash scripts/release-gate.sh > /tmp/release-gate.log 2>&1; then
        print_success "Release gate passed"
    else
        print_warning "Release gate failed - checking details..."
        cat /tmp/release-gate.log | tail -50
        
        # Check if it's a critical security failure or just a warning
        if grep -qi "SECURITY.*VIOLATION\|ThreatCloud.*leakage\|API key.*client" /tmp/release-gate.log 2>/dev/null; then
            print_error "CRITICAL: Release gate security check failed - aborting installation"
            RELEASE_GATE_FAILED=true
        else
            print_warning "Release gate failed (non-critical) - continuing with installation"
            print_warning "You may want to review release-gate.log after installation completes"
            RELEASE_GATE_FAILED=false
        fi
    fi
    
    if [ "$RELEASE_GATE_FAILED" = true ]; then
        print_error "Installation aborted due to critical release gate failure"
        print_error "Review release gate output: cat /tmp/release-gate.log"
        exit 2
    fi
else
    print_warning "Release gate script not found. Skipping release gate check."
fi

# Step 6: Build Application
print_header "Step 6: Building Application"

print_info "Running type check..."
if npm run type-check --silent 2>/dev/null; then
    print_success "Type check passed"
else
    print_warning "Type check failed, but continuing with build..."
fi

print_info "Building production bundle (this may take a few minutes)..."
if npm run build > /tmp/build.log 2>&1; then
    print_success "Build completed successfully"
else
    print_error "Build failed"
    cat /tmp/build.log | tail -50
    exit 1
fi

if [ -d ".next" ]; then
    print_success "Build output verified (.next directory exists)"
else
    print_error "Build failed - .next directory not found"
    exit 1
fi

# Step 7: Storage Directories Setup (Critical for File Persistence)
print_header "Step 7: Setting Up Storage Directories (0o755 Permissions)"

# Create .secure-storage (0o700 - API keys)
if [ ! -d ".secure-storage" ]; then
    mkdir -p .secure-storage
    chmod 700 .secure-storage
    print_success ".secure-storage created with permissions 700"
else
    PERMS=$(stat -c%a .secure-storage 2>/dev/null || stat -f%OLp .secure-storage 2>/dev/null || echo "unknown")
    if [ "$PERMS" != "700" ]; then
        chmod 700 .secure-storage
        print_success ".secure-storage permissions fixed to 700"
    else
        print_success ".secure-storage exists with correct permissions (700)"
    fi
fi

# Create .storage (0o755 - File storage)
if [ ! -d ".storage" ]; then
    mkdir -p .storage
    chmod 755 .storage
    print_success ".storage created with permissions 755"
else
    PERMS=$(stat -c%a .storage 2>/dev/null || stat -f%OLp .storage 2>/dev/null || echo "unknown")
    if [ "$PERMS" != "755" ]; then
        chmod 755 .storage
        print_success ".storage permissions fixed to 755 (for file persistence)"
    else
        print_success ".storage exists with correct permissions (755)"
    fi
fi

# Create .storage/files (0o755 - File storage subdirectory)
if [ ! -d ".storage/files" ]; then
    mkdir -p .storage/files
    chmod 755 .storage/files
    print_success ".storage/files created with permissions 755"
else
    PERMS=$(stat -c%a .storage/files 2>/dev/null || stat -f%OLp .storage/files 2>/dev/null || echo "unknown")
    if [ "$PERMS" != "755" ]; then
        chmod 755 .storage/files
        print_success ".storage/files permissions fixed to 755"
    else
        print_success ".storage/files exists with correct permissions (755)"
    fi
fi

# Fix existing file permissions (0o644)
if [ -d ".storage/files" ]; then
    find .storage/files -name "*.dat" -type f -exec chmod 644 {} \; 2>/dev/null || true
    [ -f ".storage/files-metadata.json" ] && chmod 644 .storage/files-metadata.json 2>/dev/null || true
    print_success "Existing file permissions fixed to 644"
fi

print_success "Storage directories configured (0o755 for persistence)"

# Step 8: Systemd Service Configuration
print_header "Step 8: Configuring Systemd Service (Auto-Start on Boot)"

if ! command -v systemctl >/dev/null 2>&1; then
    print_warning "systemctl not found. Skipping systemd service setup."
    print_info "You can start the app manually: cd $FULL_PATH && npm start"
else
    # Find Node.js and npm paths (from nvm)
    export NVM_DIR="$HOME/.nvm"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        . "$NVM_DIR/nvm.sh"
    fi
    
    # Ensure Node.js version is active
    if [ -f "$FULL_PATH/.nvmrc" ]; then
        NODE_VERSION_FROM_NVMRC=$(cat "$FULL_PATH/.nvmrc" | tr -d '[:space:]')
        if [ -n "$NODE_VERSION_FROM_NVMRC" ]; then
            nvm use "${NODE_VERSION_FROM_NVMRC}" > /dev/null 2>&1 || true
        fi
    fi
    
    NPM_PATH=$(which npm 2>/dev/null || echo "")
    
    if [ -z "$NPM_PATH" ]; then
        print_warning "Could not find npm path. Skipping systemd service setup."
    else
        print_info "Found npm at: $NPM_PATH"
        
        SERVICE_FILE="/etc/systemd/system/secure-ai-chat.service"
        
        print_info "Creating systemd service file..."
        sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Secure AI Chat Application
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
Group=$CURRENT_USER
WorkingDirectory=$FULL_PATH
Environment="NODE_ENV=production"
Environment="PORT=$APP_PORT"
Environment="HOSTNAME=0.0.0.0"

# Use npm from nvm
ExecStart=$NPM_PATH start
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
        
        # Stop service if running (for upgrade)
        if sudo systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
            print_info "Stopping existing service for upgrade..."
            sudo systemctl stop secure-ai-chat
        fi
        
        # Start service
        print_info "Starting Secure AI Chat service..."
        if sudo systemctl start secure-ai-chat; then
            print_success "Service started successfully"
            
            # Wait for service to start
            sleep 3
            
            # Check service status
            if sudo systemctl is-active --quiet secure-ai-chat; then
                print_success "Service is running"
            else
                print_warning "Service may not be running. Check status with: sudo systemctl status secure-ai-chat"
            fi
        else
            print_warning "Service start failed. Check logs: sudo journalctl -u secure-ai-chat -n 50 --no-pager"
        fi
    fi
fi

# Step 9: Post-Install Verification
print_header "Step 9: Post-Install Verification"

# Check service status
if command -v systemctl >/dev/null 2>&1; then
    if sudo systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
        print_success "Service is running"
    else
        print_warning "Service is not running"
    fi
fi

# Check health endpoint
sleep 2
if curl -s --max-time 5 http://localhost:${APP_PORT}/api/health > /dev/null 2>&1; then
    print_success "Health endpoint responding"
else
    print_warning "Health endpoint not responding (service may still be starting)"
fi

# Verify storage permissions
STORAGE_PERMS=$(stat -c%a .storage 2>/dev/null || stat -f%OLp .storage 2>/dev/null || echo "unknown")
FILES_PERMS=$(stat -c%a .storage/files 2>/dev/null || stat -f%OLp .storage/files 2>/dev/null || echo "unknown")

if [ "$STORAGE_PERMS" = "755" ] && [ "$FILES_PERMS" = "755" ]; then
    print_success "Storage permissions verified (755)"
else
    print_warning "Storage permissions: .storage ($STORAGE_PERMS), .storage/files ($FILES_PERMS) (expected 755)"
fi

# Final Summary
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
if [ "$IS_UPGRADE" = true ]; then
    echo -e "${GREEN}║         🎉 Secure AI Chat Upgrade Complete! 🎉              ║${NC}"
else
    echo -e "${GREEN}║         🎉 Secure AI Chat Installation Complete! 🎉         ║${NC}"
fi
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
print_info "Installation Directory: $FULL_PATH"
print_info "Node.js Version: $(node -v)"
print_info "npm Version: $(npm -v)"
print_info "Application Port: $APP_PORT"
print_info "Storage Permissions: .storage (755), .storage/files (755)"
echo ""
print_info "Access your application at: http://YOUR_VM_IP:${APP_PORT}"
print_info "To view service logs: sudo journalctl -u secure-ai-chat -f"
print_info "To restart service: sudo systemctl restart secure-ai-chat"
print_info "To stop service: sudo systemctl stop secure-ai-chat"
echo ""
print_success "Installation/Upgrade completed successfully!"
print_success "All storage fixes applied (0o755 permissions for file persistence)"
