#!/bin/bash

# Single-Step Installation Script for Secure AI Chat
# For Ubuntu/Debian systems
# 
# IMPORTANT: Before using this script remotely, ensure the repository is pushed to GitHub
# Run: ./scripts/push-to-github.sh
#
# Usage (after repo is on GitHub):
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
#   wget -qO- https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
#
# Usage (local file):
#   bash scripts/install-ubuntu.sh

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

print_header "Secure AI Chat - Ubuntu Installation Script"
echo "This script will:"
echo "  1. Install system dependencies"
echo "  2. Install Node.js ${NODE_VERSION} via nvm"
echo "  3. Clone the repository"
echo "  4. Install project dependencies"
echo "  5. Set up environment configuration"
echo "  6. Build the application"
echo "  7. Configure UFW firewall rules"
echo "  8. Verify installation"
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

# Detect OS version for better compatibility
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
    ok "OS detected: ${OS_ID} ${OS_VERSION}"
else
    print_warning "OS not recognized: ${OS_ID}. Continuing anyway..."
fi

print_info "Updating package list..."
if sudo apt-get update -qq; then
    ok "Package list updated"
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
        ok "System packages installed: ${MISSING_PKGS[*]}"
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
    ok "All required packages already installed"
fi

# Verify critical packages
MISSING_CRITICAL=()
for pkg in curl git build-essential; do
    if ! command -v "$pkg" >/dev/null 2>&1 && ! dpkg -l | grep -q "^ii  $pkg "; then
        MISSING_CRITICAL+=("$pkg")
    fi
done

