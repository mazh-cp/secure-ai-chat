#!/usr/bin/env bash
# Secure AI Chat - Clean install on a fresh Ubuntu VM (from GitHub via curl)
#
# Includes latest fixes: Chat uses both RAG (uploaded files) and model knowledge
# for answers—general questions answered from model, file-related queries use RAG.
#
# --- ONE-LINER (run on the VM, not as root) ---
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_clean.sh | bash
#
# --- CLEAN INSTALL (wipe existing + fresh clone, preserves API keys) ---
#   FORCE_CLEAN=1 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_clean.sh | bash
#
# Overrides (optional):
#   INSTALL_DIR=/opt/secure-ai-chat BRANCH=main curl -fsSL ... | bash
#   FORCE_CLEAN=1 INSTALL_DIR=/opt/secure-ai-chat curl -fsSL ... | bash
#
# Repo: https://github.com/mazh-cp/secure-ai-chat
#
# Checklist (all done by this script):
#   1. System prerequisites (apt update, curl/git/build-essential/...)
#   2. App user and install directory
#   3. Node.js + npm via nvm (verified before clone)
#   4. Clone repository from GitHub (main or BRANCH)
#   5. npm ci
#   6. Remove .next and node_modules/.cache for clean build
#   7. npm run build
#   8. .env.local (create or update PORT)
#   9. systemd service
#  10. UFW firewall (SSH + port 3000 only; no nginx / no port 80)
#  11. Start service, smoke check, final instructions (app on port 3000 only)
#
# Usage (local):
#   bash scripts/install_ubuntu_clean.sh

set -euxo pipefail

# Configuration (override with env)
REPO_URL="${REPO_URL:-https://github.com/mazh-cp/secure-ai-chat.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/secure-ai-chat}"
BRANCH="${BRANCH:-main}"
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

log_info "=== Secure AI Chat: Clean install on fresh Ubuntu VM ==="
log_info "Install directory: $INSTALL_DIR"
log_info "Branch: $BRANCH"
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
sudo chown "$APP_USER:$APP_USER" "$INSTALL_DIR" 2>/dev/null || true

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
# Verify as APP_USER (script user may not have execute permission on INSTALL_DIR)
[ -z "$NODE_PATH" ] && { log_error "Node.js not found after nvm install"; exit 1; }
sudo -u "$APP_USER" test -x "$NODE_PATH" || { log_error "Node.js not executable at $NODE_PATH"; exit 1; }
[ -z "$NPM_PATH" ] && { log_error "npm not found"; exit 1; }
sudo -u "$APP_USER" test -x "$NPM_PATH" || { log_error "npm not executable at $NPM_PATH"; exit 1; }
log_success "Phase 3 done: Node and npm verified at $NODE_PATH"

# --- Phase 4: Clone repository (keep .nvm from Phase 3) ---
log_info "Phase 4: Cloning repository (branch: $BRANCH)..."
if [ -d "$INSTALL_DIR/.git" ]; then
  sudo -u "$APP_USER" git -C "$INSTALL_DIR" fetch origin >/dev/null 2>&1 || true
  sudo -u "$APP_USER" git -C "$INSTALL_DIR" checkout "$BRANCH" >/dev/null 2>&1 || true
  sudo -u "$APP_USER" git -C "$INSTALL_DIR" pull origin "$BRANCH" >/dev/null 2>&1 || true
  log_success "Phase 4 done: Repository updated"
else
  TMP_CLONE=$(mktemp -d)
  sudo chown "$APP_USER:$APP_GROUP" "$TMP_CLONE"
  if ! sudo -u "$APP_USER" git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$TMP_CLONE"; then
    log_info "Retrying clone without branch (uses default)..."
    sudo -u "$APP_USER" git clone --depth 1 "$REPO_URL" "$TMP_CLONE" || { log_error "Clone failed. Check network, REPO_URL=$REPO_URL BRANCH=$BRANCH"; exit 1; }
  fi
  # Locate package.json (at root or in a subdir); if find returns a path, file exists (no -f test - dir is 700)
  _pj=$(sudo find "$TMP_CLONE" -maxdepth 2 -name "package.json" -type f 2>/dev/null | head -1)
  if [ -z "$_pj" ]; then
    log_error "Clone has no package.json. REPO_URL=$REPO_URL BRANCH=$BRANCH"
    log_error "Contents of clone dir:"
    sudo ls -la "$TMP_CLONE" 2>/dev/null | head -10
    exit 1
  fi
  sudo rsync -a "$TMP_CLONE/" "$INSTALL_DIR/"
  sudo chown -R "$APP_USER:$APP_GROUP" "$INSTALL_DIR"
  sudo rm -rf "$TMP_CLONE"
  # If repo root lacks package.json, find the subdir that has it (use sudo - script may run as different user)
  if ! sudo test -f "$INSTALL_DIR/package.json" 2>/dev/null; then
    _pj_dir=$(sudo find "$INSTALL_DIR" -maxdepth 2 -name "package.json" -type f 2>/dev/null | head -1)
    if [ -n "$_pj_dir" ]; then
      SUBDIR=$(sudo dirname "$_pj_dir")
      if [ "$SUBDIR" != "$INSTALL_DIR" ]; then
        log_info "Flattening repo subdirectory ($SUBDIR) into install dir..."
        sudo rsync -a "${SUBDIR}/" "$INSTALL_DIR/"
        sudo rm -rf "$SUBDIR"
        sudo chown -R "$APP_USER:$APP_GROUP" "$INSTALL_DIR"
      fi
    fi
  fi
  log_success "Phase 4 done: Repository cloned (kept .nvm)"
