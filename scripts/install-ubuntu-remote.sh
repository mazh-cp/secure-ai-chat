#!/bin/bash

# Secure AI Chat - Ubuntu Remote Installation Script
# For remote Ubuntu/Debian systems
# 
# This script is based on the functional local install-ubuntu.sh
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-remote.sh | bash
#   wget -qO- https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-remote.sh | bash

set -eo pipefail
# Note: -u is disabled to allow environment variables with defaults to work properly
# when script is executed remotely via curl/wget | bash

# Configuration
REPO_URL="https://github.com/mazh-cp/secure-ai-chat.git"
REPO_DIR="${REPO_DIR:-secure-ai-chat}"
BRANCH="${BRANCH:-main}"
TAG="${TAG:-}"  # Optional: specify tag (e.g., v1.0.11) to checkout instead of branch
NODE_VERSION="${NODE_VERSION:-24.13.0}"
APP_PORT="${PORT:-3000}"
INSTALL_DIR="${INSTALL_DIR:-$HOME}"

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

print_header "Secure AI Chat - Ubuntu Remote Installation Script"
echo "This script will:"
echo "  1. Install system dependencies"
echo "  2. Install Node.js ${NODE_VERSION} via nvm"
echo "  3. Clone the repository"
echo "  4. Install project dependencies"
echo "  5. Set up environment configuration"
echo "  6. Build the application"
echo "  7. Configure automatic startup (systemd service)"
echo ""

# Check if running in non-interactive mode (piped input)
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

# Step 1: Detect OS and Update System Packages
print_header "Step 1: Detecting OS and Updating System Packages"

# Detect OS version for better compatibility (matching local install-ubuntu.sh)
OS_ID="unknown"
OS_VERSION="unknown"
if [ -f /etc/os-release ]; then
    # shellcheck source=/dev/null
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
    # Check minimum version (Ubuntu 20.04+ or Debian 11+ recommended)
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

print_info "Updating package list..."
if sudo apt-get update -qq; then
    print_success "Package list updated"
else
    print_warning "Package update had issues, continuing..."
fi

print_info "Installing required system packages..."
# Install essential packages for newer VMs
PACKAGES=(
    curl
    git
    build-essential
    ca-certificates
    gnupg
    lsb-release
    iproute2
)

# Check which packages are missing
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
        print_error "Failed to install some packages: ${MISSING_PKGS[*]}"
        print_info "Attempting individual package installation..."
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

# Verify critical packages (build-essential is a meta-package, check via dpkg only)
MISSING_CRITICAL=()

# Check curl (has command)
if ! command -v curl >/dev/null 2>&1 && ! dpkg -l | grep -q "^ii  curl "; then
    MISSING_CRITICAL+=("curl")
fi

# Check git (has command)
if ! command -v git >/dev/null 2>&1 && ! dpkg -l | grep -q "^ii  git "; then
    MISSING_CRITICAL+=("git")
fi

# Check build-essential (meta-package, check via dpkg only)
# Use multiple patterns to handle variations in dpkg output format
if ! dpkg -l 2>/dev/null | grep -E "^ii[[:space:]]+build-essential[[:space:]]" >/dev/null 2>&1; then
    # Try alternative pattern (some systems use tabs instead of spaces)
    if ! dpkg -l 2>/dev/null | grep -E "^ii[[:space:]\t]+build-essential" >/dev/null 2>&1; then
        # Final check: just look for the package name in installed packages
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

# Note: ss (socket statistics) is part of iproute2 and is preferred over netstat
# To install netstat: sudo apt install net-tools
print_success "System packages verified"

# Step 2: Install/Upgrade Node.js to v24.13.0 via nvm
print_header "Step 2: Installing/Upgrading Node.js to ${NODE_VERSION} (LTS) via nvm"

# Install nvm if not already installed (with better error handling for newer VMs)
if [ ! -d "$HOME/.nvm" ]; then
    print_info "Installing nvm (Node Version Manager)..."
    # Use latest stable nvm version for newer VMs
    NVM_VERSION="${NVM_VERSION:-v0.39.7}"
    if curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash > /dev/null 2>&1; then
        print_success "nvm ${NVM_VERSION} installed"
    else
        print_error "Failed to install nvm. Check internet connection."
        exit 1
    fi
