#!/usr/bin/env bash
# Secure AI Chat - Fresh install for version 1.0.16 (from GitHub via curl)
#
# Installs tag v1.0.16 from https://github.com/mazh-cp/secure-ai-chat
# Includes: DATA_DIR layout, preflight, storage-perms (v1.0.16+).
#
# --- ONE-LINER (run on Ubuntu VM, not as root) ---
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_fresh_v1.0.16.sh | bash
#
# --- From tag v1.0.16 (immutable script) ---
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/v1.0.16/scripts/install_fresh_v1.0.16.sh | bash
#
# --- Force clean (wipe existing install, preserve API keys) ---
#   FORCE_CLEAN=1 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_fresh_v1.0.16.sh | bash
#
# Overrides (optional):
#   INSTALL_DIR=/opt/secure-ai-chat DATA_DIR=/var/lib/secure-ai-chat curl -fsSL ... | bash
#
# Repo: https://github.com/mazh-cp/secure-ai-chat  (tag: v1.0.16)
#
# Checklist (all done by this script):
#   1. System prerequisites (apt, curl, git, build-essential, ...)
#   2. App user and install directory
#   3. Node.js 24.13.0 + npm via nvm
#   4. Clone repo and checkout tag v1.0.16
#   5. npm ci, clean .next/cache, npm run build
#   6. .env.local (PORT, DATA_DIR, NEXT_PUBLIC_APP_VERSION=1.0.16)
#   7. DATA_DIR creation and storage-perms (v1.0.16)
#   8. systemd service (ReadWritePaths include DATA_DIR)
#   9. nginx reverse proxy, UFW
#  10. Start service, health check, final instructions
#
# Usage (local):
#   bash scripts/install_fresh_v1.0.16.sh

set -euxo pipefail

# Configuration (override with env)
REPO_URL="${REPO_URL:-https://github.com/mazh-cp/secure-ai-chat.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/secure-ai-chat}"
# v1.0.16: DATA_DIR for uploads/derived/registry (production: /var/lib/secure-ai-chat)
DATA_DIR="${DATA_DIR:-/var/lib/secure-ai-chat}"
GIT_REF="${GIT_REF:-v1.0.16}"
FORCE_CLEAN="${FORCE_CLEAN:-0}"
APP_USER="${APP_USER:-secureai}"
APP_GROUP="${APP_GROUP:-secureai}"
NODE_VERSION="${NODE_VERSION:-24.13.0}"
NGINX_SITE="${NGINX_SITE:-secure-ai-chat}"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"

REQUIRED_PACKAGES=(curl git build-essential ca-certificates gnupg lsb-release iproute2)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*"; }

find_free_port() {
  local start_port=${1:-3000}
  local port=$start_port
  while [ $port -lt 4000 ]; do
    if command -v ss >/dev/null 2>&1; then
      if ! ss -tuln 2>/dev/null | grep -q ":$port "; then
        echo $port
        return 0
      fi
    elif command -v netstat >/dev/null 2>&1; then
      if ! netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo $port
        return 0
      fi
    else
      log_warning "Cannot check port availability, using $port"
      echo $port
      return 0
    fi
    port=$((port + 1))
  done
  log_error "Could not find free port in range 3000-3999"
  exit 1
}

if [ "$EUID" -eq 0 ]; then
  log_error "Do not run as root. Script uses sudo when needed."
  exit 1
fi

log_info "=== Secure AI Chat: Fresh install v1.0.16 ==="
log_info "Install directory: $INSTALL_DIR"
log_info "Data directory (v1.0.16): $DATA_DIR"
log_info "Git ref: $GIT_REF"
log_info "Node version: $NODE_VERSION"
[ "$FORCE_CLEAN" = "1" ] && log_info "FORCE_CLEAN=1: will wipe existing install and do fresh clone"

# --- Phase 1: System prerequisites ---
is_pkg_installed() { dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q "install ok installed"; }
log_info "Phase 1: System prerequisites..."
sudo apt-get update -qq
for pkg in "${REQUIRED_PACKAGES[@]}"; do
  if ! is_pkg_installed "$pkg"; then
    log_info "Installing $pkg..."
    sudo apt-get install -y -qq "$pkg" >/dev/null 2>&1 || { log_error "Failed to install $pkg"; exit 1; }
  fi
done
for cmd in curl git; do
  command -v "$cmd" >/dev/null 2>&1 || { log_error "Prerequisite not available: $cmd"; exit 1; }
done
is_pkg_installed build-essential || { log_error "build-essential not installed"; exit 1; }
log_success "Phase 1 done: prerequisites installed and verified"

