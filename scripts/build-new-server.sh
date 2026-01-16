#!/usr/bin/env bash
# Build Brand New App Server with Latest Code Release
# Single-step script for fresh Ubuntu/Debian server installation
# Fixed version - handles all permission issues correctly
# 
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/build-new-server.sh | sudo bash
#   OR
#   wget -qO- https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/build-new-server.sh | sudo bash
#   OR
#   sudo bash scripts/build-new-server.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
REPO_URL="${REPO_URL:-https://github.com/mazh-cp/secure-ai-chat.git}"
GIT_REF="${GIT_REF:-main}"
APP_DIR="${APP_DIR:-/opt/secure-ai-chat}"
APP_USER="${APP_USER:-secureai}"
NODE_VERSION="${NODE_VERSION:-24.13.0}"
SERVICE_NAME="secure-ai-chat"
ENV_FILE="/etc/secure-ai-chat.env"

# Logging functions
say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; exit 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }
step() { echo -e "${CYAN}▶${NC} $*"; }

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  fail "This script must be run as root (use sudo)"
fi

# Main execution
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Build Brand New App Server - Latest Code Release         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Repository: $REPO_URL"
say "Git Reference: $GIT_REF"
say "App Directory: $APP_DIR"
say "App User: $APP_USER"
say "Node.js Version: v${NODE_VERSION} (LTS)"
echo ""

# Step 1: Detect OS and install prerequisites
say "Step 1: Installing OS Prerequisites"

if [ -f /etc/os-release ]; then
  # shellcheck source=/dev/null
  . /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_VERSION="${VERSION_ID:-unknown}"
else
  OS_ID="unknown"
  OS_VERSION="unknown"
fi

say "Detected OS: $OS_ID $OS_VERSION"

if [[ "$OS_ID" =~ ^(ubuntu|debian)$ ]]; then
  step "Updating package lists..."
  apt-get update -qq > /dev/null 2>&1
  
  step "Installing required packages..."
  apt-get install -y -qq \
    curl \
    git \
    build-essential \
    ca-certificates \
    gnupg \
    lsb-release \
    iproute2 \
    > /dev/null 2>&1
  
  ok "OS prerequisites installed"
else
  warn "OS not recognized: $OS_ID"
  warn "Please ensure the following are installed:"
  echo "  - curl"
  echo "  - git"
  echo "  - build-essential (or equivalent)"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    fail "Aborted by user"
  fi
fi

# Step 2: Create app user
say "Step 2: Creating Application User"

if ! id "$APP_USER" &>/dev/null; then
  step "Creating user: $APP_USER"
  useradd -r -s /bin/bash -d "$APP_DIR" "$APP_USER" 2>/dev/null || \
  useradd -s /bin/bash -d "$APP_DIR" "$APP_USER"
  ok "User created: $APP_USER"
else
  ok "User already exists: $APP_USER"
fi

# Step 3: Handle existing directory
say "Step 3: Handling Application Directory"

if [ -d "$APP_DIR" ]; then
  warn "Directory exists: $APP_DIR"
  
  # Check if it's a git repository
  if [ -d "$APP_DIR/.git" ]; then
    warn "Git repository already exists, will update it"
    # Don't backup, just proceed with update in Step 5
  else
    # Not a git repo, backup if not empty
    if [ "$(ls -A "$APP_DIR" 2>/dev/null | head -1)" ]; then
      warn "Directory is not empty and not a git repo, backing up..."
      BACKUP_DIR="${APP_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
      
      if mv "$APP_DIR" "$BACKUP_DIR" 2>/dev/null; then
        warn "Backup created: $BACKUP_DIR"
      else
        # If mv fails, try copying
        warn "Moving failed, copying instead..."
        cp -a "$APP_DIR" "$BACKUP_DIR" 2>/dev/null
        rm -rf "$APP_DIR" 2>/dev/null || true
        warn "Backup created: $BACKUP_DIR"
      fi
      
      # Ensure directory is gone
      sleep 1
      if [ -d "$APP_DIR" ]; then
        warn "Force removing directory..."
        rm -rf "$APP_DIR"
        sleep 1
      fi
    fi
  fi
fi

# Create directory with proper ownership if it doesn't exist
if [ ! -d "$APP_DIR" ]; then
  mkdir -p "$APP_DIR"
  chown "$APP_USER:$APP_USER" "$APP_DIR"
  chmod 755 "$APP_DIR"
  ok "Directory created: $APP_DIR"
fi

# Ensure proper ownership
chown -R "$APP_USER:$APP_USER" "$APP_DIR" 2>/dev/null || true
ok "Directory ownership set: $APP_DIR"

# Step 4: Install Node.js via nvm
say "Step 4: Installing Node.js v${NODE_VERSION} via nvm"

