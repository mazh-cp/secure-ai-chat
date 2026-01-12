#!/bin/bash
# Create Systemd Service Script
# Creates the systemd service file for Secure AI Chat
#
# Usage:
#   sudo bash scripts/create-systemd-service.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
SERVICE_USER="${SERVICE_USER:-adminuser}"
SERVICE_GROUP="${SERVICE_GROUP:-adminuser}"
REPO_DIR="${REPO_DIR:-/home/adminuser/secure-ai-chat}"
NODE_VERSION="${NODE_VERSION:-25.2.1}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Create Systemd Service for Secure AI Chat             ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ This script must be run with sudo${NC}"
    echo "   Usage: sudo bash scripts/create-systemd-service.sh"
    exit 1
fi

# Check if repository directory exists
if [ ! -d "$REPO_DIR" ]; then
    echo -e "${RED}❌ Repository directory not found: $REPO_DIR${NC}"
    echo "   Please set REPO_DIR environment variable or ensure the directory exists"
    exit 1
fi

# Check if user exists
if ! id "$SERVICE_USER" &>/dev/null; then
    echo -e "${RED}❌ Service user '$SERVICE_USER' does not exist${NC}"
    echo "   Please create the user first or set SERVICE_USER environment variable"
    exit 1
fi

echo -e "${BLUE}Configuration:${NC}"
echo "   Service Name: $SERVICE_NAME"
echo "   Service User: $SERVICE_USER"
echo "   Repository: $REPO_DIR"
echo "   Node Version: $NODE_VERSION"
echo ""

# Step 1: Find Node.js and npm paths
echo -e "${CYAN}Step 1: Finding Node.js Installation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Try to find node/npm in common locations
NODE_PATH=""
NPM_PATH=""

# Check if running as service user can find node
if sudo -u ${SERVICE_USER} bash -c "source ~/.nvm/nvm.sh 2>/dev/null && which node" &>/dev/null; then
    NODE_PATH=$(sudo -u ${SERVICE_USER} bash -c "source ~/.nvm/nvm.sh && which node")
    NPM_PATH=$(sudo -u ${SERVICE_USER} bash -c "source ~/.nvm/nvm.sh && which npm")
    echo -e "${GREEN}✅ Found Node.js via nvm: $NODE_PATH${NC}"
elif [ -f "/home/${SERVICE_USER}/.nvm/versions/node/v${NODE_VERSION}/bin/node" ]; then
    NODE_PATH="/home/${SERVICE_USER}/.nvm/versions/node/v${NODE_VERSION}/bin/node"
    NPM_PATH="/home/${SERVICE_USER}/.nvm/versions/node/v${NODE_VERSION}/bin/npm"
    echo -e "${GREEN}✅ Found Node.js at expected nvm location${NC}"
elif command -v node &> /dev/null; then
    NODE_PATH=$(which node)
    NPM_PATH=$(which npm)
    echo -e "${GREEN}✅ Found Node.js in system PATH: $NODE_PATH${NC}"
else
    echo -e "${RED}❌ Node.js not found${NC}"
    echo "   Please install Node.js ${NODE_VERSION} first"
    exit 1
fi

echo "   Node.js: $NODE_PATH"
echo "   npm: $NPM_PATH"
echo ""

# Verify Node.js version
NODE_VER=$(sudo -u ${SERVICE_USER} bash -c "source ~/.nvm/nvm.sh 2>/dev/null && node -v" || $NODE_PATH --version)
echo "   Version: $NODE_VER"
echo ""

# Step 2: Check if build exists
echo -e "${CYAN}Step 2: Checking Application Build${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -d "$REPO_DIR/.next" ]; then
    echo -e "${GREEN}✅ Build directory exists${NC}"
