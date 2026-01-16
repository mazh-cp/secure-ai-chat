#!/usr/bin/env bash
# Secure AI Chat - Production Restart with Cache & Logs Clearing
# Restarts application on remote production host and clears all cache and logs
#
# Usage (on remote server via SSH):
#   ssh user@production-host
#   cd /opt/secure-ai-chat  # or /home/adminuser/secure-ai-chat
#   bash scripts/restart-production-clear-all.sh
#
# Or via one-liner from local machine:
#   ssh user@production-host "cd /opt/secure-ai-chat && bash scripts/restart-production-clear-all.sh"
#
# Configuration:
#   Set environment variables before running:
#   INSTALL_DIR=/opt/secure-ai-chat  # or /home/adminuser/secure-ai-chat
#   APP_USER=secureai                # or adminuser
#   SERVICE_NAME=secure-ai-chat      # systemd service name
#   DEPLOYMENT_TYPE=systemd          # or 'docker'

set -euo pipefail

# Configuration (can be overridden by environment variables)
INSTALL_DIR="${INSTALL_DIR:-/opt/secure-ai-chat}"
APP_USER="${APP_USER:-secureai}"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
DEPLOYMENT_TYPE="${DEPLOYMENT_TYPE:-systemd}"  # systemd or docker
PORT="${PORT:-3000}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*"; }
log_step() { echo -e "${CYAN}▶${NC} $*"; }

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    log_error "Do not run as root. Script uses sudo when needed."
    exit 1
fi

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Production Restart - Clear All Cache & Logs                ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
log_info "Install directory: $INSTALL_DIR"
log_info "App user: $APP_USER"
log_info "Service name: $SERVICE_NAME"
log_info "Deployment type: $DEPLOYMENT_TYPE"
echo ""

# Check if installation exists
if [ ! -d "$INSTALL_DIR" ]; then
    log_error "Installation directory not found: $INSTALL_DIR"
    exit 1
fi

cd "$INSTALL_DIR"

# Function to detect deployment type if not specified
detect_deployment() {
    if sudo systemctl list-units --full -a | grep -q "$SERVICE_NAME.service"; then
        echo "systemd"
    elif docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "secure-ai-chat"; then
        echo "docker"
    elif command -v docker-compose >/dev/null 2>&1 && [ -f "docker-compose.yml" ]; then
        echo "docker"
    else
        echo "unknown"
    fi
}

# Auto-detect deployment type if not set
if [ "$DEPLOYMENT_TYPE" = "auto" ]; then
    DETECTED=$(detect_deployment)
    if [ "$DETECTED" != "unknown" ]; then
        DEPLOYMENT_TYPE="$DETECTED"
        log_info "Auto-detected deployment type: $DEPLOYMENT_TYPE"
    fi
fi

# Step 1: Stop application
log_step "Step 1: Stopping application..."
case "$DEPLOYMENT_TYPE" in
    systemd)
        if sudo systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
            sudo systemctl stop "$SERVICE_NAME"
            log_success "systemd service stopped"
            sleep 2
        else
            log_warning "Service was not running"
        fi
        ;;
    docker)
        if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "secure-ai-chat"; then
            docker stop secure-ai-chat 2>/dev/null || docker-compose down 2>/dev/null || true
            log_success "Docker container stopped"
            sleep 2
        else
            log_warning "Docker container was not running"
        fi
        ;;
    *)
        log_error "Unknown deployment type: $DEPLOYMENT_TYPE"
        exit 1
        ;;
esac
echo ""

# Step 2: Clear Next.js build cache
log_step "Step 2: Clearing Next.js build cache..."
if [ -d ".next" ]; then
    sudo rm -rf .next
    log_success ".next directory cleared"
else
    log_warning ".next directory does not exist"
fi
echo ""

# Step 3: Clear Node modules cache
log_step "Step 3: Clearing Node modules cache..."
if [ -d "node_modules/.cache" ]; then
    sudo rm -rf node_modules/.cache
    log_success "node_modules/.cache cleared"
else
    log_warning "node_modules/.cache does not exist"
fi
echo ""

