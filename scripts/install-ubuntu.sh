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
NODE_VERSION="${NODE_VERSION:-20}"
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
echo "  2. Install Node.js ${NODE_VERSION}.x"
echo "  3. Clone the repository"
echo "  4. Install project dependencies"
echo "  5. Set up environment configuration"
echo "  6. Build the application"
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
    > /dev/null 2>&1

print_success "System packages installed"

# Step 2: Install Node.js
print_header "Step 2: Installing Node.js ${NODE_VERSION}.x"

if command -v node &> /dev/null; then
    CURRENT_NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$CURRENT_NODE_VERSION" -ge "$NODE_VERSION" ]; then
        print_success "Node.js $(node -v) already installed"
        NODE_INSTALLED=true
    else
        print_warning "Node.js version $CURRENT_NODE_VERSION is installed, but version ${NODE_VERSION}+ is required"
        NODE_INSTALLED=false
    fi
else
    NODE_INSTALLED=false
fi

if [ "$NODE_INSTALLED" = false ]; then
    print_info "Installing Node.js ${NODE_VERSION}.x from NodeSource..."
    
    # Remove old NodeSource setup if exists
    sudo rm -f /etc/apt/sources.list.d/nodesource.list
    
    # Add NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash - > /dev/null 2>&1
    
    # Install Node.js
    sudo apt-get install -y -qq nodejs > /dev/null 2>&1
    
    print_success "Node.js $(node -v) installed"
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
        git fetch origin -q
        git checkout "$BRANCH" -q
        git pull origin "$BRANCH" -q
        print_success "Repository updated"
    else
        print_warning "Directory exists but is not a git repository. Removing and cloning fresh..."
        cd "$INSTALL_DIR"
        rm -rf "$REPO_DIR"
        git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$REPO_DIR" -q
        print_success "Repository cloned"
    fi
else
    print_info "Cloning repository..."
    cd "$INSTALL_DIR"
    git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$REPO_DIR" -q
    print_success "Repository cloned to $FULL_PATH"
fi

cd "$FULL_PATH"

# Step 4: Install project dependencies
print_header "Step 4: Installing Project Dependencies"

print_info "Installing npm dependencies (this may take a few minutes)..."
npm ci --silent

print_success "Dependencies installed"

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

# Step 7: Verification
print_header "Step 7: Verification"

# Check Node.js version
NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -ge 18 ]; then
    print_success "Node.js version: $(node -v) ✓"
else
    print_error "Node.js version too old: $(node -v) (requires 18+)"
    exit 1
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
echo "3. Start the application:"
echo "   cd $FULL_PATH"
echo "   npm run dev      # Development mode"
echo "   # OR"
echo "   npm start        # Production mode"
echo ""
echo "4. Access the application:"
echo "   http://localhost:${APP_PORT}"
echo ""
echo -e "${BLUE}For production deployment, consider:${NC}"
echo "   - Using a process manager like PM2"
echo "   - Setting up a reverse proxy (nginx)"
echo "   - Configuring SSL/TLS certificates"
echo "   - Setting up firewall rules"
echo ""
echo -e "${GREEN}Installation script completed successfully!${NC}"