if [ ${#MISSING_CRITICAL[@]} -gt 0 ]; then
    print_error "Critical packages missing: ${MISSING_CRITICAL[*]}"
    exit 1
fi

# Note: ss (socket statistics) is part of iproute2 and is preferred over netstat
# To install netstat: sudo apt install net-tools
print_success "System packages verified"

# Step 2: Install/Upgrade Node.js to v24.13.0 via nvm
print_header "Step 2: Installing/Upgrading Node.js to ${NODE_VERSION} (LTS) via nvm"

# Install nvm if not already installed
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
    ok "nvm loaded"
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
    nvm use ${NODE_VERSION} > /dev/null 2>&1
    nvm alias default ${NODE_VERSION} > /dev/null 2>&1
    CURRENT_NODE=$(node -v)
    if [ "$CURRENT_NODE" = "v${NODE_VERSION}" ]; then
        print_success "Node.js ${CURRENT_NODE} (LTS) is now active"
    else
        print_error "Failed to set Node.js v${NODE_VERSION}. Please check nvm installation."
        exit 1
    fi
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

# Step 4: Fix Permissions Before Install
print_header "Step 4a: Fixing Permissions"

# Ensure proper ownership and permissions before npm operations
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

# Step 4: Install project dependencies
print_header "Step 4b: Installing Project Dependencies"

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

print_info "Installing npm dependencies (this may take a few minutes)..."
if [ -f "package-lock.json" ]; then
    print_info "Found package-lock.json, using 'npm ci' for reproducible builds..."
    
    if npm ci 2>&1; then
        print_success "Dependencies installed via npm ci"
    else
        print_warning "npm ci failed (package-lock.json may be out of sync with newer npm)"
        print_info "Attempting to fix package-lock.json..."
        
        # Fix permissions and retry
        sudo chown -R $USER:$USER "$FULL_PATH" 2>/dev/null || true
        sudo chmod -R u+w "$FULL_PATH" 2>/dev/null || true
        
        # Update npm to latest for better compatibility with newer VMs
        print_info "Updating npm to latest for better compatibility..."
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
                print_info "Try manually: cd $FULL_PATH && npm install"
                exit 1
            fi
        fi
    fi
else
    print_warning "package-lock.json not found, using 'npm install'..."
    
    # For newer VMs, ensure npm is modern
    if [ -n "$NPM_MAJOR" ] && [ "$NPM_MAJOR" -lt 9 ] 2>/dev/null; then
        print_info "Updating npm to latest for better compatibility..."
        npm install -g npm@latest > /dev/null 2>&1 || true
    fi
    
    if npm install 2>&1; then
        print_success "Dependencies installed"
        print_warning "package-lock.json was created - commit this file to repository"
    else
        print_error "Failed to install dependencies"
        print_info "Try manually: cd $FULL_PATH && npm install"
        exit 1
    fi
fi

# Step 5: Set up environment configuration
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

# Step 6: Build the application
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

# Step 7: Configure UFW Firewall
print_header "Step 7: Configuring UFW Firewall"

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

# Allow application port (default 3000)
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
    # Use yes to automatically answer 'y' to enable prompt
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

# Create a wrapper script for starting the app with correct hostname
print_info "Creating start script with proper hostname binding..."

# Ensure we're in the correct directory
cd "$FULL_PATH" || {
    print_error "Failed to change to directory: $FULL_PATH"
    exit 1
}

# Ensure directory exists and is writable
if [ ! -d "$FULL_PATH" ]; then
    print_error "Directory does not exist: $FULL_PATH"
    exit 1
fi

if [ ! -w "$FULL_PATH" ]; then
    print_error "Directory is not writable: $FULL_PATH"
    exit 1
fi

cat > "$FULL_PATH/start-app.sh" << 'EOF'
#!/bin/bash
# Start script for Secure AI Chat
# Ensures the application binds to 0.0.0.0 for public access

cd "$(dirname "$0")"

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
    set -a  # automatically export all variables
    source .env.local 2>/dev/null || true
    set +a
fi

# Ensure HOSTNAME is set to 0.0.0.0 for public access (override any localhost setting)
export HOSTNAME=0.0.0.0
export PORT=${PORT:-3000}

echo "Starting Secure AI Chat on $HOSTNAME:$PORT..."
npm start
EOF

# Make script executable
if chmod +x "$FULL_PATH/start-app.sh"; then
    print_success "Start script created: $FULL_PATH/start-app.sh"
else
    print_warning "Failed to make start script executable, but file was created"
fi

# Step 8: Configure systemd Service for Automatic Startup
print_header "Step 8: Configuring Automatic Startup (systemd)"

# Check if systemd is available (for newer VMs)
if ! command -v systemctl >/dev/null 2>&1; then
    print_warning "systemctl not found. Skipping systemd service setup."
    print_info "This may be a non-systemd system (e.g., older Debian, container)."
    print_info "You can start the app manually: cd $FULL_PATH && ./start-app.sh"
    SKIP_SYSTEMD=true
else
    SKIP_SYSTEMD=false
fi

if [ "$SKIP_SYSTEMD" = false ]; then
    # Find Node.js and npm paths (for newer VMs, ensure we get nvm paths)
    export NVM_DIR="$HOME/.nvm"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        # shellcheck source=/dev/null
        . "$NVM_DIR/nvm.sh"
    fi
    
    # Ensure Node.js version is active
    if [ -f "$FULL_PATH/.nvmrc" ]; then
        NODE_VERSION_FROM_NVMRC=$(cat "$FULL_PATH/.nvmrc" | tr -d '[:space:]')
        if [ -n "$NODE_VERSION_FROM_NVMRC" ]; then
            nvm use "${NODE_VERSION_FROM_NVMRC}" > /dev/null 2>&1 || true
        fi
    fi
    
    NODE_PATH=$(which node 2>/dev/null || echo "")
    NPM_PATH=$(which npm 2>/dev/null || echo "")
    
    if [ -z "$NODE_PATH" ] || [ -z "$NPM_PATH" ]; then
        print_warning "Could not find Node.js/npm paths. Skipping systemd service setup."
        SKIP_SYSTEMD=true
    fi
fi

if [ "$SKIP_SYSTEMD" = false ] && [ -n "$NPM_PATH" ]; then
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
    print_info "You can manually create the service file or start the app with: cd $FULL_PATH && ./start-app.sh"
fi

# Step 9: Verification
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

# Final summary
print_header "Installation Complete!"

echo -e "${GREEN}✅ Secure AI Chat has been successfully installed!${NC}"
echo ""
echo "Installation directory: $FULL_PATH"
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. Configure environment variables:"
echo "   cd $FULL_PATH"
echo "   nano .env.local"
echo ""
echo "2. Add your API keys in .env.local:"
echo "   - OPENAI_API_KEY (required)"
echo "   - LAKERA_AI_KEY (optional, for security scanning)"
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
    echo "   ./start-app.sh       # Production mode (recommended)"
    echo "   # OR"
    echo "   npm start            # Production mode"
fi
echo ""
echo "4. Access the application:"
echo "   Local:   http://localhost:${APP_PORT}"
echo "   Network: http://\$(hostname -I | awk '{print \$1}'):${APP_PORT}"
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
echo "   (If you need netstat: sudo apt install net-tools)"
echo ""
echo -e "${BLUE}For production deployment, consider:${NC}"
echo "   - Using a process manager like PM2"
echo "   - Setting up a reverse proxy (nginx)"
echo "   - Configuring SSL/TLS certificates"
echo ""
echo -e "${GREEN}Installation script completed successfully!${NC}"