# --- Phase 2: App user and directory ---
if ! id "$APP_USER" &>/dev/null; then
  log_info "Phase 2: Creating user $APP_USER..."
  sudo useradd -r -s /bin/bash -d "$INSTALL_DIR" "$APP_USER" 2>/dev/null || \
  sudo useradd -s /bin/bash -d "$INSTALL_DIR" "$APP_USER"
else
  log_success "Phase 2: User $APP_USER already exists"
fi
sudo mkdir -p "$INSTALL_DIR"
sudo chown "$APP_USER:$APP_GROUP" "$INSTALL_DIR" 2>/dev/null || true

# --- DATA_DIR (v1.0.16): create and assign to app user ---
sudo mkdir -p "$DATA_DIR"
sudo chown "$APP_USER:$APP_GROUP" "$DATA_DIR"
log_success "DATA_DIR ready: $DATA_DIR"

# --- FORCE_CLEAN: Wipe existing install (preserve config), force fresh clone ---
if [ "$FORCE_CLEAN" = "1" ] && [ -d "$INSTALL_DIR" ] && { [ -d "$INSTALL_DIR/.git" ] || [ -f "$INSTALL_DIR/package.json" ]; }; then
  log_info "FORCE_CLEAN: Wiping existing install, backing up config..."
  sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  _backup="/tmp/secure-ai-chat-force-clean-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$_backup"
  [ -f "$INSTALL_DIR/.env.local" ] && sudo cp -a "$INSTALL_DIR/.env.local" "$_backup/" 2>/dev/null || true
  [ -d "$INSTALL_DIR/.secure-storage" ] && sudo cp -a "$INSTALL_DIR/.secure-storage" "$_backup/" 2>/dev/null || true
  log_info "Clearing $INSTALL_DIR (full wipe)..."
  sudo find "$INSTALL_DIR" -mindepth 1 -delete 2>/dev/null || true
  sudo mkdir -p "$INSTALL_DIR"
  sudo chown "$APP_USER:$APP_GROUP" "$INSTALL_DIR"
  [ -f "$_backup/.env.local" ] && sudo cp -a "$_backup/.env.local" "$INSTALL_DIR/" 2>/dev/null || true
  [ -d "$_backup/.secure-storage" ] && sudo cp -a "$_backup/.secure-storage" "$INSTALL_DIR/" 2>/dev/null || true
  sudo chown -R "$APP_USER:$APP_GROUP" "$INSTALL_DIR" 2>/dev/null || true
  log_success "Wiped. Config restored from $_backup"
fi

