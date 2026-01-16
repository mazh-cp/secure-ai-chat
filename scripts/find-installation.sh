#!/usr/bin/env bash
# Find Installation Script
# Helps locate the secure-ai-chat installation on the system

set -euo pipefail

echo "🔍 Searching for secure-ai-chat installation..."
echo ""

FOUND=0

# Search common locations
SEARCH_PATHS=(
  "/opt/secure-ai-chat"
  "$HOME/secure-ai-chat"
  "/home/$USER/secure-ai-chat"
  "/var/www/secure-ai-chat"
)

echo "Checking common locations:"
for path in "${SEARCH_PATHS[@]}"; do
  if [ -d "$path" ] && [ -f "$path/package.json" ]; then
    echo "  ✅ Found: $path"
    FOUND=$((FOUND + 1))
  else
    echo "  ❌ Not found: $path"
  fi
done

echo ""
echo "Searching entire system (this may take a moment)..."
FOUND_PATHS=$(find /home /opt /var/www 2>/dev/null -name "package.json" -path "*secure-ai-chat*" | head -10 || echo "")

if [ -n "$FOUND_PATHS" ]; then
  echo "Found installations:"
  echo "$FOUND_PATHS" | while read -r path; do
    dir=$(dirname "$path")
    echo "  ✅ $dir"
    FOUND=$((FOUND + 1))
  done
fi

echo ""
echo "Checking systemd service..."
SYSTEMD_PATH=$(sudo cat /etc/systemd/system/secure-ai-chat.service 2>/dev/null | grep WorkingDirectory | awk -F'=' '{print $2}' | tr -d ' ' || echo "")
if [ -n "$SYSTEMD_PATH" ]; then
  if [ -d "$SYSTEMD_PATH" ]; then
    echo "  ✅ Found via systemd: $SYSTEMD_PATH"
    FOUND=$((FOUND + 1))
  else
    echo "  ⚠️  Systemd points to: $SYSTEMD_PATH (but directory doesn't exist)"
  fi
else
  echo "  ❌ Systemd service not found"
fi

echo ""
if [ $FOUND -eq 0 ]; then
  echo "❌ No installation found!"
  echo ""
  echo "Options:"
  echo "  1. Run fresh install:"
  echo "     curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-remote.sh | bash"
  echo ""
  echo "  2. Check if you're in the right VM or location"
  exit 1
else
  echo "✅ Found $FOUND installation(s)"
  echo ""
  echo "To upgrade, use the path above:"
  echo "  APP_DIR=/path/to/installation curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-production.sh | bash"
fi