else
    print_info "nvm is already installed"
    # Update nvm to latest if possible (non-blocking for newer systems)
    if [ -d "$HOME/.nvm/.git" ]; then
        print_info "Checking for nvm updates..."
        (cd "$HOME/.nvm" && git fetch --tags origin > /dev/null 2>&1 && git checkout "$(git describe --abbrev=0 --tags --match 'v[0-9]*' "$(git rev-list --tags --max-count=1)")" > /dev/null 2>&1) || true
    fi
fi

# Load nvm with better error handling for newer systems
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    print_success "nvm loaded"
else
    print_error "nvm installation appears incomplete. $NVM_DIR/nvm.sh not found."
    exit 1
fi

# Verify nvm is working (for newer systems that may need additional setup)
if ! command -v nvm >/dev/null 2>&1; then
    # Try sourcing bashrc/profile for newer systems
    if [ -f "$HOME/.bashrc" ]; then
        # shellcheck source=/dev/null
        . "$HOME/.bashrc" 2>/dev/null || true
    fi
    if [ -f "$HOME/.profile" ]; then
        # shellcheck source=/dev/null
        . "$HOME/.profile" 2>/dev/null || true
    fi
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        # shellcheck source=/dev/null
        . "$NVM_DIR/nvm.sh"
    fi
    # Verify again
    if ! command -v nvm >/dev/null 2>&1; then
        print_warning "nvm command not available, but continuing (may use node directly)"
    fi
fi

# Check current Node.js version (if any)
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

# Install and use Node.js v24.13.0 (LTS) - always ensure it's installed and set as default
if nvm list | grep -q "v${NODE_VERSION}"; then
    print_info "Node.js v${NODE_VERSION} is already installed"
    nvm use ${NODE_VERSION} > /dev/null 2>&1
    nvm alias default ${NODE_VERSION} > /dev/null 2>&1
    print_success "Node.js v${NODE_VERSION} is now active"
else
    print_info "Installing Node.js v${NODE_VERSION}..."
    nvm install ${NODE_VERSION} > /dev/null 2>&1
    nvm use ${NODE_VERSION} > /dev/null 2>&1
    nvm alias default ${NODE_VERSION} > /dev/null 2>&1
    print_success "Node.js v${NODE_VERSION} installed and set as default"
fi

# Verify installation
NODE_VER=$(node -v)
NPM_VER=$(npm -v)
print_success "Node.js ${NODE_VER} and npm ${NPM_VER} verified"

# Step 3: Clone or update repository
print_header "Step 3: Cloning/Updating Repository"
FULL_PATH="${INSTALL_DIR}/${REPO_DIR}"

