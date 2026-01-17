#!/usr/bin/env bash
# Diagnostic script for Check Point TE API key saving issues
# Run this on the production server to diagnose permission/directory issues

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

say() { echo -e "${BLUE}==>${NC} $*"; }
ok() { echo -e "${GREEN}✅${NC} $*"; }
warn() { echo -e "${YELLOW}⚠️${NC} $*"; }
fail() { echo -e "${RED}❌${NC} $*"; }

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Check Point TE API Key Save Diagnostic Script           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Detect app directory
APP_DIR="${APP_DIR:-}"
if [ -z "$APP_DIR" ]; then
  if [ -f "/etc/systemd/system/secure-ai-chat.service" ]; then
    APP_DIR=$(grep "WorkingDirectory=" /etc/systemd/system/secure-ai-chat.service 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "")
  fi
fi

if [ -z "$APP_DIR" ] || [ ! -d "$APP_DIR" ]; then
  POSSIBLE_PATHS=(
    "/opt/secure-ai-chat"
    "/home/$(whoami)/secure-ai-chat"
    "$HOME/secure-ai-chat"
    "/var/www/secure-ai-chat"
  )
  
  for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$path" ] && [ -f "$path/package.json" ]; then
      APP_DIR="$path"
      break
    fi
  done
fi

if [ -z "$APP_DIR" ] || [ ! -d "$APP_DIR" ]; then
  fail "Could not locate application directory"
  fail "Please specify: APP_DIR=/path/to/app bash scripts/diagnose-checkpoint-te-key.sh"
  exit 1
fi

ok "Found application directory: $APP_DIR"

# Detect app user
APP_USER=$(stat -c '%U' "$APP_DIR" 2>/dev/null || echo "$(whoami)")
if [ -f "/etc/systemd/system/secure-ai-chat.service" ]; then
  SERVICE_USER=$(grep "^User=" /etc/systemd/system/secure-ai-chat.service 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "")
  if [ -n "$SERVICE_USER" ]; then
    APP_USER="$SERVICE_USER"
  fi
fi

say "App user: $APP_USER"
say "Current user: $(whoami)"
echo ""

cd "$APP_DIR" || fail "Failed to change to app directory"

# Check .secure-storage directory
say "Checking .secure-storage directory..."

SECURE_STORAGE_DIR="$APP_DIR/.secure-storage"

if [ ! -d "$SECURE_STORAGE_DIR" ]; then
  warn ".secure-storage directory does not exist"
  say "Creating .secure-storage directory..."
  if sudo mkdir -p "$SECURE_STORAGE_DIR" 2>/dev/null || mkdir -p "$SECURE_STORAGE_DIR" 2>/dev/null; then
    ok ".secure-storage directory created"
  else
    fail "Failed to create .secure-storage directory"
    exit 1
  fi
else
  ok ".secure-storage directory exists"
fi

# Check permissions
say "Checking .secure-storage permissions..."

PERMS=$(stat -c%a "$SECURE_STORAGE_DIR" 2>/dev/null || stat -f%OLp "$SECURE_STORAGE_DIR" 2>/dev/null || echo "unknown")
OWNER=$(stat -c%U "$SECURE_STORAGE_DIR" 2>/dev/null || stat -f%Su "$SECURE_STORAGE_DIR" 2>/dev/null || echo "unknown")
GROUP=$(stat -c%G "$SECURE_STORAGE_DIR" 2>/dev/null || stat -f%Sg "$SECURE_STORAGE_DIR" 2>/dev/null || echo "unknown")

echo "  Permissions: $PERMS (expected: 700)"
echo "  Owner: $OWNER (expected: $APP_USER)"
echo "  Group: $GROUP"

if [ "$PERMS" != "700" ]; then
  warn "Incorrect permissions (expected 700)"
  say "Fixing permissions..."
  if sudo chmod 700 "$SECURE_STORAGE_DIR" 2>/dev/null || chmod 700 "$SECURE_STORAGE_DIR" 2>/dev/null; then
    ok "Permissions fixed to 700"
  else
    fail "Failed to fix permissions"
  fi
else
  ok "Permissions correct (700)"
fi