# --- Phase 3: Node.js + npm via nvm ---
log_info "Phase 3: Installing Node.js $NODE_VERSION via nvm..."
sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash << NVM_SCRIPT
set -e
export HOME=$INSTALL_DIR
export NVM_DIR="\$HOME/.nvm"
[ ! -d "\$NVM_DIR" ] && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash >/dev/null 2>&1
[ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"
if nvm list 2>/dev/null | grep -q "v${NODE_VERSION}"; then
  nvm use ${NODE_VERSION} >/dev/null 2>&1
  nvm alias default ${NODE_VERSION} >/dev/null 2>&1
else
  nvm install ${NODE_VERSION} >/dev/null 2>&1
  nvm use ${NODE_VERSION} >/dev/null 2>&1
  nvm alias default ${NODE_VERSION} >/dev/null 2>&1
fi
node -v
npm -v
NVM_SCRIPT

NODE_PATH=$(sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash << GET_NODE
export HOME="$INSTALL_DIR"
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"
which node
GET_NODE
)
NPM_PATH="${NODE_PATH%/node}/npm"
[ -z "$NODE_PATH" ] && { log_error "Node.js not found after nvm install"; exit 1; }
sudo -u "$APP_USER" test -x "$NODE_PATH" || { log_error "Node.js not executable at $NODE_PATH"; exit 1; }
[ -z "$NPM_PATH" ] && { log_error "npm not found"; exit 1; }
sudo -u "$APP_USER" test -x "$NPM_PATH" || { log_error "npm not executable at $NPM_PATH"; exit 1; }
log_success "Phase 3 done: Node and npm verified at $NODE_PATH"

# --- Phase 4: Clone repository at tag v1.0.16 ---
log_info "Phase 4: Cloning repository (ref: $GIT_REF)..."
if [ -d "$INSTALL_DIR/.git" ]; then
  sudo -u "$APP_USER" git -C "$INSTALL_DIR" fetch origin tag "$GIT_REF" --no-tags 2>/dev/null || sudo -u "$APP_USER" git -C "$INSTALL_DIR" fetch origin --tags 2>/dev/null || true
  sudo -u "$APP_USER" git -C "$INSTALL_DIR" checkout "$GIT_REF" 2>/dev/null || {
    log_warning "Checkout $GIT_REF failed, trying branch main..."
    sudo -u "$APP_USER" git -C "$INSTALL_DIR" checkout main 2>/dev/null || true
    sudo -u "$APP_USER" git -C "$INSTALL_DIR" pull origin main 2>/dev/null || true
  }
  log_success "Phase 4 done: Repository updated to $GIT_REF"
else
  TMP_CLONE=$(mktemp -d)
  sudo chown "$APP_USER:$APP_GROUP" "$TMP_CLONE"
  if ! sudo -u "$APP_USER" git clone --branch "$GIT_REF" --depth 1 "$REPO_URL" "$TMP_CLONE" 2>/dev/null; then
    log_info "Shallow clone by tag failed, cloning full then checking out $GIT_REF..."
    sudo -u "$APP_USER" git clone "$REPO_URL" "$TMP_CLONE" || { log_error "Clone failed. REPO_URL=$REPO_URL"; exit 1; }
    sudo -u "$APP_USER" git -C "$TMP_CLONE" checkout "$GIT_REF" || { log_error "Tag/branch $GIT_REF not found"; exit 1; }
  fi
  _pj=$(sudo find "$TMP_CLONE" -maxdepth 2 -name "package.json" -type f 2>/dev/null | head -1)
  if [ -z "$_pj" ]; then
    log_error "Clone has no package.json. REPO_URL=$REPO_URL GIT_REF=$GIT_REF"
    exit 1
  fi
  sudo rsync -a "$TMP_CLONE/" "$INSTALL_DIR/"
  sudo chown -R "$APP_USER:$APP_GROUP" "$INSTALL_DIR"
  sudo rm -rf "$TMP_CLONE"
  if ! sudo test -f "$INSTALL_DIR/package.json"; then
    SUBDIR=""
    for d in $(sudo find "$INSTALL_DIR" -maxdepth 1 -mindepth 1 -type d ! -name '.*' 2>/dev/null); do
      if sudo test -f "$d/package.json"; then SUBDIR="$d"; break; fi
    done
    if [ -n "$SUBDIR" ] && sudo test -f "$SUBDIR/package.json"; then
      log_info "Flattening repo subdirectory ($SUBDIR) into install dir..."
      sudo rsync -a "$SUBDIR/" "$INSTALL_DIR/"
      sudo rm -rf "$SUBDIR"
      sudo chown -R "$APP_USER:$APP_GROUP" "$INSTALL_DIR"
    fi
  fi
  log_success "Phase 4 done: Repository cloned at $GIT_REF (kept .nvm)"
fi
# Verify key files (use sudo: INSTALL_DIR may be owned by APP_USER, script runs as e.g. adminuser)
for f in package.json lib/uuid.ts scripts/start-standalone.js; do
  sudo test -f "$INSTALL_DIR/$f" || { log_error "Missing after clone: $f"; exit 1; }
done
log_success "Phase 4: Key files verified"

# --- Phase 5: Dependencies ---
log_info "Phase 5: Installing dependencies (npm ci)..."
sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash << INSTALL_DEPS
set -e
cd "$INSTALL_DIR"
export HOME="$INSTALL_DIR"
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"
npm ci >/dev/null 2>&1 || npm install >/dev/null 2>&1
INSTALL_DEPS
log_success "Phase 5 done: Dependencies installed"

# --- Phase 6: Clean build ---
log_info "Phase 6: Removing stale build and caches..."
sudo -u "$APP_USER" rm -rf "$INSTALL_DIR/.next" 2>/dev/null || true
sudo -u "$APP_USER" rm -rf "$INSTALL_DIR/node_modules/.cache" 2>/dev/null || true
log_success "Phase 6: Clean slate for build"

# --- Phase 7: Build ---
log_info "Phase 7: Building application..."
sudo -u "$APP_USER" HOME="$INSTALL_DIR" bash << BUILD
set -e
cd "$INSTALL_DIR"
export HOME="$INSTALL_DIR"
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"
npm run build >/dev/null 2>&1
BUILD
log_success "Phase 7 done: Application built"

# --- Port, DATA_DIR, and .env.local (v1.0.16) ---
APP_PORT=$(find_free_port 3000)
if ! sudo test -f "$INSTALL_DIR/.env.local"; then
  sudo -u "$APP_USER" tee "$INSTALL_DIR/.env.local" >/dev/null << EOF
# Secure AI Chat v1.0.16 - add your API keys
OPENAI_API_KEY=
LAKERA_AI_KEY=
LAKERA_ENDPOINT=https://api.lakera.ai/v2/guard
LAKERA_PROJECT_ID=
NEXT_PUBLIC_APP_NAME=Secure AI Chat
NEXT_PUBLIC_APP_VERSION=1.0.16
PORT=$APP_PORT
HOSTNAME=0.0.0.0
NODE_ENV=production
DATA_DIR=$DATA_DIR
EOF
  log_success ".env.local created (DATA_DIR=$DATA_DIR, version 1.0.16)"
else
  sudo sed -i "s/^PORT=.*/PORT=$APP_PORT/" "$INSTALL_DIR/.env.local" 2>/dev/null || true
  grep -q "^DATA_DIR=" "$INSTALL_DIR/.env.local" 2>/dev/null || echo "DATA_DIR=$DATA_DIR" | sudo tee -a "$INSTALL_DIR/.env.local" >/dev/null
  grep -q "^NEXT_PUBLIC_APP_VERSION=" "$INSTALL_DIR/.env.local" 2>/dev/null || echo "NEXT_PUBLIC_APP_VERSION=1.0.16" | sudo tee -a "$INSTALL_DIR/.env.local" >/dev/null
  sudo chown "$APP_USER:$APP_GROUP" "$INSTALL_DIR/.env.local" 2>/dev/null || true
  log_success ".env.local updated (PORT=$APP_PORT, DATA_DIR=$DATA_DIR)"
fi
log_warning "IMPORTANT: Add your API keys to $INSTALL_DIR/.env.local and restart the service"

# --- v1.0.16: Storage permissions ---
log_info "Applying storage permissions (v1.0.16)..."
if sudo test -x "$INSTALL_DIR/scripts/storage-perms.sh"; then
  DATA_DIR="$DATA_DIR" APP_USER="$APP_USER" sudo -E bash "$INSTALL_DIR/scripts/storage-perms.sh" || log_warning "storage-perms.sh had warnings (non-fatal)"
else
  sudo chown -R "$APP_USER:$APP_GROUP" "$DATA_DIR"
  sudo find "$DATA_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
  sudo find "$DATA_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
  log_success "DATA_DIR permissions set manually"
fi

# --- systemd (ReadWritePaths include DATA_DIR for v1.0.16) ---
log_info "Creating systemd service..."
sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null << EOF
[Unit]
Description=Secure AI Chat Application (v1.0.16)
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="PORT=$APP_PORT"
Environment="HOSTNAME=0.0.0.0"
Environment="DATA_DIR=$DATA_DIR"
EnvironmentFile=$INSTALL_DIR/.env.local
ExecStart=$NPM_PATH start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME
NoNewPrivileges=true
PrivateTmp=true
ReadWritePaths=$INSTALL_DIR/.secure-storage $INSTALL_DIR/.next $DATA_DIR

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
log_success "systemd service created"

# --- nginx ---
log_info "Installing and configuring nginx..."
sudo apt-get install -y -qq nginx >/dev/null
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
sudo ln -sf "/etc/nginx/sites-available/${NGINX_SITE}" "/etc/nginx/sites-enabled/${NGINX_SITE}"
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t >/dev/null 2>&1
log_success "nginx configured"

# --- UFW ---
log_info "Configuring firewall..."
sudo ufw allow 22/tcp >/dev/null 2>&1 || true
sudo ufw allow 'Nginx Full' >/dev/null 2>&1 || true
echo "y" | sudo ufw --force enable >/dev/null 2>&1 || true
log_success "Firewall configured"

# --- Start and verify ---
log_info "Starting services..."
sudo systemctl enable "$SERVICE_NAME" >/dev/null 2>&1
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl restart nginx
sleep 3

if ! sudo systemctl is-active --quiet "$SERVICE_NAME"; then
  log_error "Service failed to start"
  sudo systemctl status "$SERVICE_NAME" --no-pager -l
  exit 1
fi
log_success "Service is running"

curl -sf "http://localhost:$APP_PORT/api/health" >/dev/null 2>&1 && log_success "Health endpoint OK" || log_warning "Health check failed (may still be starting)"
curl -sf http://localhost/api/health >/dev/null 2>&1 && log_success "Nginx proxy OK" || log_warning "Nginx proxy check failed"

PUBLIC_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || curl -s --max-time 3 ipinfo.io/ip 2>/dev/null || echo "YOUR_VM_IP")
echo ""
log_success "=== Fresh install v1.0.16 complete ==="
echo ""
echo "  Version: 1.0.16"
echo "  App:      http://$PUBLIC_IP (port 80)"
echo "  Internal: http://localhost:$APP_PORT"
echo "  DATA_DIR: $DATA_DIR (v1.0.16 storage)"
echo ""
echo "Next steps:"
echo "  1. Add API keys:  sudo nano $INSTALL_DIR/.env.local"
echo "  2. Restart:       sudo systemctl restart $SERVICE_NAME"
echo "  3. Logs:           sudo journalctl -u $SERVICE_NAME -f"
echo "  4. Preflight:      DATA_DIR=$DATA_DIR sudo -u $APP_USER bash $INSTALL_DIR/scripts/preflight.sh"
echo ""