# Install nvm and Node.js as app user
# Use a script file approach to avoid heredoc issues
NVM_SCRIPT=$(mktemp)
cat > "$NVM_SCRIPT" << 'NVM_SCRIPT_CONTENT'
#!/usr/bin/env bash
set -eo pipefail

APP_DIR="$1"
NODE_VERSION="$2"

export HOME="$APP_DIR"
export NVM_DIR="$HOME/.nvm"

# Install nvm if not exists
if [ ! -d "$NVM_DIR" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash >/dev/null 2>&1
fi

# Load nvm (disable strict mode for nvm)
set +u
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
set -e

# Install Node.js
if [ -s "$NVM_DIR/nvm.sh" ]; then
  \. "$NVM_DIR/nvm.sh"
  
  if nvm list 2>/dev/null | grep -q "v${NODE_VERSION}"; then
    nvm use ${NODE_VERSION} >/dev/null 2>&1 || nvm install ${NODE_VERSION} >/dev/null 2>&1
    nvm alias default ${NODE_VERSION} >/dev/null 2>&1
  else
    nvm install ${NODE_VERSION} >/dev/null 2>&1
    nvm use ${NODE_VERSION} >/dev/null 2>&1
    nvm alias default ${NODE_VERSION} >/dev/null 2>&1
  fi
  
  # Verify installation
  node -v
  npm -v
else
  echo "nvm not found" >&2
  exit 1
fi
NVM_SCRIPT_CONTENT

chmod +x "$NVM_SCRIPT"

# Run as app user
if sudo -u "$APP_USER" HOME="$APP_DIR" bash "$NVM_SCRIPT" "$APP_DIR" "${NODE_VERSION}" > /tmp/nvm-install.log 2>&1; then
  ok "Node.js v${NODE_VERSION} installed"
  cat /tmp/nvm-install.log | tail -2
else
  fail "Node.js installation failed"
  cat /tmp/nvm-install.log | tail -20
  rm -f "$NVM_SCRIPT"
  exit 1
fi

# Clean up script
rm -f "$NVM_SCRIPT"

# Step 5: Clone or update repository
say "Step 5: Cloning/Updating Repository"

# Check if already a git repository
if [ -d "$APP_DIR/.git" ]; then
  step "Repository exists, updating..."
  
  sudo -u "$APP_USER" HOME="$APP_DIR" bash << 'GIT_UPDATE'
set -eo pipefail
cd "$APP_DIR"
export HOME="$APP_DIR"
export NVM_DIR="$HOME/.nvm"
set +u
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
set -e

git fetch origin --tags -q
git checkout "$GIT_REF" -q || git checkout -b "$GIT_REF" origin/"$GIT_REF" 2>/dev/null || true
git pull origin "$GIT_REF" -q || true
GIT_UPDATE
  
  ok "Repository updated"
else
  # Not a git repo, clone fresh
  step "Cloning repository..."
  
  # Clone as app user directly (directory exists and is owned by app user)
  # Use a simpler approach: clone to a sibling directory, then move
  PARENT_DIR="$(dirname "$APP_DIR")"
  TEMP_NAME="secure-ai-chat-clone-$(date +%s)"
  TEMP_DIR="$PARENT_DIR/$TEMP_NAME"
  
  # Clone to temp location first
  sudo -u "$APP_USER" HOME="$APP_DIR" bash << 'GIT_CLONE'
set -eo pipefail
export HOME="$APP_DIR"

cd "$PARENT_DIR"
git clone "$REPO_URL" "$TEMP_NAME" -q

cd "$TEMP_DIR"
git checkout "$GIT_REF" -q 2>/dev/null || true
GIT_CLONE
  
  # Verify clone succeeded
  if [ ! -d "$TEMP_DIR/.git" ]; then
    fail "Repository clone failed"
  fi
  
  # Remove old directory contents if exists (but not .git)
  if [ -d "$APP_DIR" ] && [ "$(ls -A "$APP_DIR" 2>/dev/null | grep -v '^\.$' | grep -v '^\.\.$' | head -1)" ]; then
    warn "Cleaning old directory contents..."
    find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} + 2>/dev/null || true
  fi
  
  # Move all contents from temp to final location (as root)
  if [ -d "$TEMP_DIR" ]; then
    mv "$TEMP_DIR"/* "$APP_DIR/" 2>/dev/null || true
    mv "$TEMP_DIR"/.* "$APP_DIR/" 2>/dev/null || true
    rm -rf "$TEMP_DIR" 2>/dev/null || true
  fi
  
  # Ensure proper ownership
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  
  # Verify git repository exists
  if [ -d "$APP_DIR/.git" ]; then
    ok "Repository cloned"
  else
    fail "Repository clone verification failed"
  fi
fi

# Step 6: Install dependencies
say "Step 6: Installing Dependencies"

# Create install script to avoid heredoc issues
INSTALL_SCRIPT=$(mktemp)
cat > "$INSTALL_SCRIPT" << 'INSTALL_SCRIPT_CONTENT'
#!/usr/bin/env bash
set -eo pipefail

APP_DIR="$1"
NODE_VERSION="$2"

cd "$APP_DIR"
export HOME="$APP_DIR"
export NVM_DIR="$HOME/.nvm"
set +u
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use ${NODE_VERSION} >/dev/null 2>&1 || true
set -e

# Detect package manager
if [ -f "pnpm-lock.yaml" ]; then
  PM="pnpm"
  INSTALL_CMD="pnpm install --frozen-lockfile"
elif [ -f "yarn.lock" ]; then
  PM="yarn"
  INSTALL_CMD="yarn install --immutable || yarn install --frozen-lockfile"
elif [ -f "package-lock.json" ]; then
  PM="npm"
  INSTALL_CMD="npm ci"
else
  PM="npm"
  INSTALL_CMD="npm install"
fi

echo "Package manager: $PM"
eval "$INSTALL_CMD"
INSTALL_SCRIPT_CONTENT

chmod +x "$INSTALL_SCRIPT"

# Run as app user
if sudo -u "$APP_USER" HOME="$APP_DIR" bash "$INSTALL_SCRIPT" "$APP_DIR" "${NODE_VERSION}" > /tmp/install-deps.log 2>&1; then
  ok "Dependencies installed"
else
  fail "Dependency installation failed"
  cat /tmp/install-deps.log | tail -30
  rm -f "$INSTALL_SCRIPT"
  exit 1
fi

rm -f "$INSTALL_SCRIPT"


# Step 7: Run release gate (if available)
say "Step 7: Running Release Gate Validation"

if [ -f "$APP_DIR/scripts/release-gate.sh" ]; then
  # Create release gate script
  RELEASE_GATE_SCRIPT=$(mktemp)
  cat > "$RELEASE_GATE_SCRIPT" << 'RELEASE_GATE_SCRIPT_CONTENT'
#!/usr/bin/env bash
set -eo pipefail

APP_DIR="$1"
NODE_VERSION="$2"

cd "$APP_DIR"
export HOME="$APP_DIR"
export NVM_DIR="$HOME/.nvm"
set +u
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use ${NODE_VERSION} >/dev/null 2>&1 || true
set -e

bash scripts/release-gate.sh > /tmp/release-gate.log 2>&1
RELEASE_GATE_SCRIPT_CONTENT

  chmod +x "$RELEASE_GATE_SCRIPT"
  
  if sudo -u "$APP_USER" HOME="$APP_DIR" bash "$RELEASE_GATE_SCRIPT" "$APP_DIR" "${NODE_VERSION}" 2>&1; then
    ok "Release gate passed"
  else
    warn "Release gate failed (check /tmp/release-gate.log)"
    warn "Continuing with build anyway..."
  fi
  
  rm -f "$RELEASE_GATE_SCRIPT"
else
  warn "Release gate script not found, skipping"
fi

# Step 8: Build production bundle
say "Step 8: Building Production Bundle"

# Create build script
BUILD_SCRIPT=$(mktemp)
cat > "$BUILD_SCRIPT" << 'BUILD_SCRIPT_CONTENT'
#!/usr/bin/env bash
set -eo pipefail

APP_DIR="$1"
NODE_VERSION="$2"

cd "$APP_DIR"
export HOME="$APP_DIR"
export NVM_DIR="$HOME/.nvm"
set +u
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use ${NODE_VERSION} >/dev/null 2>&1 || true
set -e

# Detect package manager
if [ -f "pnpm-lock.yaml" ]; then
  RUN_CMD="pnpm"
elif [ -f "yarn.lock" ]; then
  RUN_CMD="yarn"
else
  RUN_CMD="npm"
fi

$RUN_CMD run build
BUILD_SCRIPT_CONTENT

chmod +x "$BUILD_SCRIPT"

# Run as app user
if sudo -u "$APP_USER" HOME="$APP_DIR" bash "$BUILD_SCRIPT" "$APP_DIR" "${NODE_VERSION}" > /tmp/build.log 2>&1; then
  ok "Build completed"
  
  # Verify build output
  if [ -d "$APP_DIR/.next" ]; then
    ok "Build output verified"
  else
    fail "Build output (.next) not found"
  fi
else
  fail "Build failed"
  cat /tmp/build.log | tail -30
  rm -f "$BUILD_SCRIPT"
  exit 1
fi

rm -f "$BUILD_SCRIPT"

# Step 9: Create environment file
say "Step 9: Creating Environment File"

if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" << 'ENV_TEMPLATE'
# Secure AI Chat - Environment Variables
# DO NOT commit this file with actual secrets
# Configure API keys via Settings page UI (stored in .secure-storage/)

# Application
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# API Keys (optional - can be configured via UI)
# OPENAI_API_KEY=
# LAKERA_AI_KEY=
# CHECKPOINT_TE_API_KEY=

# Check Point WAF (optional)
# WAF_AUTH_ENABLED=false
# WAF_API_KEY=
ENV_TEMPLATE
  chmod 600 "$ENV_FILE"
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  ok "Environment file created: $ENV_FILE"
else
  ok "Environment file already exists: $ENV_FILE"
fi

# Step 10: Create systemd service
say "Step 10: Creating Systemd Service"

SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

if [ -f "$APP_DIR/scripts/deploy/secure-ai-chat.service" ]; then
  # Use template from repository
  sed "s|{{APP_DIR}}|$APP_DIR|g" "$APP_DIR/scripts/deploy/secure-ai-chat.service" | \
  sed "s|{{APP_USER}}|$APP_USER|g" | \
  sed "s|{{NODE_VERSION}}|${NODE_VERSION}|g" > "$SERVICE_FILE"
else
  # Create service file manually
  cat > "$SERVICE_FILE" << SERVICE_TEMPLATE
[Unit]
Description=Secure AI Chat Application
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}

# Load nvm and use correct Node.js version
ExecStart=/usr/bin/env bash -lc 'export HOME=${APP_DIR} && source "\${HOME}/.nvm/nvm.sh" && nvm use ${NODE_VERSION} && cd ${APP_DIR} && npm start'

Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

# Security
NoNewPrivileges=true
PrivateTmp=true
ReadWritePaths=${APP_DIR}/.secure-storage ${APP_DIR}/.next ${APP_DIR}/.storage

[Install]
WantedBy=multi-user.target
SERVICE_TEMPLATE
fi

systemctl daemon-reload
ok "Systemd service created: $SERVICE_FILE"

# Step 11: Enable and start service
say "Step 11: Enabling and Starting Service"

systemctl enable "$SERVICE_NAME" >/dev/null 2>&1
if systemctl start "$SERVICE_NAME"; then
  ok "Service started"
  sleep 5
  
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    ok "Service is running"
  else
    warn "Service may not be running, check status:"
    echo "  sudo systemctl status $SERVICE_NAME"
  fi
else
  warn "Failed to start service automatically"
  echo "Start manually: sudo systemctl start $SERVICE_NAME"
fi

# Step 12: Run smoke tests (if available)
say "Step 12: Running Smoke Tests"

if [ -f "$APP_DIR/scripts/smoke-test.sh" ]; then
  sleep 3  # Give server time to fully start
  
  # Create smoke test script
  SMOKE_TEST_SCRIPT=$(mktemp)
  cat > "$SMOKE_TEST_SCRIPT" << 'SMOKE_TEST_SCRIPT_CONTENT'
#!/usr/bin/env bash
set -eo pipefail

APP_DIR="$1"

cd "$APP_DIR"
export HOME="$APP_DIR"

BASE_URL=http://localhost:3000 bash scripts/smoke-test.sh
SMOKE_TEST_SCRIPT_CONTENT

  chmod +x "$SMOKE_TEST_SCRIPT"
  
  if sudo -u "$APP_USER" HOME="$APP_DIR" bash "$SMOKE_TEST_SCRIPT" "$APP_DIR" 2>&1; then
    ok "Smoke tests passed"
  else
    warn "Smoke tests failed (service may need configuration)"
  fi
  
  rm -f "$SMOKE_TEST_SCRIPT"
else
  warn "Smoke test script not found, skipping"
fi

# Success summary
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              ✅ SERVER BUILD: SUCCESS                         ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Brand new server built and configured successfully.          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Installation Summary:"
echo "  • App Directory: $APP_DIR"
echo "  • App User: $APP_USER"
echo "  • Service: $SERVICE_NAME"
echo "  • Environment File: $ENV_FILE"
echo "  • Node.js Version: v${NODE_VERSION}"
echo ""
say "Next Steps:"
echo "  1. Configure API keys:"
echo "     - Via Settings UI: http://YOUR_SERVER_IP:3000/settings"
echo "     - Or edit: $ENV_FILE"
echo ""
echo "  2. Check service status:"
echo "     sudo systemctl status $SERVICE_NAME"
echo ""
echo "  3. View logs:"
echo "     sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "  4. Access application:"
echo "     http://YOUR_SERVER_IP:3000"
echo ""
echo "  5. Configure firewall (if needed):"
echo "     sudo ufw allow 3000/tcp"
echo ""
exit 0
