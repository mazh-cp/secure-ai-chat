#!/usr/bin/env bash
# Upgrade existing installation in-place
# Safe, idempotent, rollback-friendly

set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

# Parse arguments
APP_DIR=""
GIT_REF="main"
BACKUP_DIR=""
ROLLBACK_ON_FAILURE=true

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
    --backup-dir)
      BACKUP_DIR="$2"
      shift 2
      ;;
    --no-rollback)
      ROLLBACK_ON_FAILURE=false
      shift
      ;;
    *)
      echo "Usage: $0 --app-dir /opt/secure-ai-chat --ref main [--backup-dir /backup] [--no-rollback]"
      exit 1
      ;;
  esac
done

if [ -z "$APP_DIR" ]; then
  fail "--app-dir is required"
  exit 1
fi

if [ ! -d "$APP_DIR" ]; then
  fail "App directory does not exist: $APP_DIR"
  exit 1
fi

# Main execution
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Upgrade Existing Installation (In-Place)            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "App directory: $APP_DIR"
say "Git reference: $GIT_REF"
echo ""

cd "$APP_DIR"

# Step 1: Validate git is clean or stash warning
say "Step 1: Validating Git Repository"

if [ ! -d ".git" ]; then
  warn "Not a git repository: $APP_DIR"
  warn "Initializing git repository for future upgrades..."
  
  # Get app user (to handle ownership issues)
  APP_USER=$(get_app_user)
  say "App user: $APP_USER"
  
  # Fix git safe.directory issue (if running as different user)
  if [ "$(whoami)" != "$APP_USER" ]; then
    say "Configuring git safe.directory for $APP_DIR..."
    git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
    ok "Git safe.directory configured"
  fi
  
  # Initialize git repository as app user if different
  if [ "$(whoami)" != "$APP_USER" ]; then
    say "Initializing git repository as $APP_USER..."
    if sudo -u "$APP_USER" git -C "$APP_DIR" init -q; then
      ok "Git repository initialized"
    else
      fail "Failed to initialize git repository"
      exit 1
    fi
  else
    if git init -q; then
      ok "Git repository initialized"
    else
      fail "Failed to initialize git repository"
      exit 1
    fi
  fi
  
  # Add remote if not exists (as app user)
  if [ "$(whoami)" != "$APP_USER" ]; then
    if ! sudo -u "$APP_USER" git -C "$APP_DIR" remote | grep -q "^origin$"; then
      sudo -u "$APP_USER" git -C "$APP_DIR" remote add origin https://github.com/mazh-cp/secure-ai-chat.git
      ok "Git remote 'origin' added"
    fi
  else
    if ! git remote | grep -q "^origin$"; then
      git remote add origin https://github.com/mazh-cp/secure-ai-chat.git
      ok "Git remote 'origin' added"
    fi
  fi
  
  # Fetch latest code (as app user)
  say "Fetching latest code from origin..."
  if [ "$(whoami)" != "$APP_USER" ]; then
    if sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin main -q; then
      ok "Fetched latest code"
    else
      warn "Failed to fetch from origin (may need network access)"
    fi
  else
    if git fetch origin main -q; then
      ok "Fetched latest code"
    else
      warn "Failed to fetch from origin (may need network access)"
    fi
  fi
  
  # Checkout main branch (as app user)
  if [ "$(whoami)" != "$APP_USER" ]; then
    if sudo -u "$APP_USER" git -C "$APP_DIR" checkout -b main origin/main 2>/dev/null || \
       sudo -u "$APP_USER" git -C "$APP_DIR" checkout main 2>/dev/null || \
       sudo -u "$APP_USER" git -C "$APP_DIR" checkout -b main 2>/dev/null; then
      ok "Checked out main branch"
    else
      warn "Could not checkout main branch (will try to continue)"
    fi
  else
    if git checkout -b main origin/main 2>/dev/null || git checkout main 2>/dev/null || git checkout -b main 2>/dev/null; then
      ok "Checked out main branch"
    else
      warn "Could not checkout main branch (will try to continue)"
    fi
  fi
  
  # Stage current files (as app user)
  if [ "$(whoami)" != "$APP_USER" ]; then
    sudo -u "$APP_USER" git -C "$APP_DIR" add -A >/dev/null 2>&1 || true
  else
    git add -A >/dev/null 2>&1 || true
  fi
  
  # Commit current state (as app user)
  if [ "$(whoami)" != "$APP_USER" ]; then
    if ! sudo -u "$APP_USER" git -C "$APP_DIR" diff --quiet HEAD 2>/dev/null || \
       ! sudo -u "$APP_USER" git -C "$APP_DIR" diff --cached --quiet 2>/dev/null || \
       [ -z "$(sudo -u "$APP_USER" git -C "$APP_DIR" log --oneline -1 2>/dev/null)" ]; then
      sudo -u "$APP_USER" git -C "$APP_DIR" commit -m "Pre-upgrade state: $(date +%Y%m%d_%H%M%S)" >/dev/null 2>&1 || true
    fi
  else
    if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet 2>/dev/null || [ -z "$(git log --oneline -1 2>/dev/null)" ]; then
      git commit -m "Pre-upgrade state: $(date +%Y%m%d_%H%M%S)" >/dev/null 2>&1 || true
    fi
  fi
  
  warn "Git repository initialized. Future upgrades will use git pull."
