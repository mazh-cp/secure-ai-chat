#!/bin/bash
# Fresh VM Installation Script for Secure AI Chat v1.0.7
# Complete installation with public IP access configuration
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fresh-install-vm.sh | sudo bash
#   OR
#   wget https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fresh-install-vm.sh
#   chmod +x fresh-install-vm.sh
#   sudo bash fresh-install-vm.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Secure AI Chat v1.0.7 - Fresh VM Installation            ║${NC}"
echo -e "${BLUE}║     With Public IP Access Configuration                     ║${NC}"
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
APP_PORT="3000"

# Detect public IP
PUBLIC_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "unknown")

echo -e "${BLUE}Configuration:${NC}"
echo "   Repository: $REPO_DIR"
echo "   Branch: $BRANCH"
echo "   Node Version: $NODE_VERSION"
echo "   Port: $APP_PORT"
echo "   Public IP: $PUBLIC_IP"
echo ""

# Step 1: Update OS packages
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 1: Update OS Packages${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

sudo apt-get update -qq
sudo apt-get upgrade -y -qq
sudo apt-get install -y -qq git curl ca-certificates ripgrep build-essential

echo -e "${GREEN}✅ OS packages updated${NC}"
echo ""

# Step 2: Install Node.js
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 2: Install Node.js ${NODE_VERSION}${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Install nvm if not installed
if [ ! -d "$HOME/.nvm" ]; then
    echo "Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash > /dev/null 2>&1
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    echo -e "${GREEN}✅ NVM installed${NC}"
else
    echo -e "${GREEN}✅ NVM already installed${NC}"
fi

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js version
if nvm list | grep -q "v${NODE_VERSION}"; then
    echo "Node.js v${NODE_VERSION} already installed"
    nvm use ${NODE_VERSION} > /dev/null 2>&1
else
    echo "Installing Node.js v${NODE_VERSION}..."
    nvm install ${NODE_VERSION} > /dev/null 2>&1
    nvm use ${NODE_VERSION} > /dev/null 2>&1
fi
nvm alias default ${NODE_VERSION} > /dev/null 2>&1

# Verify Node.js installation
NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo -e "${GREEN}✅ Node.js ${NODE_VER} installed${NC}"
echo -e "${GREEN}✅ npm ${NPM_VER} installed${NC}"
echo ""

# Step 3: Clone repository
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 3: Clone Repository${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -d "$REPO_DIR" ]; then
    echo "Repository already exists, updating..."
    cd "$REPO_DIR"
    git fetch origin
    git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" origin/"$BRANCH"
    git pull origin "$BRANCH" || {
        echo -e "${YELLOW}⚠️  Pull failed, resetting...${NC}"
        git fetch origin
        git reset --hard origin/"$BRANCH"
    }
    echo -e "${GREEN}✅ Repository updated${NC}"
else
    echo "Cloning repository..."
    mkdir -p "$(dirname "$REPO_DIR")"
    git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$REPO_DIR"
    echo -e "${GREEN}✅ Repository cloned${NC}"
fi

cd "$REPO_DIR"
echo ""

# Step 4: Fix Permissions
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 4: Fix Permissions${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR" 2>/dev/null || true
sudo chmod -R u+w "$REPO_DIR" 2>/dev/null || true
sudo chmod 644 package.json 2>/dev/null || true
sudo chmod 644 package-lock.json 2>/dev/null || true

echo -e "${GREEN}✅ Permissions fixed${NC}"
echo ""

# Step 5: Install Dependencies
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 5: Install Dependencies${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd "$REPO_DIR"

# Get npm path for service user
NPM_PATH=$(sudo -u ${SERVICE_USER} bash -c "source ~/.nvm/nvm.sh 2>/dev/null && nvm use ${NODE_VERSION} > /dev/null 2>&1 && which npm" 2>/dev/null || echo "")

if [ -z "$NPM_PATH" ]; then
    # Try alternative method
    NPM_PATH="/home/${SERVICE_USER}/.nvm/versions/node/v${NODE_VERSION}/bin/npm"
    if [ ! -f "$NPM_PATH" ]; then
        echo -e "${RED}❌ npm not found. Please ensure Node.js ${NODE_VERSION} is installed for ${SERVICE_USER}${NC}"
        echo "   Try running: sudo -u ${SERVICE_USER} bash -c 'source ~/.nvm/nvm.sh && nvm install ${NODE_VERSION}'"
        exit 1
    fi
fi

echo "Using npm: $NPM_PATH"
echo "Installing dependencies (this may take a few minutes)..."

# Install dependencies with proper nvm loading
sudo -u ${SERVICE_USER} bash -c "
    export NVM_DIR=\"/home/${SERVICE_USER}/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && source \"\$NVM_DIR/nvm.sh\"
    cd \"$REPO_DIR\"
    nvm use ${NODE_VERSION} > /dev/null 2>&1
    npm ci --production=false
" || {
    echo -e "${YELLOW}⚠️  npm ci failed, trying npm install...${NC}"
    sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR"
    sudo chmod -R u+w "$REPO_DIR"
    sudo -u ${SERVICE_USER} bash -c "
        export NVM_DIR=\"/home/${SERVICE_USER}/.nvm\"
        [ -s \"\$NVM_DIR/nvm.sh\" ] && source \"\$NVM_DIR/nvm.sh\"
        cd \"$REPO_DIR\"
        nvm use ${NODE_VERSION} > /dev/null 2>&1
        npm install --production=false
    " || {
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        echo ""
        echo "Troubleshooting:"
        echo "  1. Check if Node.js is installed: sudo -u ${SERVICE_USER} bash -c 'source ~/.nvm/nvm.sh && node -v'"
        echo "  2. Install Node.js if missing: sudo -u ${SERVICE_USER} bash -c 'source ~/.nvm/nvm.sh && nvm install ${NODE_VERSION}'"
        exit 1
    }
}

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 6: Create Environment File
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 6: Create Environment File${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ ! -f "$REPO_DIR/.env" ]; then
    sudo -u ${SERVICE_USER} tee "$REPO_DIR/.env" > /dev/null <<EOF
# Secure AI Chat v1.0.7 Production Configuration
# Generated by fresh-install-vm.sh

# Application
NODE_ENV=production
PORT=${APP_PORT}
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
    echo -e "${GREEN}✅ Environment file created with HOSTNAME=0.0.0.0${NC}"
else
    # Ensure HOSTNAME is set to 0.0.0.0
    if ! grep -q "^HOSTNAME=0.0.0.0" "$REPO_DIR/.env"; then
        if grep -q "^HOSTNAME=" "$REPO_DIR/.env"; then
            sudo sed -i 's/^HOSTNAME=.*/HOSTNAME=0.0.0.0/' "$REPO_DIR/.env"
        else
            echo "HOSTNAME=0.0.0.0" | sudo tee -a "$REPO_DIR/.env" > /dev/null
        fi
        echo -e "${GREEN}✅ Updated HOSTNAME to 0.0.0.0${NC}"
    else
        echo -e "${GREEN}✅ HOSTNAME already set to 0.0.0.0${NC}"
    fi
fi
echo ""

# Step 7: Build Application
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 7: Build Application${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd "$REPO_DIR"

# Clear build cache
rm -rf .next 2>/dev/null || true

echo "Building application (this may take a few minutes)..."
sudo -u ${SERVICE_USER} bash -c "
    export NVM_DIR=\"/home/${SERVICE_USER}/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && source \"\$NVM_DIR/nvm.sh\"
    cd \"$REPO_DIR\"
    nvm use ${NODE_VERSION} > /dev/null 2>&1
    npm run build
" || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
}

echo -e "${GREEN}✅ Application built successfully${NC}"
echo ""

# Step 8: Set Final Permissions
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 8: Set Final Permissions${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR"
sudo chmod -R 755 "$REPO_DIR"
sudo chmod -R u+w "$REPO_DIR"
sudo chmod 644 "$REPO_DIR/package.json" 2>/dev/null || true
sudo chmod 644 "$REPO_DIR/package-lock.json" 2>/dev/null || true
sudo chmod 600 "$REPO_DIR/.env" 2>/dev/null || true

# Create storage directories with correct permissions
sudo -u ${SERVICE_USER} mkdir -p "$REPO_DIR/.secure-storage" 2>/dev/null || true
sudo -u ${SERVICE_USER} mkdir -p "$REPO_DIR/.storage" 2>/dev/null || true
sudo chmod 700 "$REPO_DIR/.secure-storage" 2>/dev/null || true
sudo chmod 755 "$REPO_DIR/.storage" 2>/dev/null || true

echo -e "${GREEN}✅ Permissions set${NC}"
echo ""

# Step 9: Configure Firewall (UFW)
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 9: Configure Firewall${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if command -v ufw &> /dev/null; then
    echo "Configuring UFW firewall..."
    
    # Allow SSH
    if sudo ufw status | grep -q "22/tcp"; then
        echo -e "${GREEN}✅ SSH (port 22) already allowed${NC}"
    else
        sudo ufw allow 22/tcp > /dev/null 2>&1
        echo -e "${GREEN}✅ SSH (port 22) allowed${NC}"
    fi
    
    # Allow application port
    if sudo ufw status | grep -q "${APP_PORT}/tcp"; then
        echo -e "${GREEN}✅ Port ${APP_PORT}/tcp already allowed${NC}"
    else
        sudo ufw allow ${APP_PORT}/tcp > /dev/null 2>&1
        echo -e "${GREEN}✅ Port ${APP_PORT}/tcp allowed${NC}"
    fi
    
    # Enable UFW if not enabled
    if ! sudo ufw status | grep -q "Status: active"; then
        echo "y" | sudo ufw --force enable > /dev/null 2>&1
        echo -e "${GREEN}✅ UFW enabled${NC}"
    else
        sudo ufw reload > /dev/null 2>&1
        echo -e "${GREEN}✅ UFW rules reloaded${NC}"
    fi
    
    echo ""
    echo "Current UFW rules:"
    sudo ufw status numbered | head -10
    echo ""
else
    echo -e "${YELLOW}⚠️  UFW not installed, skipping firewall configuration${NC}"
    echo "   You may need to configure firewall manually or via cloud provider"
    echo ""
fi

# Step 10: Create Systemd Service
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 10: Create Systemd Service${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Find Node.js and npm paths
if [ -f "/home/${SERVICE_USER}/.nvm/nvm.sh" ]; then
    source "/home/${SERVICE_USER}/.nvm/nvm.sh" 2>/dev/null || true
elif [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh" 2>/dev/null || true
fi

NODE_PATH=$(sudo -u ${SERVICE_USER} bash -c "source ~/.nvm/nvm.sh 2>/dev/null && which node" 2>/dev/null || which node || echo "/home/${SERVICE_USER}/.nvm/versions/node/v${NODE_VERSION}/bin/node")
NPM_PATH=$(sudo -u ${SERVICE_USER} bash -c "source ~/.nvm/nvm.sh 2>/dev/null && which npm" 2>/dev/null || which npm || echo "/home/${SERVICE_USER}/.nvm/versions/node/v${NODE_VERSION}/bin/npm")

# Create service file
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
Environment=HOSTNAME=0.0.0.0
Environment=PORT=${APP_PORT}
Environment=PATH=${NODE_PATH%/*}:/usr/local/bin:/usr/bin:/bin
EnvironmentFile=${REPO_DIR}/.env
ExecStart=${NPM_PATH} start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=secure-ai-chat

# Security
NoNewPrivileges=true
PrivateTmp=true
ReadWritePaths=${REPO_DIR}/.secure-storage ${REPO_DIR}/.next ${REPO_DIR}/.storage

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
echo -e "${GREEN}✅ Systemd service created${NC}"
echo ""

# Step 11: Enable and Start Service
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 11: Enable and Start Service${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

sudo systemctl enable ${SERVICE_NAME}
sudo systemctl start ${SERVICE_NAME}

sleep 5

if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}✅ Service started successfully${NC}"
else
    echo -e "${RED}❌ Service failed to start${NC}"
    sudo systemctl status ${SERVICE_NAME} --no-pager -l | head -20
    exit 1
fi
echo ""

# Step 12: Verification
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 12: Verification${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

sleep 3

# Check service status
echo "Service status:"
if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}✅ Service is running${NC}"
else
    echo -e "${RED}❌ Service is not running${NC}"
fi

# Check network binding
echo ""
echo "Network binding:"
if command -v ss &> /dev/null; then
    LISTEN_CHECK=$(sudo ss -tlnp 2>/dev/null | grep ":${APP_PORT}" || echo "")
    if echo "$LISTEN_CHECK" | grep -q "0.0.0.0:${APP_PORT}"; then
        echo -e "${GREEN}✅ Application is listening on 0.0.0.0:${APP_PORT} (public access enabled)${NC}"
        echo "   $LISTEN_CHECK"
    elif echo "$LISTEN_CHECK" | grep -q "127.0.0.1:${APP_PORT}"; then
        echo -e "${RED}❌ Application is only listening on 127.0.0.1:${APP_PORT} (localhost only)${NC}"
        echo "   $LISTEN_CHECK"
        echo -e "${YELLOW}⚠️  This means it's not accessible from public IP${NC}"
    else
        echo -e "${YELLOW}⚠️  Application not listening yet${NC}"
    fi
fi

# Test health endpoint
echo ""
echo "Health check:"
if curl -s -f http://localhost:${APP_PORT}/api/health > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s http://localhost:${APP_PORT}/api/health | head -1)
    echo -e "${GREEN}✅ Health endpoint responding${NC}"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo -e "${YELLOW}⚠️  Health endpoint not responding yet${NC}"
fi

# Get public IP
PUBLIC_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "unknown")
echo ""
echo -e "${BLUE}Network Information:${NC}"
echo "   Local IP: $PUBLIC_IP"
echo "   Access URL: http://$PUBLIC_IP:${APP_PORT}"
echo ""

# Summary
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Installation Complete${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Secure AI Chat v1.0.7 installed successfully${NC}"
echo ""
echo -e "${BLUE}Access Information:${NC}"
echo "   Local:   http://localhost:${APP_PORT}"
echo "   Network: http://$PUBLIC_IP:${APP_PORT}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Cloud Provider Firewall${NC}"
echo "   If using AWS/GCP/Azure/DigitalOcean/etc., you MUST also configure"
echo "   their firewall to allow inbound traffic on port ${APP_PORT}:"
echo ""
echo "   AWS:     Security Groups → Inbound Rules → Allow TCP ${APP_PORT}"
echo "   GCP:     VPC Network → Firewall → Allow TCP ${APP_PORT}"
echo "   Azure:   VM → Networking → Inbound Port Rules → Allow TCP ${APP_PORT}"
echo "   DO:      Networking → Firewalls → Allow TCP ${APP_PORT}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "   1. Configure API keys via Settings UI: http://$PUBLIC_IP:${APP_PORT}/settings"
echo "   2. Set up PIN for API key protection (optional)"
echo "   3. Test chat functionality"
echo "   4. Test file upload and scanning"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "   sudo systemctl status ${SERVICE_NAME}"
echo "   sudo systemctl restart ${SERVICE_NAME}"
echo "   sudo journalctl -u ${SERVICE_NAME} -f"
echo "   curl http://localhost:${APP_PORT}/api/health"
echo ""