if [ -d "$FULL_PATH" ]; then
    if [ -d "$FULL_PATH/.git" ]; then
        print_info "Repository exists, updating..."
        cd "$FULL_PATH"
        git fetch origin --tags -q
        if [ -n "$TAG" ]; then
            print_info "Checking out tag: $TAG"
            git checkout "$TAG" -q || {
                print_error "Tag $TAG not found"
                exit 1
            }
        else
            git checkout "$BRANCH" -q || git checkout -b "$BRANCH" origin/"$BRANCH" 2>/dev/null || true
            git pull origin "$BRANCH" -q || true
        fi
        print_success "Repository updated to ${TAG:-$BRANCH}"
    else
        print_warning "Directory exists but is not a git repository. Removing and cloning fresh..."
        cd "$INSTALL_DIR"
        rm -rf "$REPO_DIR"
        if [ -n "$TAG" ]; then
            print_info "Cloning repository with tag: $TAG"
            git clone --branch "$TAG" --depth 1 "$REPO_URL" "$REPO_DIR" -q || {
                print_error "Failed to clone tag $TAG. Trying full clone..."
                git clone "$REPO_URL" "$REPO_DIR" -q
                cd "$REPO_DIR"
                git checkout "$TAG" -q || {
                    print_error "Tag $TAG not found"
                    exit 1
                }
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
        git clone --branch "$TAG" --depth 1 "$REPO_URL" "$REPO_DIR" -q || {
            print_warning "Shallow clone failed for tag. Trying full clone..."
            git clone "$REPO_URL" "$REPO_DIR" -q
            cd "$REPO_DIR"
            git checkout "$TAG" -q || {
                print_error "Tag $TAG not found. Available tags:"
                git tag -l | tail -10
                exit 1
            }
        }
    else
        git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$REPO_DIR" -q
    fi
    print_success "Repository cloned to $FULL_PATH"
fi

cd "$FULL_PATH"

# Load nvm again after cd (in case it's a new shell context)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node version from .nvmrc if it exists
if [ -f ".nvmrc" ]; then
    NODE_VERSION_FROM_NVMRC=$(cat .nvmrc | tr -d '[:space:]')
    print_info "Using Node.js v${NODE_VERSION_FROM_NVMRC} from .nvmrc..."
    nvm use ${NODE_VERSION_FROM_NVMRC} > /dev/null 2>&1 || nvm install ${NODE_VERSION_FROM_NVMRC} > /dev/null 2>&1
    nvm use ${NODE_VERSION_FROM_NVMRC} > /dev/null 2>&1
fi

# Step 4: Install dependencies
print_header "Step 4: Installing Dependencies"

# Verify npm is available before installing dependencies
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

print_info "Installing project dependencies (this may take a few minutes)..."
if [ -f "pnpm-lock.yaml" ]; then
    if ! command -v pnpm &> /dev/null; then
        print_info "pnpm not found. Installing pnpm..."
        npm install -g pnpm > /dev/null 2>&1
    fi
    pnpm install --frozen-lockfile
elif [ -f "yarn.lock" ]; then
    if ! command -v yarn &> /dev/null; then
        print_info "yarn not found. Installing yarn..."
        npm install -g yarn > /dev/null 2>&1
    fi
    yarn install --frozen-lockfile || yarn install --immutable || yarn install
elif [ -f "package-lock.json" ]; then
    print_info "Found package-lock.json, using 'npm ci' for reproducible builds..."
    if npm ci 2>&1; then
        print_success "Dependencies installed via npm ci"
    else
        print_warning "npm ci failed (package-lock.json may be out of sync with newer npm)"
        print_info "Attempting to fix with npm update and retry..."
        
        # Update npm to latest for better compatibility
        npm install -g npm@latest > /dev/null 2>&1 || true
        
        # Try npm ci again after npm update
        if npm ci 2>&1; then
            print_success "Dependencies installed via npm ci (after npm update)"
        else
            print_info "Falling back to 'npm install' to update package-lock.json..."
            if npm install 2>&1; then
                print_success "Dependencies installed and package-lock.json updated"
                print_warning "package-lock.json was updated - commit this file to repository"
            else
                print_error "Failed to install dependencies"
                print_error "This may indicate:"
                print_error "  1. Network connectivity issues"
                print_error "  2. Insufficient disk space"
                print_error "  3. Node.js/npm version incompatibility"
                print_error "  4. Outdated package-lock.json incompatible with newer npm"
                exit 1
            fi
        fi
    fi
else
    print_warning "package-lock.json not found, using 'npm install'..."
    if npm install 2>&1; then
        print_success "Dependencies installed"
        print_warning "package-lock.json was created - commit this file to repository"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
fi

# Step 5: Set up environment configuration
print_header "Step 5: Setting Up Environment Configuration"

if [ ! -f ".env.local" ]; then
    print_info "Creating .env.local file..."
    cat > .env.local << EOF
# Secure AI Chat - Environment Configuration
# Add your API keys here

OPENAI_API_KEY=
LAKERA_AI_KEY=
LAKERA_ENDPOINT=https://api.lakera.ai/v2/guard
LAKERA_PROJECT_ID=
NEXT_PUBLIC_APP_NAME=Secure AI Chat
NEXT_PUBLIC_APP_VERSION=0.1.0
PORT=${APP_PORT}
HOSTNAME=0.0.0.0
EOF
    print_success ".env.local created"
else
    print_info ".env.local already exists, skipping..."
fi

# Ensure HOSTNAME is set to 0.0.0.0 for public access
if ! grep -q "^HOSTNAME=" .env.local; then
    print_info "Adding HOSTNAME=0.0.0.0 to existing .env.local for public access..."
    echo "HOSTNAME=0.0.0.0" >> .env.local
    print_success "HOSTNAME added to .env.local"
elif grep -q "^HOSTNAME=127.0.0.1" .env.local || grep -q "^HOSTNAME=localhost" .env.local; then
    print_warning "HOSTNAME is set to localhost/127.0.0.1. Updating to 0.0.0.0 for public access..."
    sed -i 's/^HOSTNAME=.*/HOSTNAME=0.0.0.0/' .env.local
    print_success "HOSTNAME updated to 0.0.0.0"
fi

print_warning "Please edit .env.local and add your API keys before running the application"

# Step 6: Build the application
print_header "Step 6: Building Application"

print_info "Running type check..."
if npm run type-check --silent 2>/dev/null; then
    print_success "Type check passed"
else
    print_warning "Type check failed or not configured, continuing with build..."
fi

print_info "Building production bundle (this may take a few minutes)..."
npm run build

if [ -d ".next" ]; then
    print_success "Application built successfully"
else
    print_error "Build failed - .next directory not found"
    exit 1
fi

# Step 7: Configure systemd Service for Automatic Startup
print_header "Step 7: Configuring Automatic Startup (systemd)"

# Find Node.js and npm paths
NODE_PATH=$(which node 2>/dev/null || echo "")
NPM_PATH=$(which npm 2>/dev/null || echo "")

if [ -z "$NODE_PATH" ] || [ -z "$NPM_PATH" ]; then
    # Try to find nvm paths
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    NODE_PATH=$(which node 2>/dev/null || echo "")
    NPM_PATH=$(which npm 2>/dev/null || echo "")
fi

if [ -n "$NPM_PATH" ]; then
    print_info "Found npm at: $NPM_PATH"
    
    # Get current user
    CURRENT_USER=$(whoami)
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

# Use npm from nvm - source nvm and use node
Environment="NVM_DIR=$HOME/.nvm"
Environment="PATH=$HOME/.nvm/versions/node/v${NODE_VERSION}/bin:/usr/local/bin:/usr/bin:/bin"

# ExecStart with nvm loading
ExecStart=/bin/bash -c 'source \$HOME/.nvm/nvm.sh && nvm use ${NODE_VERSION} && cd $FULL_PATH && npm start'
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
        sleep 3
        
        # Check service status
        if sudo systemctl is-active --quiet secure-ai-chat; then
            print_success "Service is running"
        else
            print_warning "Service may not be running. Check status with: sudo systemctl status secure-ai-chat"
        fi
    else
        print_warning "Failed to start service automatically. You can start it manually with: sudo systemctl start secure-ai-chat"
    fi
else
    print_warning "Could not find npm path. Skipping systemd service setup."
    print_info "You can manually create the service file or start the app with: cd $FULL_PATH && npm start"
fi

# Final summary
print_header "Installation Complete!"
echo ""
print_success "Secure AI Chat has been installed successfully!"
echo ""
echo "📁 Installation directory: $FULL_PATH"
echo "📦 Node.js version: $(node -v)"
echo "📦 npm version: $(npm -v)"
echo ""
echo "📝 Next steps:"
echo "   1. Edit .env.local and add your API keys:"
echo "      - OPENAI_API_KEY"
echo "      - LAKERA_AI_KEY (optional)"
echo "      - LAKERA_PROJECT_ID (optional)"
echo ""
if command -v systemctl &> /dev/null && sudo systemctl is-enabled secure-ai-chat &> /dev/null; then
    echo "   2. Application Status:"
    echo "      ✅ Service is enabled and should start automatically on boot"
    echo "      Check status: sudo systemctl status secure-ai-chat"
    echo "      View logs: sudo journalctl -u secure-ai-chat -f"
    echo "      Restart: sudo systemctl restart secure-ai-chat"
    echo ""
    echo "   3. Access the application:"
    echo "      http://localhost:${APP_PORT} (local)"
    echo "      http://$(hostname -I | awk '{print $1}'):${APP_PORT} (network)"
    echo ""
    echo "   📋 Note: The application is already running and will auto-start on reboot"
else
    echo "   2. Start the application:"
    echo "      cd $FULL_PATH"
    echo "      npm start"
    echo "      (Or configure systemd service manually)"
    echo ""
    echo "   3. Access the application:"
    echo "      http://localhost:${APP_PORT} (local)"
    echo "      http://$(hostname -I | awk '{print $1}'):${APP_PORT} (network)"
    echo ""
fi
echo "📚 For more information, see the README.md file."
echo ""