fi

# Ensure safe.directory is configured (for all subsequent git commands)
APP_USER=$(get_app_user)
if [ "$(whoami)" != "$APP_USER" ]; then
  git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
fi

# Get app user for git operations
APP_USER=$(get_app_user)

# Check for uncommitted changes (as app user)
if [ "$(whoami)" != "$APP_USER" ]; then
  if ! sudo -u "$APP_USER" git -C "$APP_DIR" diff --quiet HEAD 2>/dev/null || ! sudo -u "$APP_USER" git -C "$APP_DIR" diff --cached --quiet 2>/dev/null; then
    warn "Uncommitted changes detected"
    warn "Stashing changes for upgrade..."
    sudo -u "$APP_USER" git -C "$APP_DIR" stash push -m "Auto-stash before upgrade $(date +%Y%m%d_%H%M%S)" || true
  fi
  
  # Check for untracked files (warn but don't fail)
  if [ -n "$(sudo -u "$APP_USER" git -C "$APP_DIR" ls-files --others --exclude-standard 2>/dev/null)" ]; then
    warn "Untracked files detected (will be preserved)"
  fi
else
  if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    warn "Uncommitted changes detected"
    warn "Stashing changes for upgrade..."
    git stash push -m "Auto-stash before upgrade $(date +%Y%m%d_%H%M%S)" || true
  fi
  
  # Check for untracked files (warn but don't fail)
  if [ -n "$(git ls-files --others --exclude-standard)" ]; then
    warn "Untracked files detected (will be preserved)"
  fi
fi

ok "Git repository validated"

# Step 2: Fetch latest code
say "Step 2: Fetching Latest Code"

if [ "$(whoami)" != "$APP_USER" ]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin --tags -q || fail "Failed to fetch from origin"
  ok "Fetched latest code"
  
  # Get current commit (for rollback)
  CURRENT_REF=$(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse HEAD)
  say "Current commit: $(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --short HEAD)"
  
  # Checkout target ref
  say "Checking out: $GIT_REF"
  if sudo -u "$APP_USER" git -C "$APP_DIR" checkout "$GIT_REF" -q; then
    ok "Checked out $GIT_REF"
  else
    fail "Failed to checkout $GIT_REF"
    exit 1
  fi
  
  # Pull latest changes
  if sudo -u "$APP_USER" git -C "$APP_DIR" pull origin "$GIT_REF" -q; then
    ok "Pulled latest changes"
  else
    warn "Pull failed (may be on detached HEAD or tag)"
  fi
  
  NEW_REF=$(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse HEAD)
  say "New commit: $(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --short HEAD)"
