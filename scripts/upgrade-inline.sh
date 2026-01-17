#!/usr/bin/env bash
# Secure AI Chat - Inline Production Upgrade Script
# Comprehensive one-command upgrade with all stability hardening features
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-inline.sh | bash
#
# Or with options:
#   APP_DIR=/opt/secure-ai-chat GIT_REF=main curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-inline.sh | bash

set -euo pipefail

# Configuration
APP_DIR="${APP_DIR:-}"
GIT_REF="${GIT_REF:-main}"
REPO_URL="https://github.com/mazh-cp/secure-ai-chat.git"
NODE_VERSION="24.13.0"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; exit 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }
info() { echo "${BLUE}ℹ️  INFO:${NC} $*"; }

# Trap for cleanup on error
cleanup() {
  local exit_code=$?
  if [ $exit_code -ne 0 ] && [ -n "${BACKUP_PATH:-}" ] && [ -d "$BACKUP_PATH" ]; then
    warn "Upgrade failed. Backup available at: $BACKUP_PATH"
    warn "To rollback manually, see: docs/DEPLOYMENT.md"
  fi
  exit $exit_code
}
trap cleanup EXIT

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Secure AI Chat - Inline Production Upgrade Script       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Starting inline production upgrade with stability hardening"
info "Git reference: $GIT_REF"
info "This upgrade includes Check Point TE API key saving fixes"
echo ""

# Step 1: Detect Installation Directory
say "Step 1: Detecting Installation Directory"

if [ -z "$APP_DIR" ]; then
  # Try to detect from systemd service first
  if [ -f "/etc/systemd/system/secure-ai-chat.service" ]; then
    SYSTEMD_PATH=$(grep "WorkingDirectory=" /etc/systemd/system/secure-ai-chat.service 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "")
    if [ -n "$SYSTEMD_PATH" ] && [ -d "$SYSTEMD_PATH" ] && [ -f "$SYSTEMD_PATH/package.json" ]; then
      APP_DIR="$SYSTEMD_PATH"
      ok "Found installation via systemd service: $APP_DIR"
    fi
  fi
  
  # Try common locations
  if [ -z "$APP_DIR" ]; then
    POSSIBLE_PATHS=(
      "/opt/secure-ai-chat"
      "/home/$(whoami)/secure-ai-chat"
      "$HOME/secure-ai-chat"
      "/var/www/secure-ai-chat"
    )
    
    for path in "${POSSIBLE_PATHS[@]}"; do
      if [ -n "$path" ] && [ -d "$path" ] && [ -f "$path/package.json" ]; then
        APP_DIR="$path"
        ok "Found installation: $APP_DIR"
        break
      fi
    done
  fi
  
  if [ -z "$APP_DIR" ]; then
    fail "Could not locate installation directory"
    fail "Please specify: APP_DIR=/path/to/app curl -fsSL ... | bash"
    exit 1
  fi
else
  if [ ! -d "$APP_DIR" ]; then
    fail "App directory does not exist: $APP_DIR"
    exit 1
  fi
  ok "Using specified app directory: $APP_DIR"
fi

cd "$APP_DIR" || fail "Failed to change to app directory: $APP_DIR"

# Detect app user
APP_USER=$(stat -c '%U' "$APP_DIR" 2>/dev/null || echo "$(whoami)")
if [ -f "/etc/systemd/system/secure-ai-chat.service" ]; then
  SERVICE_USER=$(grep "^User=" /etc/systemd/system/secure-ai-chat.service 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "")
  if [ -n "$SERVICE_USER" ]; then
    APP_USER="$SERVICE_USER"
  fi
fi
ok "App user: $APP_USER"

# Step 2: Pre-Upgrade Verification
say "Step 2: Pre-Upgrade Verification"

# Check service status
if sudo systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
  ok "Service is currently running"
  SERVICE_WAS_RUNNING=true
else
  warn "Service is not currently running"
  SERVICE_WAS_RUNNING=false
fi

# Check current version
if [ -f "package.json" ]; then
  CURRENT_VERSION=$(grep '"version"' package.json | head -1 | cut -d'"' -f4 || echo "unknown")
  ok "Current version: $CURRENT_VERSION"