if [ "$OWNER" != "$APP_USER" ]; then
  warn "Incorrect owner (expected: $APP_USER)"
  say "Fixing ownership..."
  if sudo chown -R "$APP_USER:$APP_USER" "$SECURE_STORAGE_DIR" 2>/dev/null; then
    ok "Ownership fixed to $APP_USER:$APP_USER"
  else
    fail "Failed to fix ownership"
  fi
else
  ok "Ownership correct ($APP_USER)"
fi

echo ""

# Check Check Point TE key file
say "Checking Check Point TE API key file..."

KEY_FILE="$SECURE_STORAGE_DIR/checkpoint-te-key.enc"

if [ -f "$KEY_FILE" ]; then
  ok "Check Point TE key file exists"
  
  FILE_PERMS=$(stat -c%a "$KEY_FILE" 2>/dev/null || stat -f%OLp "$KEY_FILE" 2>/dev/null || echo "unknown")
  FILE_OWNER=$(stat -c%U "$KEY_FILE" 2>/dev/null || stat -f%Su "$KEY_FILE" 2>/dev/null || echo "unknown")
  FILE_SIZE=$(stat -c%s "$KEY_FILE" 2>/dev/null || stat -f%z "$KEY_FILE" 2>/dev/null || echo "0")
  
  echo "  File permissions: $FILE_PERMS (expected: 600)"
  echo "  File owner: $FILE_OWNER (expected: $APP_USER)"
  echo "  File size: $FILE_SIZE bytes"
  
  if [ "$FILE_PERMS" != "600" ]; then
    warn "Incorrect file permissions (expected 600)"
    say "Fixing file permissions..."
    if sudo chmod 600 "$KEY_FILE" 2>/dev/null || chmod 600 "$KEY_FILE" 2>/dev/null; then
      ok "File permissions fixed to 600"
    else
      fail "Failed to fix file permissions"
    fi
  else
    ok "File permissions correct (600)"
  fi
  
  if [ "$FILE_OWNER" != "$APP_USER" ]; then
    warn "Incorrect file owner (expected: $APP_USER)"
    say "Fixing file ownership..."
    if sudo chown "$APP_USER:$APP_USER" "$KEY_FILE" 2>/dev/null; then
      ok "File ownership fixed to $APP_USER:$APP_USER"
    else
      fail "Failed to fix file ownership"
    fi
  else
    ok "File owner correct ($APP_USER)"
  fi
  
  if [ "$FILE_SIZE" -eq 0 ]; then
    warn "Key file is empty - key may need to be re-entered"
  else
    ok "Key file is not empty ($FILE_SIZE bytes)"
  fi
else
  warn "Check Point TE key file does not exist"
  say "This is normal if the key hasn't been saved yet"
fi

echo ""

# Check write permissions
say "Testing write permissions..."

TEST_FILE="$SECURE_STORAGE_DIR/.test-write-$$"

if sudo -u "$APP_USER" touch "$TEST_FILE" 2>/dev/null || touch "$TEST_FILE" 2>/dev/null; then
  ok "Write permission test passed"
  rm -f "$TEST_FILE" 2>/dev/null || true
else
  fail "Write permission test failed - $APP_USER cannot write to .secure-storage"
  say "Attempting to fix permissions and ownership..."
  sudo chmod 700 "$SECURE_STORAGE_DIR" 2>/dev/null || true
  sudo chown -R "$APP_USER:$APP_USER" "$SECURE_STORAGE_DIR" 2>/dev/null || true
  ok "Permissions and ownership updated - please try saving the key again"
fi

echo ""

# Check service status
say "Checking service status..."

if sudo systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
  ok "Service is running"
else
  warn "Service is not running"
fi

# Summary
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Diagnostic Complete                        ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Summary:"
say "  App directory: $APP_DIR"
say "  App user: $APP_USER"
say "  .secure-storage: $SECURE_STORAGE_DIR"
say "  Permissions: $(stat -c%a "$SECURE_STORAGE_DIR" 2>/dev/null || echo 'unknown')"
echo ""
say "Next steps:"
say "  1. Try saving the Check Point TE API key in the Settings page"
say "  2. Check application logs: sudo journalctl -u secure-ai-chat -f"
say "  3. Verify key was saved: ls -la $SECURE_STORAGE_DIR/"
echo ""