else
  git fetch origin --tags -q || fail "Failed to fetch from origin"
  ok "Fetched latest code"
  
  # Get current commit (for rollback)
  CURRENT_REF=$(git rev-parse HEAD)
  say "Current commit: $(git rev-parse --short HEAD)"
  
  # Checkout target ref
  say "Checking out: $GIT_REF"
  if git checkout "$GIT_REF" -q; then
    ok "Checked out $GIT_REF"
  else
    fail "Failed to checkout $GIT_REF"
    exit 1
  fi
  
  # Pull latest changes
  if git pull origin "$GIT_REF" -q; then
    ok "Pulled latest changes"
  else
    warn "Pull failed (may be on detached HEAD or tag)"
  fi
  
  NEW_REF=$(git rev-parse HEAD)
  say "New commit: $(git rev-parse --short HEAD)"
fi

# Step 3: Backup current build + config
say "Step 3: Creating Backup"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
if [ -z "$BACKUP_DIR" ]; then
  BACKUP_DIR="${APP_DIR}/.backups"
fi

mkdir -p "$BACKUP_DIR"
BACKUP_PATH="${BACKUP_DIR}/upgrade-${TIMESTAMP}"

say "Backup directory: $BACKUP_PATH"

# Backup .next (build output)
if [ -d ".next" ]; then
  mkdir -p "${BACKUP_PATH}"
  cp -r .next "${BACKUP_PATH}/.next" 2>/dev/null || true
  ok "Backed up .next directory"
fi

# Backup .secure-storage (API keys)
if [ -d ".secure-storage" ]; then
  mkdir -p "${BACKUP_PATH}"
  cp -r .secure-storage "${BACKUP_PATH}/.secure-storage" 2>/dev/null || true
  ok "Backed up .secure-storage directory"
fi

# Backup .env.local if exists
if [ -f ".env.local" ]; then
  cp .env.local "${BACKUP_PATH}/.env.local" 2>/dev/null || true
  ok "Backed up .env.local"
fi

# Save git ref for rollback
echo "$CURRENT_REF" > "${BACKUP_PATH}/.git-ref"
ok "Backup created: $BACKUP_PATH"

# Step 4: Install dependencies
say "Step 4: Installing Dependencies"

PM=$(detect_package_manager)
INSTALL_CMD=$(get_install_cmd "$PM")
RUN_CMD=$(get_run_cmd "$PM")

say "Package manager: $PM"

# Auto-update npm to 9+ for newer VMs (matching local install-ubuntu.sh)
cd "$APP_DIR"
if [ "$PM" = "npm" ]; then
  # Load nvm if available
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" || true
  
  if command -v npm >/dev/null 2>&1; then
    NPM_MAJOR=$(npm -v 2>/dev/null | cut -d'.' -f1 || echo "0")
    if [ -n "$NPM_MAJOR" ] && [ "$NPM_MAJOR" -lt 9 ] 2>/dev/null; then
      say "Updating npm to latest for better compatibility with newer VMs..."
      npm install -g npm@latest > /dev/null 2>&1 || true
      say "Updated to npm v$(npm -v)"
    fi
  fi
fi

say "Running: $INSTALL_CMD"

# Use npm ci with fallback (matching local install-ubuntu.sh)
if [ "$PM" = "npm" ] && [ -f "package-lock.json" ]; then
  if npm ci > /tmp/upgrade-install.log 2>&1; then
    ok "Dependencies installed via npm ci"
  else
    warn "npm ci failed, attempting npm update and retry..."
    npm install -g npm@latest > /dev/null 2>&1 || true
    if npm ci > /tmp/upgrade-install.log 2>&1; then
      ok "Dependencies installed via npm ci (after npm update)"
    else
      warn "npm ci failed, falling back to npm install..."
      if npm install > /tmp/upgrade-install.log 2>&1; then
        ok "Dependencies installed via npm install"
      else
        fail "Dependency installation failed"
        cat /tmp/upgrade-install.log | tail -30 | redact
        if [ "$ROLLBACK_ON_FAILURE" = true ]; then
          say "Rolling back..."
          git checkout "$CURRENT_REF" -q
          if [ -d "${BACKUP_PATH}/.next" ]; then
            rm -rf .next
            cp -r "${BACKUP_PATH}/.next" .next
          fi
          restart_systemd_service
          fail "Upgrade failed, rolled back to previous version"
        fi
        exit 1
      fi
    fi
  fi
