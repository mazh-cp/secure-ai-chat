#!/bin/bash
# Fix Public Access Script
# Diagnoses and fixes issues preventing public IP access
#
# Usage:
#   sudo bash scripts/fix-public-access.sh

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
REPO_DIR="${REPO_DIR:-/home/adminuser/secure-ai-chat}"
PORT="${PORT:-3000}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Public Access Diagnostic & Fix Script                ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check if service exists
echo -e "${CYAN}Step 1: Checking Service Status${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ ! -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
    echo -e "${RED}❌ Service file does not exist${NC}"
    echo "   Creating systemd service..."
    if [ -f "${REPO_DIR}/scripts/create-systemd-service.sh" ]; then
        sudo bash "${REPO_DIR}/scripts/create-systemd-service.sh"
    else
        echo -e "${YELLOW}⚠️  create-systemd-service.sh not found${NC}"
        echo "   Please run: sudo bash scripts/create-systemd-service.sh"
        echo "   Or download: curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/create-systemd-service.sh | sudo bash"
        exit 1
    fi
    echo ""
elif sudo systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}✅ Service is running${NC}"
else
    echo -e "${YELLOW}⚠️  Service exists but is not running${NC}"
    echo "   Starting service..."
    sudo systemctl start ${SERVICE_NAME}
    sleep 3
    if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
        echo -e "${GREEN}✅ Service started${NC}"
    else
        echo -e "${RED}❌ Failed to start service${NC}"
        sudo systemctl status ${SERVICE_NAME} --no-pager -l | head -20
        exit 1
    fi
fi
echo ""

# Step 2: Check network binding
echo -e "${CYAN}Step 2: Checking Network Binding${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if command -v ss &> /dev/null; then
    LISTEN_CHECK=$(sudo ss -tlnp 2>/dev/null | grep ":${PORT}" || echo "")
    if echo "$LISTEN_CHECK" | grep -q "0.0.0.0:${PORT}"; then
        echo -e "${GREEN}✅ Application is listening on 0.0.0.0:${PORT} (public access enabled)${NC}"
        echo "   $LISTEN_CHECK"
        BINDING_OK=true
    elif echo "$LISTEN_CHECK" | grep -q "127.0.0.1:${PORT}"; then
        echo -e "${RED}❌ Application is only listening on 127.0.0.1:${PORT} (localhost only)${NC}"
        echo "   $LISTEN_CHECK"
        echo -e "${YELLOW}⚠️  This is the problem! Fixing...${NC}"
        BINDING_OK=false
    elif [ -z "$LISTEN_CHECK" ]; then
        echo -e "${YELLOW}⚠️  Application not listening on port ${PORT}${NC}"
        BINDING_OK=false
    else
        echo -e "${YELLOW}⚠️  Unexpected binding:${NC}"
        echo "   $LISTEN_CHECK"
        BINDING_OK=false
    fi
else
    echo -e "${YELLOW}⚠️  'ss' command not available${NC}"
    BINDING_OK=unknown
fi
echo ""

# Step 3: Check systemd service configuration
echo -e "${CYAN}Step 3: Checking Systemd Service Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if sudo systemctl cat ${SERVICE_NAME} 2>/dev/null | grep -q "HOSTNAME=0.0.0.0"; then
    echo -e "${GREEN}✅ HOSTNAME=0.0.0.0 is set in systemd service${NC}"
else
    echo -e "${RED}❌ HOSTNAME=0.0.0.0 is NOT set in systemd service${NC}"
    echo "   Fixing systemd service..."
    
    # Backup current service
    sudo cp "/etc/systemd/system/${SERVICE_NAME}.service" "/etc/systemd/system/${SERVICE_NAME}.service.backup"
    
    # Check if Environment line exists
    if sudo grep -q "^Environment=" "/etc/systemd/system/${SERVICE_NAME}.service"; then
        # Add HOSTNAME to existing Environment line or add new one
        if ! sudo grep -q "HOSTNAME=" "/etc/systemd/system/${SERVICE_NAME}.service"; then
            sudo sed -i '/^Environment=/a Environment=HOSTNAME=0.0.0.0' "/etc/systemd/system/${SERVICE_NAME}.service"
        else
            sudo sed -i 's/Environment=HOSTNAME=.*/Environment=HOSTNAME=0.0.0.0/' "/etc/systemd/system/${SERVICE_NAME}.service"
        fi
    else
        # Add Environment line before ExecStart
        sudo sed -i '/^ExecStart=/i Environment=HOSTNAME=0.0.0.0' "/etc/systemd/system/${SERVICE_NAME}.service"
    fi
    
    sudo systemctl daemon-reload
    echo -e "${GREEN}✅ Systemd service updated${NC}"
    echo "   Restarting service..."
    sudo systemctl restart ${SERVICE_NAME}
    sleep 3
    echo -e "${GREEN}✅ Service restarted${NC}"
fi
echo ""

