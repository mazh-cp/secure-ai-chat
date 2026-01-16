#!/usr/bin/env bash
# Clean install on brand-new server
# Full setup from scratch

set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

# Parse arguments
APP_DIR=""
GIT_REF="main"
REPO_URL="https://github.com/mazh-cp/secure-ai-chat.git"
APP_USER="secureai"
SKIP_OS_DEPS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --ref)
      GIT_REF="$2"
      shift 2
      ;;
    --repo-url)
      REPO_URL="$2"
      shift 2
      ;;
    --app-user)
      APP_USER="$2"
      shift 2
      ;;
    --skip-os-deps)
      SKIP_OS_DEPS=true
      shift
      ;;
    *)
      echo "Usage: $0 --app-dir /opt/secure-ai-chat --ref main [--app-user secureai] [--skip-os-deps]"
      exit 1
      ;;
  esac
done

if [ -z "$APP_DIR" ]; then
  fail "--app-dir is required"
  exit 1
fi

# Main execution
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║            Clean Install on Brand-New Server                 ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "App directory: $APP_DIR"
say "Git reference: $GIT_REF"
say "App user: $APP_USER"
echo ""

# Step 1: Install OS prerequisites
say "Step 1: Checking OS Prerequisites"

if [ "$SKIP_OS_DEPS" = false ]; then
  # Detect OS version for better compatibility (matching local install-ubuntu.sh)
  OS_ID="unknown"
  OS_VERSION="unknown"
  if [ -f /etc/os-release ]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    OS_ID="${ID:-unknown}"
    OS_VERSION="${VERSION_ID:-unknown}"
    if [ -n "${NAME:-}" ]; then
      say "Detected: $NAME (${OS_ID} ${OS_VERSION})"
    else
      say "Detected: ${OS_ID} ${OS_VERSION}"
    fi
  else
    warn "Could not detect OS version (missing /etc/os-release)"
  fi
  
  # Validate OS support
  if [[ "$OS_ID" =~ ^(ubuntu|debian)$ ]]; then
    # Check minimum version (Ubuntu 20.04+ or Debian 11+ recommended)
    if [[ "$OS_ID" == "ubuntu" ]]; then
      VERSION_NUM=$(echo "$OS_VERSION" | cut -d'.' -f1)
      if [ -n "$VERSION_NUM" ] && [ "$VERSION_NUM" -lt 20 ] 2>/dev/null; then
        warn "Ubuntu version ${OS_VERSION} detected. Ubuntu 20.04+ is recommended."
      fi
    elif [[ "$OS_ID" == "debian" ]]; then
      VERSION_NUM=$(echo "$OS_VERSION" | cut -d'.' -f1)
      if [ -n "$VERSION_NUM" ] && [ "$VERSION_NUM" -lt 11 ] 2>/dev/null; then
        warn "Debian version ${OS_VERSION} detected. Debian 11+ is recommended."
      fi
    fi
    
    say "Updating package list..."
    if sudo apt-get update -qq; then
      ok "Package list updated"
    else
      warn "Package update had issues, continuing..."
    fi
    
    # Install essential packages for newer VMs (auto-install missing)
    PACKAGES=(
      curl
      git
      build-essential
      ca-certificates
      gnupg
      lsb-release
      iproute2
    )
    
    # Check which packages are missing
    MISSING_PKGS=()
    for pkg in "${PACKAGES[@]}"; do
      if ! dpkg -l | grep -q "^ii  $pkg "; then
        MISSING_PKGS+=("$pkg")
      fi
    done
    
    if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
      say "Installing missing packages: ${MISSING_PKGS[*]}"
      if sudo apt-get install -y -qq "${MISSING_PKGS[@]}" > /dev/null 2>&1; then
        ok "System packages installed: ${MISSING_PKGS[*]}"
      else
        warn "Failed to install some packages: ${MISSING_PKGS[*]}"
        say "Attempting individual package installation..."
        for pkg in "${MISSING_PKGS[@]}"; do
          if sudo apt-get install -y "$pkg" > /dev/null 2>&1; then
            say "Installed: $pkg"
          else
            warn "Failed to install: $pkg (may cause issues later)"
          fi
        done
      fi
    else
      ok "All required packages already installed"
    fi
    
    # Verify critical packages (build-essential is a meta-package, check via dpkg only)
    MISSING_CRITICAL=()
    
    # Check curl (has command)
    if ! command -v curl >/dev/null 2>&1 && ! dpkg -l | grep -q "^ii  curl "; then
      MISSING_CRITICAL+=("curl")
    fi
    
    # Check git (has command)
    if ! command -v git >/dev/null 2>&1 && ! dpkg -l | grep -q "^ii  git "; then
      MISSING_CRITICAL+=("git")
    fi
    
    # Check build-essential (meta-package, check via dpkg only)
    if ! dpkg -l | grep -q "^ii  build-essential "; then
      MISSING_CRITICAL+=("build-essential")
    fi
    
    if [ ${#MISSING_CRITICAL[@]} -gt 0 ]; then
      fail "Critical packages missing: ${MISSING_CRITICAL[*]}"
      fail "Please install manually: sudo apt-get update && sudo apt-get install -y ${MISSING_CRITICAL[*]}"
      exit 1
    fi
    
    ok "OS prerequisites verified (${OS_ID} ${OS_VERSION})"
  else
    warn "OS not recognized: ${OS_ID}"
    warn "Please ensure: curl, git, build-essential (or equivalent) are installed"
  fi
else
  ok "Skipping OS dependency check (--skip-os-deps)"
fi

# Step 2: Check/Install Node.js
say "Step 2: Checking Node.js Installation"

if ! command -v node >/dev/null 2>&1; then
  warn "Node.js not found"
  say "Installing Node.js v24.13.0 via nvm..."
  
  # Install nvm if not exists (with better error handling for newer VMs)
  if [ ! -d "$HOME/.nvm" ]; then
    NVM_VERSION="${NVM_VERSION:-v0.39.7}"
    if curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash >/dev/null 2>&1; then
      ok "nvm ${NVM_VERSION} installed"
    else
      fail "Failed to install nvm. Check internet connection."
      exit 1
    fi
  fi
  
  # Load nvm with better error handling for newer systems
  export NVM_DIR="$HOME/.nvm"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    ok "nvm loaded"
  else
    fail "nvm installation appears incomplete. $NVM_DIR/nvm.sh not found."
    exit 1
  fi
  
  # Install Node.js v24.13.0
  nvm install 24.13.0 >/dev/null 2>&1
  nvm use 24.13.0 >/dev/null 2>&1
  nvm alias default 24.13.0 >/dev/null 2>&1
  ok "Node.js v24.13.0 installed"
else
  ensure_node_version "24.13.0"
fi

# Step 3: Create app user and directory
say "Step 3: Creating App User and Directory"

# Create user if not exists
if ! id "$APP_USER" &>/dev/null; then
  say "Creating user: $APP_USER"
  sudo useradd -r -s /bin/bash -d "$APP_DIR" "$APP_USER" 2>/dev/null || \
  sudo useradd -s /bin/bash -d "$APP_DIR" "$APP_USER"
  ok "User created: $APP_USER"
else
  ok "User already exists: $APP_USER"
fi

# Create app directory
if [ ! -d "$APP_DIR" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown "$APP_USER:$APP_USER" "$APP_DIR"
  ok "Directory created: $APP_DIR"
else
  warn "Directory already exists: $APP_DIR"
  if [ -d "$APP_DIR/.git" ]; then
    warn "Git repository already exists, skipping clone"
    SKIP_CLONE=true
  else
    SKIP_CLONE=false
    sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  fi
fi

# Step 4: Clone repository
say "Step 4: Cloning Repository"

if [ "${SKIP_CLONE:-false}" = true ]; then
  ok "Repository already exists, skipping clone"
else
  # Clone as app user
  if [ -d "$APP_DIR/.git" ]; then
    ok "Git repository already exists"
  else
    say "Cloning repository..."
    sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR" -q
    ok "Repository cloned"
  fi
fi

cd "$APP_DIR"

# Checkout target ref
say "Checking out: $GIT_REF"
sudo -u "$APP_USER" git fetch origin --tags -q
if sudo -u "$APP_USER" git checkout "$GIT_REF" -q; then
  ok "Checked out $GIT_REF"
else
  fail "Failed to checkout $GIT_REF"
  exit 1
fi

# Step 5: Install dependencies
say "Step 5: Installing Dependencies"

# Switch to app user context
sudo -u "$APP_USER" bash << INSTALL_SCRIPT
set -euo pipefail
cd "$APP_DIR"

# Load nvm if available
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"
nvm use 24.13.0 >/dev/null 2>&1 || true

# Auto-update npm to 9+ for newer VMs (matching local install-ubuntu.sh)
if command -v npm >/dev/null 2>&1; then
  NPM_MAJOR=\$(npm -v 2>/dev/null | cut -d'.' -f1 || echo "0")
  if [ -n "\$NPM_MAJOR" ] && [ "\$NPM_MAJOR" -lt 9 ] 2>/dev/null; then
    echo "Updating npm to latest for better compatibility with newer VMs..."
    npm install -g npm@latest > /dev/null 2>&1 || true
    echo "Updated to npm v\$(npm -v)"
  fi
fi

PM=\$(cd "$APP_DIR" && bash -c 'source "$SCRIPT_DIR/common.sh" && detect_package_manager')
INSTALL_CMD=\$(cd "$APP_DIR" && bash -c "source '$SCRIPT_DIR/common.sh' && get_install_cmd \$PM")

echo "Package manager: \$PM"
echo "Running: \$INSTALL_CMD"

# Use npm ci with fallback (matching local install-ubuntu.sh)
if [ -f "package-lock.json" ]; then
  if npm ci > /tmp/clean-install.log 2>&1; then
    echo "Dependencies installed via npm ci"
  else
    echo "npm ci failed, attempting npm update and retry..."
    npm install -g npm@latest > /dev/null 2>&1 || true
    if npm ci > /tmp/clean-install.log 2>&1; then
      echo "Dependencies installed via npm ci (after npm update)"
    else
      echo "npm ci failed, falling back to npm install..."
      npm install > /tmp/clean-install.log 2>&1
    fi
  fi
else
  eval "\$INSTALL_CMD" > /tmp/clean-install.log 2>&1
fi
INSTALL_SCRIPT

if [ $? -eq 0 ]; then
  ok "Dependencies installed"
else
  fail "Dependency installation failed"
  cat /tmp/clean-install.log | tail -30 | redact
  exit 1
fi

# Step 6: Run release gate
say "Step 6: Running Release Gate"

sudo -u "$APP_USER" bash << RELEASE_GATE_SCRIPT
set -euo pipefail
cd "$APP_DIR"

# Load nvm if available
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"
nvm use 24.13.0 >/dev/null 2>&1 || true

bash scripts/release-gate.sh > /tmp/clean-release-gate.log 2>&1
RELEASE_GATE_SCRIPT

if [ $? -eq 0 ]; then
  ok "Release gate passed"
else
  fail "Release gate failed"
  cat /tmp/clean-release-gate.log | tail -50 | redact
  exit 1
fi

# Step 7: Build production
say "Step 7: Building Production Bundle"

sudo -u "$APP_USER" bash << BUILD_SCRIPT
set -euo pipefail
cd "$APP_DIR"

# Load nvm if available
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"
nvm use 24.13.0 >/dev/null 2>&1 || true

PM=\$(cd "$APP_DIR" && bash -c 'source "$SCRIPT_DIR/common.sh" && detect_package_manager')
RUN_CMD=\$(cd "$APP_DIR" && bash -c "source '$SCRIPT_DIR/common.sh' && get_run_cmd \$PM")

\$RUN_CMD run build > /tmp/clean-build.log 2>&1
BUILD_SCRIPT

if [ $? -eq 0 ]; then
  ok "Build completed"
else
  fail "Build failed"
  cat /tmp/clean-build.log | tail -50 | redact
  exit 1
fi

# Verify build output
if [ ! -d "$APP_DIR/.next" ]; then
  fail "Build output (.next) not found"
  exit 1
fi

ok "Build output verified"

# Step 7a: Ensure required directories exist with correct permissions
say "Step 7a: Ensuring Required Directories Exist"

# Create .secure-storage if missing
if [ ! -d "$APP_DIR/.secure-storage" ]; then
  say "Creating .secure-storage directory..."
  sudo -u "$APP_USER" mkdir -p "$APP_DIR/.secure-storage"
  sudo chmod 700 "$APP_DIR/.secure-storage"
  sudo chown "$APP_USER:$APP_USER" "$APP_DIR/.secure-storage"
  ok ".secure-storage created with permissions 700"
else
  # Ensure permissions are correct
  sudo chmod 700 "$APP_DIR/.secure-storage"
  sudo chown "$APP_USER:$APP_USER" "$APP_DIR/.secure-storage"
  ok ".secure-storage exists with correct permissions"
fi

# Create .storage if missing
if [ ! -d "$APP_DIR/.storage" ]; then
  say "Creating .storage directory..."
  sudo -u "$APP_USER" mkdir -p "$APP_DIR/.storage"
  sudo chmod 755 "$APP_DIR/.storage"
  sudo chown "$APP_USER:$APP_USER" "$APP_DIR/.storage"
  ok ".storage created with permissions 755"
else
  sudo chmod 755 "$APP_DIR/.storage"
  sudo chown "$APP_USER:$APP_USER" "$APP_DIR/.storage"
  ok ".storage exists"
fi

# Print diagnostics (non-secret)
say "Diagnostics"
info "Node version: $(sudo -u "$APP_USER" bash -c 'source "$HOME/.nvm/nvm.sh" 2>/dev/null; nvm use 24.13.0 >/dev/null 2>&1; node -v' || echo 'unknown')"
info "Package manager: $(detect_package_manager)"
info "Git revision: $(cd "$APP_DIR" && sudo -u "$APP_USER" git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
info "Disk free: $(df -h "$APP_DIR" | tail -1 | awk '{print $4}' || echo 'unknown')"
info "App user: $APP_USER"
info "App directory: $APP_DIR"
info "Required dirs perms: .secure-storage (700), .storage (755)"

# Step 8: Create systemd service (template)
say "Step 8: Creating Systemd Service Template"

SERVICE_FILE="/etc/systemd/system/secure-ai-chat.service"
SERVICE_TEMPLATE="$SCRIPT_DIR/secure-ai-chat.service"

if [ -f "$SERVICE_TEMPLATE" ]; then
  say "Using service template: $SERVICE_TEMPLATE"
  
  # Replace placeholders
  sed "s|{{APP_DIR}}|$APP_DIR|g" "$SERVICE_TEMPLATE" | \
  sed "s|{{APP_USER}}|$APP_USER|g" | \
  sed "s|{{NODE_VERSION}}|24.13.0|g" > /tmp/secure-ai-chat.service
  
  sudo cp /tmp/secure-ai-chat.service "$SERVICE_FILE"
  sudo systemctl daemon-reload
  ok "Systemd service file created"
  
  say "To enable and start the service:"
  echo "  sudo systemctl enable secure-ai-chat"
  echo "  sudo systemctl start secure-ai-chat"
else
  warn "Service template not found: $SERVICE_TEMPLATE"
  warn "Please create systemd service manually (see docs/DEPLOYMENT.md)"
fi

# Step 9: Create environment file template
say "Step 9: Environment Configuration"

ENV_FILE="/etc/secure-ai-chat.env"
if [ ! -f "$ENV_FILE" ]; then
  say "Creating environment file template: $ENV_FILE"
  sudo tee "$ENV_FILE" > /dev/null << 'ENV_TEMPLATE'
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
  sudo chmod 600 "$ENV_FILE"
  sudo chown "$APP_USER:$APP_USER" "$ENV_FILE"
  ok "Environment file template created"
  warn "Edit $ENV_FILE and add your API keys (or configure via Settings UI)"
else
  ok "Environment file already exists: $ENV_FILE"
fi

# Step 10: Start service and run smoke tests
say "Step 10: Starting Service and Running Smoke Tests"

if [ -f "$SERVICE_FILE" ]; then
  sudo systemctl enable secure-ai-chat >/dev/null 2>&1
  if sudo systemctl start secure-ai-chat; then
    ok "Service started"
    sleep 5
    
    if sudo systemctl is-active --quiet secure-ai-chat; then
      ok "Service is running"
      
      # Run smoke tests
      if run_smoke_test "http://localhost:3000"; then
        ok "Smoke tests passed"
      else
        warn "Smoke tests failed (service may need configuration)"
      fi
    else
      warn "Service may not be running, check: sudo systemctl status secure-ai-chat"
    fi
  else
    warn "Failed to start service automatically"
    say "Start manually: sudo systemctl start secure-ai-chat"
  fi
else
  warn "Systemd service not configured"
  say "Start application manually:"
  echo "  cd $APP_DIR"
  echo "  sudo -u $APP_USER npm start"
fi

# Success
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  ✅ CLEAN INSTALL: SUCCESS                     ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Application installed successfully.                        ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Installation completed!"
say "App directory: $APP_DIR"
say "App user: $APP_USER"
say "Service: secure-ai-chat"
echo ""
say "Next steps:"
echo "  1. Configure API keys via Settings UI or edit $ENV_FILE"
echo "  2. Check service status: sudo systemctl status secure-ai-chat"
echo "  3. View logs: sudo journalctl -u secure-ai-chat -f"
echo "  4. Access app: http://localhost:3000"
echo ""
exit 0