fi
# Verify key files exist (use sudo - INSTALL_DIR may be owned by APP_USER)
for f in package.json lib/uuid.ts scripts/start-standalone.js; do
  sudo test -f "$INSTALL_DIR/$f" 2>/dev/null || { log_error "Missing after clone: $f"; exit 1; }
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

# --- Phase 6: Clean build (no stale .next or cache) ---
log_info "Phase 6: Removing any stale build and caches..."
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

# --- Port and .env.local ---
APP_PORT=$(find_free_port 3000)
if [ ! -f "$INSTALL_DIR/.env.local" ]; then
  sudo -u "$APP_USER" tee "$INSTALL_DIR/.env.local" >/dev/null << EOF
# Secure AI Chat - add your API keys
OPENAI_API_KEY=
LAKERA_AI_KEY=
LAKERA_ENDPOINT=https://api.lakera.ai/v2/guard
LAKERA_PROJECT_ID=
NEXT_PUBLIC_APP_NAME=Secure AI Chat
NEXT_PUBLIC_APP_VERSION=1.0.0
PORT=$APP_PORT
HOSTNAME=0.0.0.0
NODE_ENV=production
EOF
  log_success ".env.local created"
else
  sudo sed -i "s/^PORT=.*/PORT=$APP_PORT/" "$INSTALL_DIR/.env.local" 2>/dev/null || echo "PORT=$APP_PORT" | sudo -u "$APP_USER" tee -a "$INSTALL_DIR/.env.local" >/dev/null
  log_success ".env.local exists, PORT=$APP_PORT"
fi
log_warning "IMPORTANT: Add your API keys to $INSTALL_DIR/.env.local and restart the service"

# --- systemd ---
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

# --- UFW (port 3000 only; no nginx / no port 80) ---
log_info "Configuring firewall (SSH + app port $APP_PORT only)..."
sudo ufw allow 22/tcp >/dev/null 2>&1 || true
sudo ufw allow ${APP_PORT}/tcp >/dev/null 2>&1 || true
echo "y" | sudo ufw --force enable >/dev/null 2>&1 || true
log_success "Firewall configured (app on port $APP_PORT only)"

# --- Start and verify ---
log_info "Starting service..."
sudo systemctl enable "$SERVICE_NAME" >/dev/null 2>&1
sudo systemctl restart "$SERVICE_NAME"
sleep 3

if ! sudo systemctl is-active --quiet "$SERVICE_NAME"; then
  log_error "Service failed to start"
  sudo systemctl status "$SERVICE_NAME" --no-pager -l
  exit 1
fi
log_success "Service is running"

curl -sf http://localhost:$APP_PORT/api/health >/dev/null 2>&1 && log_success "Health endpoint OK (port $APP_PORT)" || log_warning "Health check failed (may still be starting)"

PUBLIC_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || curl -s --max-time 3 ipinfo.io/ip 2>/dev/null || echo "YOUR_VM_IP")
echo ""
log_success "=== Clean install complete ==="
echo ""
echo "  App:      http://$PUBLIC_IP:$APP_PORT (port $APP_PORT only; no nginx/80)"
echo "  Internal: http://localhost:$APP_PORT"
echo ""
echo "Next steps:"
echo "  1. Add API keys:  sudo nano $INSTALL_DIR/.env.local"
echo "  2. Restart:       sudo systemctl restart $SERVICE_NAME"
echo "  3. Logs:          sudo journalctl -u $SERVICE_NAME -f"
echo ""