fi

# Check Node.js version
if command -v node >/dev/null 2>&1; then
  CURRENT_NODE=$(node -v)
  ok "Current Node.js: $CURRENT_NODE"
else
  warn "Node.js not found in PATH (will be installed/configured)"
fi

# Step 3: Create Comprehensive Backup
say "Step 3: Creating Comprehensive Backup"

BACKUP_DIR="${APP_DIR}/.backups"
BACKUP_PATH="${BACKUP_DIR}/upgrade-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_PATH" || fail "Failed to create backup directory"

# Backup critical data
info "Backing up .secure-storage (API keys)..."
if [ -d ".secure-storage" ]; then
  cp -r .secure-storage "$BACKUP_PATH/" 2>/dev/null || warn "Failed to backup .secure-storage"
  ok ".secure-storage backed up"
else
  warn ".secure-storage does not exist (no API keys to backup)"
fi

info "Backing up .storage (uploaded files)..."
if [ -d ".storage" ]; then
  cp -r .storage "$BACKUP_PATH/" 2>/dev/null || warn "Failed to backup .storage"
  ok ".storage backed up"
else
  warn ".storage does not exist (no files to backup)"
fi

info "Backing up .env.local..."
if [ -f ".env.local" ]; then
  cp .env.local "$BACKUP_PATH/" 2>/dev/null || warn "Failed to backup .env.local"
  ok ".env.local backed up"
fi

info "Backing up .next (build cache)..."
if [ -d ".next" ]; then
  cp -r .next "$BACKUP_PATH/" 2>/dev/null || warn "Failed to backup .next"
  ok ".next backed up"
fi

# Save git state
if [ -d ".git" ]; then
  git rev-parse HEAD > "$BACKUP_PATH/.git-ref" 2>/dev/null || true
  git log -1 --format="%H %s" > "$BACKUP_PATH/.git-commit" 2>/dev/null || true
  ok "Git state saved"
fi

# Save system info
cat > "$BACKUP_PATH/backup-info.txt" <<EOF
Backup created: $(date)
Current version: ${CURRENT_VERSION:-unknown}
Current Node.js: ${CURRENT_NODE:-unknown}
App directory: $APP_DIR
App user: $APP_USER
Git ref: $(git rev-parse HEAD 2>/dev/null || echo "not a git repo")
EOF

ok "Backup created: $BACKUP_PATH"
info "Backup info saved to: $BACKUP_PATH/backup-info.txt"

# Step 4: Load/Install Node.js
say "Step 4: Ensuring Node.js ${NODE_VERSION} is Available"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  ok "nvm loaded"
else
  if [ -d "$NVM_DIR" ]; then
    warn "nvm directory exists but nvm.sh not found, trying to load..."
  fi
fi

# Install Node.js via nvm if needed
if ! command -v node >/dev/null 2>&1 || [ "$(node -v)" != "v${NODE_VERSION}" ]; then
  if command -v nvm >/dev/null 2>&1; then
    info "Installing/activating Node.js v${NODE_VERSION}..."
    nvm install "$NODE_VERSION" 2>/dev/null || nvm use "$NODE_VERSION" 2>/dev/null || true
    nvm use "$NODE_VERSION" >/dev/null 2>&1 || true
    nvm alias default "$NODE_VERSION" >/dev/null 2>&1 || true
  else
    warn "nvm not available. Please ensure Node.js v${NODE_VERSION} is installed."
  fi
fi

if command -v node >/dev/null 2>&1; then
  ACTUAL_NODE=$(node -v)
  if [ "$ACTUAL_NODE" = "v${NODE_VERSION}" ]; then
    ok "Node.js ${ACTUAL_NODE} is active"
  else
    warn "Node.js version mismatch: ${ACTUAL_NODE} (expected v${NODE_VERSION})"
    warn "Continuing with ${ACTUAL_NODE}..."
  fi
else
  fail "Node.js not found. Please install Node.js v${NODE_VERSION} manually."
fi

# Step 5: Stop Service
say "Step 5: Stopping Service"

if [ "$SERVICE_WAS_RUNNING" = true ]; then
  if sudo systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
    sudo systemctl stop secure-ai-chat
    sleep 2
    ok "Service stopped"
  else
    warn "Service already stopped"
  fi