elif eval "$INSTALL_CMD" > /tmp/upgrade-install.log 2>&1; then
  ok "Dependencies installed"
else
  fail "Dependency installation failed"
  cat /tmp/upgrade-install.log | tail -30 | redact
  if [ "$ROLLBACK_ON_FAILURE" = true ]; then
    say "Rolling back..."
    git checkout "$CURRENT_REF" -q
    if [ -d "${BACKUP_PATH}/.next" ]; then
      rm -rf .next
      cp -r "${BACKUP_PATH}/.next" .next
    fi
    restart_systemd_service
    fail "Upgrade failed, rolled back to previous version"
  fi
  exit 1
fi

# Step 5: Run release gate
say "Step 5: Running Release Gate"

if bash scripts/release-gate.sh > /tmp/upgrade-release-gate.log 2>&1; then
  ok "Release gate passed"
else
  fail "Release gate failed"
  cat /tmp/upgrade-release-gate.log | tail -50 | redact
  if [ "$ROLLBACK_ON_FAILURE" = true ]; then
    say "Rolling back..."
    git checkout "$CURRENT_REF" -q
    if [ -d "${BACKUP_PATH}/.next" ]; then
      rm -rf .next
      cp -r "${BACKUP_PATH}/.next" .next
    fi
    restart_systemd_service
    fail "Upgrade failed, rolled back to previous version"
  fi
  exit 1
fi

# Step 6: Build production
say "Step 6: Building Production Bundle"

if $RUN_CMD run build > /tmp/upgrade-build.log 2>&1; then
  ok "Build completed"
else
  fail "Build failed"
  cat /tmp/upgrade-build.log | tail -50 | redact
  if [ "$ROLLBACK_ON_FAILURE" = true ]; then
    say "Rolling back..."
    git checkout "$CURRENT_REF" -q
    if [ -d "${BACKUP_PATH}/.next" ]; then
      rm -rf .next
      cp -r "${BACKUP_PATH}/.next" .next
    fi
    restart_systemd_service
    fail "Upgrade failed, rolled back to previous version"
  fi
  exit 1
fi

# Verify build output
if [ ! -d ".next" ]; then
  fail "Build output (.next) not found"
  if [ "$ROLLBACK_ON_FAILURE" = true ]; then
    say "Rolling back..."
    git checkout "$CURRENT_REF" -q
    if [ -d "${BACKUP_PATH}/.next" ]; then
      rm -rf .next
      cp -r "${BACKUP_PATH}/.next" .next
    fi
    restart_systemd_service
    fail "Upgrade failed, rolled back to previous version"
  fi
  exit 1
fi

ok "Build output verified"

# Step 6a: Ensure required directories exist with correct permissions
say "Step 6a: Ensuring Required Directories Exist"

APP_USER=$(get_app_user)

# Create .secure-storage if missing
if [ ! -d ".secure-storage" ]; then
  say "Creating .secure-storage directory..."
  mkdir -p .secure-storage
  chmod 700 .secure-storage
  if [ -n "$APP_USER" ] && [ "$APP_USER" != "$(whoami)" ]; then
    sudo chown "$APP_USER:$APP_USER" .secure-storage
  fi
  ok ".secure-storage created with permissions 700"
else
  # Ensure permissions are correct
  PERMS=$(stat -c%a .secure-storage 2>/dev/null || stat -f%OLp .secure-storage 2>/dev/null || echo "unknown")
  if [ "$PERMS" != "700" ]; then
    warn ".secure-storage permissions: $PERMS (fixing to 700)..."
    chmod 700 .secure-storage
    ok ".secure-storage permissions fixed"
  else
    ok ".secure-storage exists with correct permissions"
  fi
fi