# Step 4: Clear uploaded files and metadata
log_step "Step 4: Clearing uploaded files and metadata..."
if [ -d ".storage" ]; then
    # Count files before deletion
    FILE_COUNT=0
    if [ -d ".storage/files" ]; then
        FILE_COUNT=$(find .storage/files -name "*.dat" 2>/dev/null | wc -l | tr -d ' ')
        sudo rm -rf .storage/files
    fi
    # Clear metadata file
    if [ -f ".storage/files-metadata.json" ]; then
        sudo rm -f .storage/files-metadata.json
    fi
    # Remove empty .storage directory if no other files exist
    if [ -z "$(sudo ls -A .storage 2>/dev/null)" ]; then
        sudo rmdir .storage 2>/dev/null || true
    fi
    log_success "Deleted ${FILE_COUNT} uploaded files and cleared metadata"
else
    log_warning ".storage directory does not exist"
fi
echo ""

# Step 5: Clear system logs (but preserve API keys)
log_step "Step 5: Clearing system logs..."
if [ -f ".secure-storage/system-logs.json" ]; then
    # Backup the file size before clearing
    FILE_SIZE=$(sudo stat -f%z .secure-storage/system-logs.json 2>/dev/null || sudo stat -c%s .secure-storage/system-logs.json 2>/dev/null || echo "0")
    sudo rm -f .secure-storage/system-logs.json
    log_success "Cleared system logs (${FILE_SIZE} bytes)"
else
    log_warning "System logs file does not exist"
fi
echo ""

# Step 6: Verify API keys are preserved
log_step "Step 6: Verifying API keys are preserved..."
if [ -f ".secure-storage/api-keys.enc" ]; then
    KEY_SIZE=$(sudo stat -f%z .secure-storage/api-keys.enc 2>/dev/null || sudo stat -c%s .secure-storage/api-keys.enc 2>/dev/null || echo "0")
    log_success "API keys file exists (${KEY_SIZE} bytes) - preserved"
else
    log_warning "API keys file does not exist (will be created when keys are saved)"
fi
echo ""