# Step 4: Check .env file
echo -e "${CYAN}Step 4: Checking .env File${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "${REPO_DIR}/.env" ]; then
    if grep -q "^HOSTNAME=0.0.0.0" "${REPO_DIR}/.env"; then
        echo -e "${GREEN}✅ HOSTNAME=0.0.0.0 is set in .env${NC}"
    elif grep -q "^HOSTNAME=" "${REPO_DIR}/.env"; then
        echo -e "${YELLOW}⚠️  HOSTNAME is set but not to 0.0.0.0${NC}"
        echo "   Current value: $(grep "^HOSTNAME=" "${REPO_DIR}/.env")"
        echo "   Updating to 0.0.0.0..."
        sudo sed -i 's/^HOSTNAME=.*/HOSTNAME=0.0.0.0/' "${REPO_DIR}/.env"
        echo -e "${GREEN}✅ Updated .env file${NC}"
        echo "   Restarting service..."
        sudo systemctl restart ${SERVICE_NAME}
        sleep 3
    else
        echo -e "${YELLOW}⚠️  HOSTNAME not set in .env${NC}"
        echo "   Adding HOSTNAME=0.0.0.0..."
        echo "HOSTNAME=0.0.0.0" | sudo tee -a "${REPO_DIR}/.env" > /dev/null
        sudo chown ${SERVICE_USER}:${SERVICE_USER} "${REPO_DIR}/.env"
        echo -e "${GREEN}✅ Added HOSTNAME to .env${NC}"
        echo "   Restarting service..."
        sudo systemctl restart ${SERVICE_NAME}
        sleep 3
    fi
else
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    echo "   Creating .env with HOSTNAME=0.0.0.0..."
    sudo -u ${SERVICE_USER} tee "${REPO_DIR}/.env" > /dev/null <<EOF
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
EOF
    sudo chmod 600 "${REPO_DIR}/.env"
    echo -e "${GREEN}✅ Created .env file${NC}"
    echo "   Restarting service..."
    sudo systemctl restart ${SERVICE_NAME}
    sleep 3
fi
echo ""

# Step 5: Check firewall
echo -e "${CYAN}Step 5: Checking Firewall${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if command -v ufw &> /dev/null; then
    if sudo ufw status | grep -q "Status: active"; then
        echo -e "${GREEN}✅ UFW is active${NC}"
        if sudo ufw status | grep -q "${PORT}/tcp"; then
            echo -e "${GREEN}✅ Port ${PORT}/tcp is allowed${NC}"
        else
            echo -e "${YELLOW}⚠️  Port ${PORT}/tcp is not allowed${NC}"
            echo "   Adding firewall rule..."
            sudo ufw allow ${PORT}/tcp > /dev/null 2>&1
            echo -e "${GREEN}✅ Port ${PORT}/tcp allowed${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  UFW is not active${NC}"
        echo "   Note: You may need to configure cloud provider firewall"
    fi
    echo ""
    echo "Current UFW rules:"
    sudo ufw status numbered | head -10
else
    echo -e "${YELLOW}⚠️  UFW not installed${NC}"
    echo "   Note: You may need to configure firewall manually or via cloud provider"
fi
echo ""

# Step 6: Final verification
echo -e "${CYAN}Step 6: Final Verification${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 2

# Check binding again
if command -v ss &> /dev/null; then
    LISTEN_CHECK=$(sudo ss -tlnp 2>/dev/null | grep ":${PORT}" || echo "")
    if echo "$LISTEN_CHECK" | grep -q "0.0.0.0:${PORT}"; then
        echo -e "${GREEN}✅ Application is now listening on 0.0.0.0:${PORT}${NC}"
        echo "   $LISTEN_CHECK"
    else
        echo -e "${RED}❌ Still not listening on 0.0.0.0:${PORT}${NC}"
        if [ ! -z "$LISTEN_CHECK" ]; then
            echo "   Current binding: $LISTEN_CHECK"
        fi
        echo ""
        echo -e "${YELLOW}⚠️  Manual steps required:${NC}"
        echo "   1. Check service logs: sudo journalctl -u ${SERVICE_NAME} -n 50"
        echo "   2. Verify package.json start script"
        echo "   3. Check if Next.js is reading HOSTNAME correctly"
    fi
fi

# Get public IP
PUBLIC_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "unknown")
echo ""
echo -e "${BLUE}Network Information:${NC}"
echo "   Local IP: $PUBLIC_IP"
echo "   Access URL: http://$PUBLIC_IP:${PORT}"
echo ""

# Test local access
if curl -s -f http://localhost:${PORT}/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Application is responding locally${NC}"
else
    echo -e "${RED}❌ Application is not responding locally${NC}"
fi
echo ""

# Summary
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Test from your local machine:"
echo "     curl http://$PUBLIC_IP:${PORT}/api/health"
echo ""
echo "  2. If still not accessible, check:"
echo "     - Cloud provider firewall (AWS Security Groups, GCP Firewall Rules, etc.)"
echo "     - Service logs: sudo journalctl -u ${SERVICE_NAME} -f"
echo "     - Network binding: sudo ss -tlnp | grep :${PORT}"
echo ""
echo "  3. Cloud Provider Firewall Configuration:"
echo "     - AWS: Security Groups → Inbound Rules → Allow TCP ${PORT} from 0.0.0.0/0"
echo "     - GCP: VPC Network → Firewall → Allow TCP ${PORT}"
echo "     - Azure: VM → Networking → Inbound Port Rules → Allow TCP ${PORT}"
echo ""