# Create .storage if missing (with correct permissions for file persistence)
if [ ! -d ".storage" ]; then
  say "Creating .storage directory..."
  mkdir -p .storage
  chmod 755 .storage
  if [ -n "$APP_USER" ] && [ "$APP_USER" != "$(whoami)" ]; then
    sudo chown "$APP_USER:$APP_USER" .storage
  fi
  ok ".storage created with permissions 755"
else
  # HOTFIX: Ensure .storage has correct permissions (0o755) for file persistence
  PERMS=$(stat -c%a .storage 2>/dev/null || stat -f%OLp .storage 2>/dev/null || echo "unknown")
  if [ "$PERMS" != "755" ]; then
    warn ".storage permissions: $PERMS (fixing to 755 for file persistence)..."
    chmod 755 .storage
    if [ -n "$APP_USER" ] && [ "$APP_USER" != "$(whoami)" ]; then
      sudo chown "$APP_USER:$APP_USER" .storage
    fi
    ok ".storage permissions fixed to 755"
  else
    ok ".storage exists with correct permissions (755)"
  fi
fi

# Create .storage/files subdirectory with correct permissions
if [ ! -d ".storage/files" ]; then
  say "Creating .storage/files directory..."
  mkdir -p .storage/files
  chmod 755 .storage/files
  if [ -n "$APP_USER" ] && [ "$APP_USER" != "$(whoami)" ]; then
    sudo chown "$APP_USER:$APP_USER" .storage/files
  fi
  ok ".storage/files created with permissions 755"
else
  # Ensure .storage/files has correct permissions
  PERMS=$(stat -c%a .storage/files 2>/dev/null || stat -f%OLp .storage/files 2>/dev/null || echo "unknown")
  if [ "$PERMS" != "755" ]; then
    warn ".storage/files permissions: $PERMS (fixing to 755)..."
    chmod 755 .storage/files
    if [ -n "$APP_USER" ] && [ "$APP_USER" != "$(whoami)" ]; then
      sudo chown "$APP_USER:$APP_USER" .storage/files
    fi
    ok ".storage/files permissions fixed to 755"
  else
    ok ".storage/files exists with correct permissions (755)"
  fi
fi

# Print diagnostics (non-secret)
say "Diagnostics"
info "Node version: $(node -v 2>/dev/null || echo 'unknown')"
info "Package manager: $(detect_package_manager)"
info "Git revision: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
info "Disk free: $(df -h . | tail -1 | awk '{print $4}' || echo 'unknown')"
info "App user: $APP_USER"
info "Required dirs perms: .secure-storage (700), .storage (755)"

# Step 7: Restart service
say "Step 7: Restarting Service"

if ! restart_systemd_service; then
  if [ "$ROLLBACK_ON_FAILURE" = true ]; then
    say "Rolling back..."
    git checkout "$CURRENT_REF" -q
    if [ -d "${BACKUP_PATH}/.next" ]; then
      rm -rf .next
      cp -r "${BACKUP_PATH}/.next" .next
    fi
    restart_systemd_service
    fail "Service restart failed, rolled back to previous version"
  fi
  exit 1
fi

# Step 8: Run smoke tests
say "Step 8: Running Smoke Tests"

if run_smoke_test "http://localhost:3000"; then
  ok "Smoke tests passed"
else
  fail "Smoke tests failed"
  if [ "$ROLLBACK_ON_FAILURE" = true ]; then
    say "Rolling back..."
    git checkout "$CURRENT_REF" -q
    if [ -d "${BACKUP_PATH}/.next" ]; then
      rm -rf .next
      cp -r "${BACKUP_PATH}/.next" .next
    fi
    restart_systemd_service
    fail "Smoke tests failed, rolled back to previous version"
  fi
  exit 1
fi

# Success
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ UPGRADE: SUCCESS                         ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Application upgraded successfully.                          ║${NC}"
echo -e "${GREEN}║  Backup saved to: $BACKUP_PATH${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Upgrade completed successfully!"
say "Backup location: $BACKUP_PATH"
say "To rollback manually: git checkout $CURRENT_REF && cp -r $BACKUP_PATH/.next .next && sudo systemctl restart secure-ai-chat"
echo ""
exit 0
