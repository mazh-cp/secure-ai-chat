#!/bin/bash
# Ubuntu VM Deployment Script for Secure AI Chat v1.0.7
# This script prepares an Ubuntu VM for production deployment
# Includes all latest fixes: permission handling, API key validation, ModelSelector fix

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Secure AI Chat v1.0.7 - Ubuntu VM Deployment            ║${NC}"
echo -e "${BLUE}║     Fresh Clean Install with All Latest Fixes               ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
REPO_URL="https://github.com/mazh-cp/secure-ai-chat.git"
REPO_DIR="/home/adminuser/secure-ai-chat"
BRANCH="${BRANCH:-main}"
NODE_VERSION="25.2.1"
SERVICE_NAME="secure-ai-chat"
SERVICE_USER="adminuser"
SERVICE_GROUP="adminuser"

# Step 1: Update OS packages
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Update OS packages${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y git curl ca-certificates ripgrep

echo -e "${GREEN}✅ OS packages updated${NC}"
echo ""

# Step 2: Install Node.js LTS (Node 25.2.1)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Install Node.js ${NODE_VERSION}${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if nvm is installed
if [ ! -d "$HOME/.nvm" ]; then
    echo "Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Install Node.js version
source "$HOME/.nvm/nvm.sh" || true
nvm install ${NODE_VERSION}
nvm use ${NODE_VERSION}
nvm alias default ${NODE_VERSION}

# Verify Node.js installation
NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo -e "${GREEN}✅ Node.js ${NODE_VER} installed${NC}"
echo -e "${GREEN}✅ npm ${NPM_VER} installed${NC}"
echo ""

# Step 3: Clone repository
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Clone repository${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -d "$REPO_DIR" ]; then
    echo "Repository already exists, fixing permissions and updating..."
    
    # Fix ownership and permissions if needed
    CURRENT_USER=$(whoami)
    if [ "$CURRENT_USER" != "$SERVICE_USER" ]; then
        echo "Fixing ownership to ${SERVICE_USER}:${SERVICE_GROUP}..."
        sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR" 2>/dev/null || true
    else
        chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR" 2>/dev/null || true
    fi
    
    # Ensure write permissions on .git directory
    chmod -R u+w "$REPO_DIR/.git" 2>/dev/null || sudo chmod -R u+w "$REPO_DIR/.git" 2>/dev/null || true
    
    cd "$REPO_DIR"
    
    # Stash any local changes if present
    git stash 2>/dev/null || true
    
    # Fetch and update
    git fetch origin
    git checkout ${BRANCH} 2>/dev/null || git checkout -b ${BRANCH} origin/${BRANCH}
    git pull origin ${BRANCH} || {
        echo -e "${YELLOW}⚠️  Pull failed, trying to reset to origin/${BRANCH}...${NC}"
        git fetch origin
        git reset --hard origin/${BRANCH}
    }
else
    echo "Cloning repository..."
    mkdir -p "$(dirname "$REPO_DIR")"
    
    # Ensure parent directory is owned by the service user
    PARENT_DIR="$(dirname "$REPO_DIR")"
    CURRENT_USER=$(whoami)
    if [ "$CURRENT_USER" != "$SERVICE_USER" ]; then
        sudo chown ${SERVICE_USER}:${SERVICE_GROUP} "$PARENT_DIR" 2>/dev/null || true
    fi
    
    # Clone as the service user
    if [ "$CURRENT_USER" != "$SERVICE_USER" ]; then
        sudo -u ${SERVICE_USER} git clone -b ${BRANCH} ${REPO_URL} ${REPO_DIR}
    else
        git clone -b ${BRANCH} ${REPO_URL} ${REPO_DIR}
    fi
    
    cd "$REPO_DIR"
fi

# Ensure proper ownership after clone/update
CURRENT_USER=$(whoami)
if [ "$CURRENT_USER" != "$SERVICE_USER" ]; then
    sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR"
else
    chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR"
fi

# Ensure proper permissions
chmod -R 755 "$REPO_DIR"
chmod -R u+w "$REPO_DIR/.git" 2>/dev/null || sudo chmod -R u+w "$REPO_DIR/.git" 2>/dev/null || true

echo -e "${GREEN}✅ Repository cloned/updated to ${BRANCH}${NC}"
echo ""

# Step 4: Fix Permissions Before Install
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4a: Fix Permissions${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd "$REPO_DIR"

# Ensure proper ownership before npm operations
echo "Setting ownership to $SERVICE_USER:$SERVICE_GROUP..."
sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR" 2>/dev/null || true

# Ensure write permissions
echo "Setting write permissions..."
sudo chmod -R u+w "$REPO_DIR" 2>/dev/null || true
sudo chmod 644 package.json 2>/dev/null || true
sudo chmod 644 package-lock.json 2>/dev/null || true

echo -e "${GREEN}✅ Permissions fixed${NC}"
echo ""

# Step 4: Install dependencies
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4b: Install Dependencies${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Set Node.js version for this session
# Source nvm for the service user
if [ -f "/home/${SERVICE_USER}/.nvm/nvm.sh" ]; then
    source "/home/${SERVICE_USER}/.nvm/nvm.sh" 2>/dev/null || true
    export PATH="/home/${SERVICE_USER}/.nvm/versions/node/v${NODE_VERSION}/bin:$PATH"
elif [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh" 2>/dev/null || true
    export PATH="$HOME/.nvm/versions/node/v${NODE_VERSION}/bin:$PATH"
fi

cd "$REPO_DIR"

# Install dependencies as the service user with proper environment
CURRENT_USER=$(whoami)
echo "Installing dependencies (this may take a few minutes)..."
if [ "$CURRENT_USER" != "$SERVICE_USER" ]; then
    sudo -u ${SERVICE_USER} env HOME="/home/${SERVICE_USER}" npm ci --production=false || {
        echo -e "${YELLOW}⚠️  npm ci failed, trying npm install...${NC}"
        # Fix permissions and retry
        sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR"
        sudo chmod -R u+w "$REPO_DIR"
        sudo -u ${SERVICE_USER} env HOME="/home/${SERVICE_USER}" npm install --production=false || {
            echo -e "${RED}❌ Failed to install dependencies${NC}"
            exit 1
        }
    }
else
    npm ci --production=false || {
        echo -e "${YELLOW}⚠️  npm ci failed, trying npm install...${NC}"
        npm install --production=false || {
            echo -e "${RED}❌ Failed to install dependencies${NC}"
            exit 1
        }
    }
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 5: Create production environment file
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5: Create production environment file${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ ! -f "$REPO_DIR/.env" ]; then
    sudo -u ${SERVICE_USER} tee "$REPO_DIR/.env" > /dev/null <<EOF
# Secure AI Chat v1.0.7 Production Configuration
# Generated by deploy-ubuntu-vm.sh

# Application
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# Optional: Check Point ThreatCloud / Threat Emulation API Key
# Can be set here or via Settings UI (recommended)
# CHECKPOINT_TE_API_KEY=your_api_key_here

# Optional: Encryption key for API key storage (if not set, uses default)
# CHECKPOINT_TE_ENCRYPTION_KEY=your_encryption_key_here

# Security
# Note: API keys should be configured via Settings UI after deployment
# This ensures proper encryption and server-side storage
EOF
    sudo chmod 600 "$REPO_DIR/.env"
    sudo chown ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR/.env"
    echo -e "${GREEN}✅ Production environment file created${NC}"
else
    echo -e "${YELLOW}⚠️  Environment file already exists, skipping${NC}"
fi
echo ""

# Step 6: Build application
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 6: Build Application${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd "$REPO_DIR"

# Clear any existing build cache
echo "Clearing build cache..."
rm -rf .next 2>/dev/null || true
echo -e "${GREEN}✅ Build cache cleared${NC}"

# Build as the service user
CURRENT_USER=$(whoami)
echo "Building application (this may take a few minutes)..."
if [ "$CURRENT_USER" != "$SERVICE_USER" ]; then
    sudo -u ${SERVICE_USER} env HOME="/home/${SERVICE_USER}" npm run build || {
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    }
else
    npm run build || {
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    }
fi

echo -e "${GREEN}✅ Application built successfully${NC}"
echo ""

# Step 7: Set Final Permissions
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 7: Set Final Permissions${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Set ownership
echo "Setting ownership to $SERVICE_USER:$SERVICE_GROUP..."
sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR"

# Set directory permissions
echo "Setting directory permissions..."
sudo chmod -R 755 "$REPO_DIR"
sudo chmod -R u+w "$REPO_DIR"

# Set file permissions
echo "Setting file permissions..."
sudo chmod 644 "$REPO_DIR/package.json" 2>/dev/null || true
sudo chmod 644 "$REPO_DIR/package-lock.json" 2>/dev/null || true
sudo chmod 600 "$REPO_DIR/.env" 2>/dev/null || true

# Set secure storage permissions (create if doesn't exist)
if [ -d "$REPO_DIR/.secure-storage" ]; then
    sudo chmod -R 700 "$REPO_DIR/.secure-storage"
    sudo chmod -R 600 "$REPO_DIR/.secure-storage"/* 2>/dev/null || true
else
    # Create with correct permissions
    sudo -u ${SERVICE_USER} mkdir -p "$REPO_DIR/.secure-storage"
    sudo chmod 700 "$REPO_DIR/.secure-storage"
fi

# Set storage permissions (create if doesn't exist)
if [ -d "$REPO_DIR/.storage" ]; then
    sudo chmod -R 755 "$REPO_DIR/.storage"
else
    # Create with correct permissions
    sudo -u ${SERVICE_USER} mkdir -p "$REPO_DIR/.storage"
    sudo chmod 755 "$REPO_DIR/.storage"
fi

echo -e "${GREEN}✅ Permissions set${NC}"
echo ""

# Step 8: Create systemd service
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 8: Create systemd service${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Source Node.js from nvm if available
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
    nvm use ${NODE_VERSION} || nvm alias default ${NODE_VERSION}
fi

NODE_PATH=$(which node || echo "/home/adminuser/.nvm/versions/node/v${NODE_VERSION}/bin/node")
NPM_PATH=$(which npm || echo "/home/adminuser/.nvm/versions/node/v${NODE_VERSION}/bin/npm")

# Ensure Node.js is in PATH
export PATH="$(dirname "$NODE_PATH"):$PATH"

sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" > /dev/null <<EOF
[Unit]
Description=Secure AI Chat Application
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${REPO_DIR}
Environment=NODE_ENV=production
Environment=PATH=${NODE_PATH%/*}:/usr/local/bin:/usr/bin:/bin
EnvironmentFile=${REPO_DIR}/.env
# Use npm start to handle Next.js server
ExecStart=${NPM_PATH} start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=secure-ai-chat

# Security
NoNewPrivileges=true
PrivateTmp=true
ReadWritePaths=${REPO_DIR}/.secure-storage ${REPO_DIR}/.next

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
echo -e "${GREEN}✅ Systemd service created${NC}"
echo ""

# Step 9: Enable and start service
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 9: Enable and start service${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

sudo systemctl enable ${SERVICE_NAME}
sudo systemctl start ${SERVICE_NAME}

# Wait a moment for service to start
sleep 3

# Check service status
if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}✅ Service started successfully${NC}"
else
    echo -e "${RED}❌ Service failed to start${NC}"
    sudo systemctl status ${SERVICE_NAME} --no-pager -l
    exit 1
fi
echo ""

# Step 10: Verification
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 10: Verification${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

sleep 3

echo "Service status:"
sudo systemctl status ${SERVICE_NAME} --no-pager -l | head -15
echo ""

# Health check
echo "Health check:"
if curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s http://localhost:3000/api/health | head -1)
    echo -e "${GREEN}✅ Health endpoint responding${NC}"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo -e "${YELLOW}⚠️  Health endpoint not responding yet (may take a few seconds)${NC}"
fi
echo ""

# Version check
echo "Version check:"
if curl -s -f http://localhost:3000/api/version > /dev/null 2>&1; then
    VERSION_RESPONSE=$(curl -s http://localhost:3000/api/version)
    VERSION_API=$(echo "$VERSION_RESPONSE" | grep -oE '"version":"[^"]+"' | cut -d'"' -f4 || echo "unknown")
    echo -e "${GREEN}✅ Version endpoint responding${NC}"
    echo "   Version: $VERSION_API"
else
    echo -e "${YELLOW}⚠️  Version endpoint not responding yet${NC}"
fi
echo ""

# Check critical pages
echo "Checking pages:"
PAGES=("/" "/release-notes" "/settings" "/files" "/dashboard")
for page in "${PAGES[@]}"; do
    if curl -s -f "http://localhost:3000${page}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC} $page"
    else
        echo -e "${YELLOW}⚠️${NC} $page (may need a moment)"
    fi
done
echo ""

echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              ✅ DEPLOYMENT COMPLETE                           ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Application: http://localhost:3000                           ║${NC}"
echo -e "${GREEN}║  Service:     ${SERVICE_NAME}                                      ║${NC}"
echo -e "${GREEN}║  Branch:       ${BRANCH}                           ║${NC}"
echo -e "${GREEN}║  Version:      v1.0.7                                            ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Features:                                                     ║${NC}"
echo -e "${GREEN}║  ✅ Release Notes page                                          ║${NC}"
echo -e "${GREEN}║  ✅ ModelSelector server-side storage                           ║${NC}"
echo -e "${GREEN}║  ✅ API key validation (placeholder detection)                  ║${NC}"
echo -e "${GREEN}║  ✅ Checkpoint TE improved error handling                       ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Next steps:                                                   ║${NC}"
echo -e "${GREEN}║  1. Configure API keys via Settings UI                        ║${NC}"
echo -e "${GREEN}║  2. Set up PIN for API key protection (optional)                ║${NC}"
echo -e "${GREEN}║  3. Test chat functionality                                    ║${NC}"
echo -e "${GREEN}║  4. Test file upload and scanning                              ║${NC}"
echo -e "${GREEN}║  5. Check Release Notes page                                    ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}Useful commands:${NC}"
echo "  sudo systemctl status ${SERVICE_NAME}"
echo "  sudo systemctl restart ${SERVICE_NAME}"
echo "  sudo journalctl -u ${SERVICE_NAME} -f"
echo "  curl http://localhost:3000/api/health"
echo "  curl http://localhost:3000/api/version"
echo ""
echo -e "${BLUE}Access the application:${NC}"
echo "  Local:   http://localhost:3000"
echo "  Network: http://\$(hostname -I | awk '{print \$1}'):3000"
echo ""
