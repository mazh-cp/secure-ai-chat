#!/usr/bin/env bash
# Secure AI Chat - Production Installation Script for Ubuntu VM
# Single-step script that installs system deps, Node LTS 20.x, clones repo,
# installs deps, builds, configures systemd + nginx reverse proxy
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_public.sh | bash
#   OR
#   bash scripts/install_ubuntu_public.sh

set -euxo pipefail

# Configuration
REPO_URL="https://github.com/mazh-cp/secure-ai-chat.git"
INSTALL_DIR="/opt/secure-ai-chat"
APP_USER="secureai"
APP_GROUP="secureai"
NODE_VERSION="24.13.0"  # Use LTS 24.13.0 (stable version)
NGINX_SITE="secure-ai-chat"
SERVICE_NAME="secure-ai-chat"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*"; }

# Function to find a free port starting from 3000
find_free_port() {
    local start_port=${1:-3000}
    local port=$start_port
    while [ $port -lt 4000 ]; do
        if command -v ss >/dev/null 2>&1; then
            # Use ss (preferred)
            if ! ss -tuln 2>/dev/null | grep -q ":$port "; then
                echo $port
                return 0
            fi
        elif command -v netstat >/dev/null 2>&1; then
            # Fallback to netstat
            if ! netstat -tuln 2>/dev/null | grep -q ":$port "; then
                echo $port
                return 0
            fi
        else
            # Last resort: assume port is free
            log_warning "Cannot check port availability, using $port"
            echo $port
            return 0
        fi
        port=$((port + 1))
    done
    log_error "Could not find free port in range 3000-3999"
    exit 1
}

