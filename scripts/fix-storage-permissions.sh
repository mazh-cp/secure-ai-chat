#!/usr/bin/env bash
# Fix Disk Storage Issues - Standalone Script
# Fixes file storage persistence issues by correcting directory and file permissions
# Can be run independently or as part of upgrade process
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fix-storage-permissions.sh | bash
#   Or download and run:
#   bash scripts/fix-storage-permissions.sh [--app-dir /path/to/app]

set -euo pipefail

# Configuration
APP_DIR="${APP_DIR:-${1:-$(pwd)}}"
if [ "$APP_DIR" = "--app-dir" ] && [ -n "${2:-}" ]; then
  APP_DIR="$2"
fi

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

# Main execution
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Fix Disk Storage Permissions - Standalone           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Fixing storage permissions for file persistence"
say "App directory: $APP_DIR"
echo ""

# Step 1: Validate app directory
say "Step 1: Validating App Directory"

if [ ! -d "$APP_DIR" ]; then
  fail "App directory does not exist: $APP_DIR"
fi

if [ ! -f "$APP_DIR/package.json" ]; then
  warn "package.json not found in $APP_DIR"
  warn "This may not be the correct application directory"
  read -p "Continue anyway? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    fail "Aborted by user"
  fi
fi

cd "$APP_DIR" || fail "Failed to change to app directory: $APP_DIR"
ok "App directory validated"

# Step 2: Detect app user
say "Step 2: Detecting App User"

# Try to detect app user from systemd service
APP_USER=""
if [ -f "/etc/systemd/system/secure-ai-chat.service" ]; then
  APP_USER=$(grep "^User=" /etc/systemd/system/secure-ai-chat.service 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "")
fi

# Fallback to current user if not found
if [ -z "$APP_USER" ]; then
  APP_USER=$(whoami)
  warn "Could not detect app user from systemd service, using: $APP_USER"
else
  ok "App user detected: $APP_USER"
fi

# Step 3: Fix .storage directory permissions
say "Step 3: Fixing .storage Directory Permissions"

if [ ! -d ".storage" ]; then
  say "Creating .storage directory..."
  mkdir -p .storage
  chmod 755 .storage
  if [ "$(whoami)" != "$APP_USER" ] && [ -n "$APP_USER" ]; then
    sudo chown "$APP_USER:$APP_USER" .storage
  fi
  ok ".storage created with permissions 755"
else
  PERMS=$(stat -c%a .storage 2>/dev/null || stat -f%OLp .storage 2>/dev/null || echo "unknown")
  if [ "$PERMS" != "755" ]; then
    warn ".storage permissions: $PERMS (fixing to 755 for file persistence)..."
    chmod 755 .storage
    if [ "$(whoami)" != "$APP_USER" ] && [ -n "$APP_USER" ]; then
      sudo chown "$APP_USER:$APP_USER" .storage
    fi
    ok ".storage permissions fixed to 755"
  else
    ok ".storage has correct permissions (755)"
  fi
fi

# Step 4: Fix .storage/files directory permissions
say "Step 4: Fixing .storage/files Directory Permissions"

if [ ! -d ".storage/files" ]; then
  say "Creating .storage/files directory..."
  mkdir -p .storage/files
  chmod 755 .storage/files
  if [ "$(whoami)" != "$APP_USER" ] && [ -n "$APP_USER" ]; then
    sudo chown "$APP_USER:$APP_USER" .storage/files
  fi
  ok ".storage/files created with permissions 755"
else
  PERMS=$(stat -c%a .storage/files 2>/dev/null || stat -f%OLp .storage/files 2>/dev/null || echo "unknown")
  if [ "$PERMS" != "755" ]; then
    warn ".storage/files permissions: $PERMS (fixing to 755)..."
    chmod 755 .storage/files
    if [ "$(whoami)" != "$APP_USER" ] && [ -n "$APP_USER" ]; then
      sudo chown "$APP_USER:$APP_USER" .storage/files
    fi
    ok ".storage/files permissions fixed to 755"
  else
    ok ".storage/files has correct permissions (755)"
  fi
fi

# Step 5: Fix existing file permissions
say "Step 5: Fixing Existing File Permissions"