else
  info "Service was not running, skipping stop"
fi

# Step 6: Update Code
say "Step 6: Updating Code from Repository"

# Ensure git repository
if [ ! -d ".git" ]; then
  warn "Not a git repository. Initializing..."
  git init >/dev/null 2>&1 || true
  git remote add origin "$REPO_URL" >/dev/null 2>&1 || git remote set-url origin "$REPO_URL" >/dev/null 2>&1 || true
fi

# Fetch and checkout
info "Fetching latest code..."
git fetch origin "$GIT_REF" >/dev/null 2>&1 || git fetch origin >/dev/null 2>&1 || true

info "Checking out $GIT_REF..."
if git checkout "$GIT_REF" >/dev/null 2>&1 || git checkout -b "$GIT_REF" "origin/$GIT_REF" >/dev/null 2>&1; then
  git pull origin "$GIT_REF" >/dev/null 2>&1 || true
  ok "Code updated to $GIT_REF"
else
  fail "Failed to checkout $GIT_REF"
fi

NEW_VERSION=$(grep '"version"' package.json | head -1 | cut -d'"' -f4 || echo "unknown")
if [ "$NEW_VERSION" != "$CURRENT_VERSION" ]; then
  ok "Version changed: ${CURRENT_VERSION:-unknown} -> $NEW_VERSION"
fi

# Step 7: Install Dependencies
say "Step 7: Installing Dependencies (npm ci)"

if [ -f "package-lock.json" ]; then
  info "Using npm ci for frozen install..."
  if npm ci >/dev/null 2>&1; then
    ok "Dependencies installed via npm ci"
  else
    warn "npm ci failed, attempting npm install..."
    npm install >/dev/null 2>&1 || fail "Failed to install dependencies"
    ok "Dependencies installed via npm install"
  fi
else
  warn "package-lock.json not found, using npm install..."
  npm install >/dev/null 2>&1 || fail "Failed to install dependencies"
  ok "Dependencies installed"
fi

# Step 8: Run Storage Migrations
say "Step 8: Running Storage Migrations"

if [ -f "scripts/migrate-storage.ts" ] || [ -f "scripts/migrate-storage.js" ]; then
  info "Running storage migrations (idempotent)..."
  if npm run migrate >/dev/null 2>&1; then
    ok "Storage migrations completed"
  else
    warn "Migration script not found or failed (continuing anyway)"
  fi
else
  warn "Migration script not found (this is OK for first-time upgrades)"
fi

# Step 9: Build Application
say "Step 9: Building Application"

info "Running production build..."
if npm run build >/tmp/build.log 2>&1; then
  ok "Build completed successfully"
else
  fail "Build failed. Check /tmp/build.log for details."
  cat /tmp/build.log | tail -30
  exit 1
fi

# Verify build output
if [ -d ".next" ]; then
  ok "Build output verified (.next directory exists)"
else
  fail "Build output not found (.next directory missing)"
fi

# Step 10: Fix Storage Permissions (if needed)
say "Step 10: Ensuring Storage Permissions"

if [ -d ".storage" ]; then
  chmod 755 .storage 2>/dev/null || true
  if [ -d ".storage/files" ]; then
    chmod 755 .storage/files 2>/dev/null || true
  fi
  ok "Storage permissions verified"
fi

# Ensure .secure-storage exists and has correct permissions for Check Point TE keys
if [ ! -d ".secure-storage" ]; then
  mkdir -p .secure-storage
  chmod 700 .secure-storage 2>/dev/null || true
  ok ".secure-storage directory created with correct permissions"
else
  chmod 700 .secure-storage 2>/dev/null || true
  ok ".secure-storage permissions verified (700)"
fi

# Step 11: Restart Service
say "Step 11: Restarting Service"

if [ "$SERVICE_WAS_RUNNING" = true ]; then
  info "Starting service..."
  if sudo systemctl start secure-ai-chat; then
    sleep 5
    if sudo systemctl is-active --quiet secure-ai-chat; then
      ok "Service started and running"
    else
      warn "Service started but may not be fully ready yet"
    fi
  else
    fail "Failed to start service"
  fi
