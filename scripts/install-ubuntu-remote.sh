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

# Step 2: Install/Upgrade Node.js to v24.13.0 via nvm
print_header "Step 2: Installing/Upgrading Node.js to ${NODE_VERSION} (LTS) via nvm"

# Install nvm if not already installed
if [ ! -d "$HOME/.nvm" ]; then
    print_info "Installing nvm (Node Version Manager)..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash > /dev/null 2>&1
    print_success "nvm installed"
else
    print_info "nvm is already installed"
fi

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

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
    npm ci
else
    npm install
fi

print_success "Dependencies installed"

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
