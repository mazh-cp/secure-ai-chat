#!/usr/bin/env bash
# Enforce safe storage permissions for Secure AI Chat (v1.0.16+).
# Sets ownership and mode on DATA_DIR: no 777; recommended 755 for dirs, 644 for files.
# Run with sudo if changing ownership.

set -euo pipefail

APP_USER="${APP_USER:-}"
DATA_DIR="${DATA_DIR:-}"
[ -z "$DATA_DIR" ] && DATA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/data"

if [ ! -d "$DATA_DIR" ]; then
  echo "DATA_DIR does not exist: $DATA_DIR. Run preflight.sh first or set DATA_DIR."
  exit 1
fi

# Default: current user if APP_USER not set
[ -z "$APP_USER" ] && APP_USER=$(whoami)

echo "Applying storage permissions: DATA_DIR=$DATA_DIR APP_USER=$APP_USER"

# chown -R (only if running as root and APP_USER is different)
if [ "$(id -u)" = "0" ] && [ -n "$APP_USER" ]; then
  chown -R "$APP_USER:$APP_USER" "$DATA_DIR" 2>/dev/null || true
  echo "Ownership set to $APP_USER"
fi

# Safe modes: dirs 755, no 777
find "$DATA_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
find "$DATA_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
echo "Modes set: dirs 755, files 644"

# Reject any 777
if find "$DATA_DIR" -type d -perm -0777 2>/dev/null | grep -q .; then
  echo "WARNING: Some directories have 777. Consider: find $DATA_DIR -type d -perm -0777 -exec chmod 755 {} \;"
fi

echo "Storage permissions applied."