if [ -d ".storage/files" ]; then
  FILE_COUNT=0
  FIXED_COUNT=0
  
  # Fix .dat files (stored file content)
  if [ -n "$(find .storage/files -name "*.dat" -type f 2>/dev/null | head -1)" ]; then
    while IFS= read -r -d '' file; do
      FILE_COUNT=$((FILE_COUNT + 1))
      PERMS=$(stat -c%a "$file" 2>/dev/null || stat -f%OLp "$file" 2>/dev/null || echo "unknown")
      if [ "$PERMS" != "644" ]; then
        chmod 644 "$file"
        if [ "$(whoami)" != "$APP_USER" ] && [ -n "$APP_USER" ]; then
          sudo chown "$APP_USER:$APP_USER" "$file"
        fi
        FIXED_COUNT=$((FIXED_COUNT + 1))
      fi
    done < <(find .storage/files -name "*.dat" -type f -print0 2>/dev/null)
  fi
  
  # Fix metadata file
  if [ -f ".storage/files-metadata.json" ]; then
    FILE_COUNT=$((FILE_COUNT + 1))
    PERMS=$(stat -c%a .storage/files-metadata.json 2>/dev/null || stat -f%OLp .storage/files-metadata.json 2>/dev/null || echo "unknown")
    if [ "$PERMS" != "644" ]; then
      chmod 644 .storage/files-metadata.json
      if [ "$(whoami)" != "$APP_USER" ] && [ -n "$APP_USER" ]; then
        sudo chown "$APP_USER:$APP_USER" .storage/files-metadata.json
      fi
      FIXED_COUNT=$((FIXED_COUNT + 1))
    fi
  fi
  
  if [ $FILE_COUNT -eq 0 ]; then
    info "No files found (will be created with correct permissions on next upload)"
  else
    ok "Fixed permissions for $FIXED_COUNT of $FILE_COUNT files"
  fi
else
  warn ".storage/files directory does not exist (will be created on first upload)"
fi

# Step 6: Verify fixes
say "Step 6: Verifying Fixes"

VERIFICATION_PASSED=true

# Verify .storage permissions
if [ -d ".storage" ]; then
  PERMS=$(stat -c%a .storage 2>/dev/null || stat -f%OLp .storage 2>/dev/null || echo "unknown")
  if [ "$PERMS" = "755" ]; then
    ok ".storage permissions verified (755)"
  else
    fail ".storage permissions incorrect: $PERMS (expected 755)"
    VERIFICATION_PASSED=false
  fi
else
  fail ".storage directory does not exist"
  VERIFICATION_PASSED=false
fi

# Verify .storage/files permissions
if [ -d ".storage/files" ]; then
  PERMS=$(stat -c%a .storage/files 2>/dev/null || stat -f%OLp .storage/files 2>/dev/null || echo "unknown")
  if [ "$PERMS" = "755" ]; then
    ok ".storage/files permissions verified (755)"
  else
    fail ".storage/files permissions incorrect: $PERMS (expected 755)"
    VERIFICATION_PASSED=false
  fi
else
  warn ".storage/files directory does not exist (will be created on first upload)"
fi

# Verify ownership
if [ -n "$APP_USER" ] && [ "$(whoami)" != "$APP_USER" ]; then
  OWNER=$(stat -c%U .storage 2>/dev/null || stat -f%Su .storage 2>/dev/null || echo "unknown")
  if [ "$OWNER" = "$APP_USER" ]; then
    ok ".storage ownership verified ($APP_USER)"
  else
    warn ".storage ownership: $OWNER (expected $APP_USER)"
  fi
fi

# Step 7: Summary
echo ""
if [ "$VERIFICATION_PASSED" = true ]; then
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║              Storage Permissions Fixed Successfully          ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  ok "All storage permissions have been fixed"
  info "Directories: 0o755 (persistent after restarts)"
  info "Files: 0o644 (accessible after restarts)"
  echo ""
  info "Files will now persist across application restarts"
  info "Service restarts will not cause file loss"
  echo ""
else
  echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║              Storage Permissions Fix Failed                   ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  fail "Some verification checks failed. Please review the output above."
  exit 1
fi

# Step 8: Optional service restart
if systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
  echo ""
  read -p "Restart service to apply changes? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    say "Restarting service..."
    sudo systemctl restart secure-ai-chat
    sleep 2
    if systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
      ok "Service restarted successfully"
    else
      warn "Service restart may have failed. Check status: sudo systemctl status secure-ai-chat"
    fi
  fi
fi

echo ""
ok "Storage permissions fix completed"