else
    echo -e "${YELLOW}⚠️  Build directory not found${NC}"
    echo "   Building application..."
    cd "$REPO_DIR"
    sudo -u ${SERVICE_USER} env HOME="/home/${SERVICE_USER}" npm run build || {
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ Build completed${NC}"
fi
echo ""

# Step 3: Create .env file if it doesn't exist
echo -e "${CYAN}Step 3: Checking Environment File${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ ! -f "$REPO_DIR/.env" ]; then
    echo "Creating .env file..."
    sudo -u ${SERVICE_USER} tee "$REPO_DIR/.env" > /dev/null <<EOF
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
EOF
    sudo chmod 600 "$REPO_DIR/.env"
    sudo chown ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR/.env"
    echo -e "${GREEN}✅ .env file created${NC}"
else
    echo -e "${GREEN}✅ .env file exists${NC}"
    # Ensure HOSTNAME is set
    if ! grep -q "^HOSTNAME=" "$REPO_DIR/.env"; then
        echo "Adding HOSTNAME=0.0.0.0 to .env..."
        echo "HOSTNAME=0.0.0.0" | sudo tee -a "$REPO_DIR/.env" > /dev/null
        echo -e "${GREEN}✅ HOSTNAME added to .env${NC}"
    elif ! grep -q "^HOSTNAME=0.0.0.0" "$REPO_DIR/.env"; then
        echo "Updating HOSTNAME to 0.0.0.0 in .env..."
        sudo sed -i 's/^HOSTNAME=.*/HOSTNAME=0.0.0.0/' "$REPO_DIR/.env"
        echo -e "${GREEN}✅ HOSTNAME updated in .env${NC}"
    fi
fi
echo ""

# Step 4: Create systemd service file
echo -e "${CYAN}Step 4: Creating Systemd Service File${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backup existing service if it exists
if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
    echo "Backing up existing service file..."
    sudo cp "/etc/systemd/system/${SERVICE_NAME}.service" "/etc/systemd/system/${SERVICE_NAME}.service.backup.$(date +%Y%m%d_%H%M%S)"
fi

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
Environment=PORT=3000
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
ReadWritePaths=${REPO_DIR}/.secure-storage ${REPO_DIR}/.next ${REPO_DIR}/.storage

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✅ Service file created: /etc/systemd/system/${SERVICE_NAME}.service${NC}"
echo ""

# Step 5: Reload systemd and enable service
echo -e "${CYAN}Step 5: Enabling and Starting Service${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Reload systemd
sudo systemctl daemon-reload
echo -e "${GREEN}✅ Systemd daemon reloaded${NC}"

# Enable service
sudo systemctl enable ${SERVICE_NAME}
echo -e "${GREEN}✅ Service enabled (will start on boot)${NC}"

# Start service
sudo systemctl start ${SERVICE_NAME}
echo -e "${GREEN}✅ Service started${NC}"
echo ""

# Step 6: Verify service
echo -e "${CYAN}Step 6: Verifying Service${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sleep 3

if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}✅ Service is running${NC}"
else
    echo -e "${RED}❌ Service failed to start${NC}"
    echo ""
    echo "Service status:"
    sudo systemctl status ${SERVICE_NAME} --no-pager -l | head -20
    echo ""
    echo "Recent logs:"
    sudo journalctl -u ${SERVICE_NAME} -n 30 --no-pager
    exit 1
fi

# Check network binding
if command -v ss &> /dev/null; then
    echo ""
    echo "Network binding:"
    LISTEN_CHECK=$(sudo ss -tlnp 2>/dev/null | grep ":3000" || echo "")
    if echo "$LISTEN_CHECK" | grep -q "0.0.0.0:3000"; then
        echo -e "${GREEN}✅ Application is listening on 0.0.0.0:3000 (public access enabled)${NC}"
        echo "   $LISTEN_CHECK"
    elif echo "$LISTEN_CHECK" | grep -q "127.0.0.1:3000"; then
        echo -e "${YELLOW}⚠️  Application is only listening on 127.0.0.1:3000${NC}"
        echo "   $LISTEN_CHECK"
        echo "   This means it's not accessible from public IP"
    else
        echo -e "${YELLOW}⚠️  Application not listening yet (may need a moment)${NC}"
    fi
fi

# Test health endpoint
echo ""
echo "Health check:"
sleep 2
if curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health endpoint responding${NC}"
else
    echo -e "${YELLOW}⚠️  Health endpoint not responding yet (may need a moment)${NC}"
fi

# Summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Systemd service created and started${NC}"
echo ""
echo "Service file: /etc/systemd/system/${SERVICE_NAME}.service"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status ${SERVICE_NAME}"
echo "  sudo systemctl restart ${SERVICE_NAME}"
echo "  sudo systemctl stop ${SERVICE_NAME}"
echo "  sudo journalctl -u ${SERVICE_NAME} -f"
echo ""
echo "Access the application:"
PUBLIC_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "YOUR_IP")
echo "  Local:   http://localhost:3000"
echo "  Network: http://${PUBLIC_IP}:3000"
echo ""