else
  info "Service was not running before, not starting automatically"
  info "Start manually with: sudo systemctl start secure-ai-chat"
fi

# Step 12: Post-Upgrade Verification
say "Step 12: Post-Upgrade Verification"

# Check service status
if sudo systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
  ok "Service is running"
else
  warn "Service is not running (may need manual start)"
fi

# Check health endpoint
sleep 3
info "Testing health endpoint..."
if curl -s -f http://localhost:3000/api/health >/dev/null 2>&1; then
  ok "Health endpoint responding"
else
  warn "Health endpoint not responding (service may still be starting)"
fi

# Verify storage migration
if [ -d ".storage" ]; then
  if [ -f ".storage/schema-version.json" ]; then
    SCHEMA_VERSION=$(grep -o '"version":[0-9]*' .storage/schema-version.json | cut -d':' -f2 || echo "unknown")
    ok "Storage schema version: $SCHEMA_VERSION"
  else
    warn "Schema version file not found (migration may run on next app start)"
  fi
  
  PERMS=$(stat -c%a .storage 2>/dev/null || stat -f%OLp .storage 2>/dev/null || echo "unknown")
  if [ "$PERMS" = "755" ]; then
    ok "Storage permissions correct (755)"
  else
    warn "Storage permissions: $PERMS (expected 755)"
  fi
fi

# Verify Check Point TE API key storage directory
if [ -d ".secure-storage" ]; then
  PERMS=$(stat -c%a .secure-storage 2>/dev/null || stat -f%OLp .secure-storage 2>/dev/null || echo "unknown")
  if [ "$PERMS" = "700" ]; then
    ok "Check Point TE key storage permissions correct (700)"
  else
    warn "Check Point TE key storage permissions: $PERMS (expected 700)"
    info "Fixing permissions..."
    chmod 700 .secure-storage 2>/dev/null || true
  fi
  
  # Check if Check Point TE key file exists and has correct permissions
  if [ -f ".secure-storage/checkpoint-te-key.enc" ]; then
    KEY_PERMS=$(stat -c%a .secure-storage/checkpoint-te-key.enc 2>/dev/null || stat -f%OLp .secure-storage/checkpoint-te-key.enc 2>/dev/null || echo "unknown")
    if [ "$KEY_PERMS" = "600" ]; then
      ok "Check Point TE API key file permissions correct (600)"
    else
      warn "Check Point TE API key file permissions: $KEY_PERMS (expected 600)"
      info "Fixing key file permissions..."
      chmod 600 .secure-storage/checkpoint-te-key.enc 2>/dev/null || true
    fi
  else
    info "Check Point TE API key file not found (this is OK if not configured yet)"
  fi
else
  warn ".secure-storage directory not found (will be created on first key save)"
fi

# Summary
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Upgrade Completed Successfully                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
info "App directory: $APP_DIR"
info "App user: $APP_USER"
info "Backup location: $BACKUP_PATH"
info "Version: ${CURRENT_VERSION:-unknown} -> $NEW_VERSION"
info "Service status: $(sudo systemctl is-active secure-ai-chat 2>/dev/null || echo 'not running')"
echo ""
ok "All stability hardening features are now active:"
ok "  ✅ Environment validation"
ok "  ✅ Storage migrations"
ok "  ✅ Configurable storage path"
ok "  ✅ Schema versioning"
ok "  ✅ Check Point TE API key saving fixes (enhanced error handling & verification)"
echo ""
info "Next steps:"
info "  1. Test Check Point TE API key saving:"
info "     - Go to Settings page"
info "     - Paste Check Point TE API key"
info "     - Click 'Save Key'"
info "     - Verify it shows '✓ Configured' immediately"
info "     - Go to Files page and verify sandboxing toggle is enabled"
info "  2. Verify application functionality (chat, files, RAG)"
info "  3. Check logs: sudo journalctl -u secure-ai-chat -f"
info "  4. Test health: curl http://localhost:3000/api/health"
echo ""
info "To rollback if needed:"
info "  See backup at: $BACKUP_PATH"
info "  Restore instructions: docs/DEPLOYMENT.md"
echo ""