# Step 7: Fix permissions (important for production)
log_step "Step 7: Fixing file permissions..."
sudo chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR" 2>/dev/null || true
sudo chmod 700 .secure-storage 2>/dev/null || true
sudo chmod 600 .secure-storage/*.enc 2>/dev/null || true
log_success "Permissions fixed"
echo ""

# Step 8: Load nvm and verify Node.js
log_step "Step 8: Loading Node.js environment..."
cd "$INSTALL_DIR"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" || {
    # Try common nvm locations
    if [ -s "/home/$APP_USER/.nvm/nvm.sh" ]; then
        export NVM_DIR="/home/$APP_USER/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    elif [ -s "/opt/secure-ai-chat/.nvm/nvm.sh" ]; then
        export NVM_DIR="/opt/secure-ai-chat/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
}

# Use Node.js if nvm is available, otherwise use system node
if command -v nvm >/dev/null 2>&1; then
    nvm use 25.2.1 >/dev/null 2>&1 || nvm use node >/dev/null 2>&1 || true
fi

NODE_VERSION=$(node -v 2>/dev/null || echo "unknown")
log_success "Node.js version: $NODE_VERSION"
echo ""

# Step 9: Type check
log_step "Step 9: Running type check..."
cd "$INSTALL_DIR"
INSTALL_DIR_VAR="$INSTALL_DIR"
sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash <<TYPECHECK || log_warning "Type check had warnings (continuing...)"
set +e
export HOME="$INSTALL_DIR_VAR"
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"
cd "\$HOME"
npm run type-check 2>/dev/null || npx tsc --noEmit 2>/dev/null
TYPECHECK
log_success "Type check completed"
echo ""

# Step 10: Build application
log_step "Step 10: Building application..."
cd "$INSTALL_DIR"
INSTALL_DIR_VAR="$INSTALL_DIR"
sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash <<BUILD
set -e
export HOME="$INSTALL_DIR_VAR"
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"
cd "\$HOME"
npm run build
BUILD
log_success "Build completed"
echo ""

# Step 11: Start application
log_step "Step 11: Starting application..."
case "$DEPLOYMENT_TYPE" in
    systemd)
        sudo systemctl start "$SERVICE_NAME" 2>/dev/null || true
        sleep 3
        
        if sudo systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
            log_success "systemd service started"
        else
            log_error "Service failed to start"
            log_info "Check logs: sudo journalctl -u $SERVICE_NAME -n 50"
            exit 1
        fi
        ;;
    docker)
        if [ -f "docker-compose.yml" ]; then
            docker-compose up -d
        else
            docker start secure-ai-chat || docker run -d --name secure-ai-chat -p 3000:3000 secure-ai-chat
        fi
        sleep 5
        
        if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "secure-ai-chat"; then
            log_success "Docker container started"
        else
            log_error "Docker container failed to start"
            exit 1
        fi
        ;;
esac
echo ""

# Step 12: Wait for server to be ready
log_step "Step 12: Waiting for server to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sf "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
        log_success "Server is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        log_error "Server did not start in time"
        case "$DEPLOYMENT_TYPE" in
            systemd)
                log_info "Check logs: sudo journalctl -u $SERVICE_NAME -n 50"
                ;;
            docker)
                log_info "Check logs: docker logs secure-ai-chat"
                ;;
        esac
        exit 1
    fi
    sleep 1
done
echo ""

# Step 13: Clear client-side logs via API
log_step "Step 13: Clearing client-side logs..."
if curl -sf -X DELETE "http://localhost:${PORT}/api/logs/system" >/dev/null 2>&1; then
    log_success "Client-side logs cleared"
else
    log_warning "Could not clear client-side logs (API may not be ready yet)"
fi
echo ""

# Step 14: Verify endpoints
log_step "Step 14: Verifying endpoints..."

# Health check
if HEALTH=$(curl -sf "http://localhost:${PORT}/api/health" 2>/dev/null); then
    if echo "$HEALTH" | grep -q "ok"; then
        log_success "Health endpoint: OK"
    else
        log_warning "Health endpoint: Unexpected response"
    fi
else
    log_warning "Health endpoint: Failed"
fi

# Version check
if VERSION=$(curl -sf "http://localhost:${PORT}/api/version" 2>/dev/null); then
    VERSION_NUM=$(echo "$VERSION" | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo 'unknown')
    log_success "Version endpoint: $VERSION_NUM"
else
    log_warning "Version endpoint: Failed"
fi

# Keys check
if KEYS_RESPONSE=$(curl -sf "http://localhost:${PORT}/api/keys/retrieve" 2>/dev/null); then
    if echo "$KEYS_RESPONSE" | grep -q "configured"; then
        log_success "Keys endpoint: Working"
        if echo "$KEYS_RESPONSE" | grep -q '"openAiKey":"configured"'; then
            log_success "  OpenAI key is configured"
        else
            log_warning "  OpenAI key not configured yet"
        fi
    else
        log_warning "Keys endpoint: Unexpected response"
    fi
else
    log_warning "Keys endpoint: Failed"
fi

echo ""

# Summary
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Production Restart Complete - All Cache & Logs Cleared!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
log_success "Application restarted successfully"
echo ""
echo "🧹 Cleared:"
echo "   - Next.js build cache (.next/)"
echo "   - Node modules cache (node_modules/.cache)"
echo "   - Uploaded files (.storage/files/)"
echo "   - Files metadata (.storage/files-metadata.json)"
echo "   - System logs (.secure-storage/system-logs.json)"
echo "   - Client-side logs (localStorage via API)"
echo ""
echo "🔒 Preserved:"
echo "   - API keys (.secure-storage/api-keys.enc)"
echo ""
echo "🌐 Application is running at:"
echo "   http://localhost:${PORT}"
echo ""
echo "📋 Verification commands:"
echo "   # Health check"
echo "   curl http://localhost:${PORT}/api/health"
echo ""
echo "   # Check service status (systemd)"
if [ "$DEPLOYMENT_TYPE" = "systemd" ]; then
    echo "   sudo systemctl status $SERVICE_NAME"
    echo "   sudo journalctl -u $SERVICE_NAME -f"
elif [ "$DEPLOYMENT_TYPE" = "docker" ]; then
    echo "   # Check container status (Docker)"
    echo "   docker ps | grep secure-ai-chat"
    echo "   docker logs secure-ai-chat -f"
fi
echo ""
echo "✅ Restart complete!"
echo ""