# Detect current branch (default to main)
detect_branch() {
    if [ -d "$INSTALL_DIR/.git" ]; then
        cd "$INSTALL_DIR"
        BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
        cd - >/dev/null
        echo "$BRANCH"
    else
        echo "main"
    fi
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    log_error "Do not run as root. Script uses sudo when needed."
    exit 1
fi

log_info "Starting Secure AI Chat installation..."
log_info "Install directory: $INSTALL_DIR"
log_info "User: $APP_USER"
log_info "Node version: $NODE_VERSION (LTS)"

# Step 1: Update system packages
log_info "Updating system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq curl git build-essential ca-certificates gnupg lsb-release iproute2 >/dev/null

# Step 2: Create dedicated user if not exists
if ! id "$APP_USER" &>/dev/null; then
    log_info "Creating user: $APP_USER"
    sudo useradd -r -s /bin/bash -d "$INSTALL_DIR" "$APP_USER" 2>/dev/null || \
    sudo useradd -s /bin/bash -d "$INSTALL_DIR" "$APP_USER"
else
    log_success "User $APP_USER already exists"
fi

# Ensure install directory exists
sudo mkdir -p "$INSTALL_DIR"
sudo chown "$APP_USER:$APP_USER" "$INSTALL_DIR" 2>/dev/null || true

# Step 3: Install/Upgrade Node.js to v24.13.0 (LTS) via nvm (as secureai user)
log_info "Installing/Upgrading Node.js to $NODE_VERSION (LTS) via nvm..."
sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash << NVM_SCRIPT
set -e
export HOME=/opt/secure-ai-chat
export NVM_DIR="\$HOME/.nvm"

# Install nvm if not exists
if [ ! -d "\$NVM_DIR" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash >/dev/null 2>&1
fi

# Load nvm
[ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"

# Check current Node.js version (if any)
CURRENT_NODE_VERSION=\$(node -v 2>/dev/null || echo "none")
if [ "\$CURRENT_NODE_VERSION" != "none" ]; then
    echo "Current Node.js version: \${CURRENT_NODE_VERSION}"
    if [ "\$CURRENT_NODE_VERSION" != "v${NODE_VERSION}" ]; then
        echo "Upgrading to v${NODE_VERSION} (LTS)..."
    fi
fi

# Install Node.js v24.13.0 (LTS) - always ensure it's installed and set as default
if nvm list | grep -q "v${NODE_VERSION}"; then
    nvm use ${NODE_VERSION} >/dev/null 2>&1
    nvm alias default ${NODE_VERSION} >/dev/null 2>&1
else
    nvm install ${NODE_VERSION} >/dev/null 2>&1
    nvm use ${NODE_VERSION} >/dev/null 2>&1
    nvm alias default ${NODE_VERSION} >/dev/null 2>&1
fi

# Verify installation
node -v
npm -v
NVM_SCRIPT

# Get Node.js path for systemd
NODE_PATH=$(sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash << 'GET_NODE'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
which node
GET_NODE
)
NPM_PATH="${NODE_PATH%/node}/npm"

log_success "Node.js installed: $NODE_PATH"

# Step 4: Clone or update repository
BRANCH=$(detect_branch)
log_info "Using branch: $BRANCH"

if [ -d "$INSTALL_DIR/.git" ]; then
    log_info "Repository exists, updating..."
    cd "$INSTALL_DIR"
    sudo -u "$APP_USER" git fetch origin >/dev/null 2>&1 || true
    sudo -u "$APP_USER" git checkout "$BRANCH" >/dev/null 2>&1 || true
    sudo -u "$APP_USER" git pull origin "$BRANCH" >/dev/null 2>&1 || true
    log_success "Repository updated"
else
    log_info "Cloning repository..."
    sudo rm -rf "$INSTALL_DIR"
    sudo mkdir -p "$INSTALL_DIR"
    sudo chown "$APP_USER:$APP_USER" "$INSTALL_DIR"
    sudo -u "$APP_USER" git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$INSTALL_DIR" >/dev/null 2>&1 || \
    sudo -u "$APP_USER" git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" >/dev/null 2>&1
    log_success "Repository cloned"
fi

# Step 5: Find free port
APP_PORT=$(find_free_port 3000)
log_success "Using port: $APP_PORT"

# Step 6: Install dependencies
log_info "Installing dependencies..."
cd "$INSTALL_DIR"
sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash << 'INSTALL_DEPS'
set -e
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci >/dev/null 2>&1 || npm install >/dev/null 2>&1
INSTALL_DEPS
log_success "Dependencies installed"

# Step 7: Create .env.local if not exists
if [ ! -f "$INSTALL_DIR/.env.local" ]; then
    log_info "Creating .env.local..."
    sudo -u "$APP_USER" tee "$INSTALL_DIR/.env.local" >/dev/null << EOF
# Secure AI Chat - Environment Variables
# Add your API keys here

OPENAI_API_KEY=
LAKERA_AI_KEY=
LAKERA_ENDPOINT=https://api.lakera.ai/v2/guard
LAKERA_PROJECT_ID=
NEXT_PUBLIC_APP_NAME=Secure AI Chat
NEXT_PUBLIC_APP_VERSION=1.0.8
PORT=$APP_PORT
HOSTNAME=0.0.0.0
NODE_ENV=production
EOF
    log_success ".env.local created"
else
    # Update PORT in existing .env.local
    if ! grep -q "^PORT=" "$INSTALL_DIR/.env.local" 2>/dev/null; then
        echo "PORT=$APP_PORT" | sudo -u "$APP_USER" tee -a "$INSTALL_DIR/.env.local" >/dev/null
    else
        sudo sed -i "s/^PORT=.*/PORT=$APP_PORT/" "$INSTALL_DIR/.env.local"
    fi
    log_success ".env.local exists, updated PORT"
fi

log_warning "IMPORTANT: Edit $INSTALL_DIR/.env.local and add your API keys before starting the service"

# Step 8: Build application
log_info "Building application..."
cd "$INSTALL_DIR"
sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash << 'BUILD'
set -e
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm run build >/dev/null 2>&1
BUILD
log_success "Application built"

# Step 9: Create systemd service
log_info "Creating systemd service..."
sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null << EOF
[Unit]
Description=Secure AI Chat Application
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="PORT=$APP_PORT"
Environment="HOSTNAME=0.0.0.0"

# Source .env.local
EnvironmentFile=$INSTALL_DIR/.env.local

ExecStart=$NPM_PATH start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

NoNewPrivileges=true
PrivateTmp=true
ReadWritePaths=$INSTALL_DIR/.secure-storage $INSTALL_DIR/.next

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
log_success "systemd service created"

# Step 10: Install and configure nginx
log_info "Installing nginx..."
sudo apt-get install -y -qq nginx >/dev/null

log_info "Configuring nginx reverse proxy..."
sudo tee "/etc/nginx/sites-available/${NGINX_SITE}" >/dev/null << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site and remove default
sudo ln -sf "/etc/nginx/sites-available/${NGINX_SITE}" "/etc/nginx/sites-enabled/${NGINX_SITE}"
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t >/dev/null 2>&1
log_success "nginx configured"

# Step 11: Configure UFW firewall
log_info "Configuring firewall..."
sudo ufw allow 22/tcp >/dev/null 2>&1 || true
sudo ufw allow 'Nginx Full' >/dev/null 2>&1 || true
echo "y" | sudo ufw --force enable >/dev/null 2>&1 || true
log_success "Firewall configured"

# Step 12: Start services
log_info "Starting services..."
sudo systemctl enable "$SERVICE_NAME" >/dev/null 2>&1
sudo systemctl restart "$SERVICE_NAME" >/dev/null 2>&1
sudo systemctl restart nginx >/dev/null 2>&1
sleep 2

# Step 13: Smoke checks
log_info "Running smoke checks..."
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    log_success "Service is running"
else
    log_error "Service failed to start"
    sudo systemctl status "$SERVICE_NAME" --no-pager -l
    exit 1
fi

if curl -sf http://localhost:$APP_PORT/api/health >/dev/null 2>&1; then
    log_success "Health endpoint responds"
else
    log_warning "Health endpoint check failed (service may still be starting)"
fi

if curl -sf http://localhost/api/health >/dev/null 2>&1; then
    log_success "Nginx proxy works"
else
    log_warning "Nginx proxy check failed"
fi

# Step 14: Print final instructions
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "YOUR_VM_IP")

echo ""
log_success "Installation complete!"
echo ""
echo "Application is running on:"
echo "  - Internal: http://localhost:$APP_PORT"
echo "  - Public: http://$PUBLIC_IP (via nginx on port 80)"
echo ""
echo "Next steps:"
echo "1. Edit $INSTALL_DIR/.env.local and add your API keys:"
echo "   sudo nano $INSTALL_DIR/.env.local"
echo ""
echo "2. Restart the service after adding API keys:"
echo "   sudo systemctl restart $SERVICE_NAME"
echo ""
echo "3. Check logs:"
echo "   sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "4. Check nginx logs:"
echo "   sudo tail -f /var/log/nginx/access.log"
echo ""
