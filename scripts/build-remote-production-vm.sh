#!/usr/bin/env bash
# Secure AI Chat — build and roll out on a remote production VM over SSH.
#
# Defaults target the 1.1.x upgrade line (upgrade-remote-production-v3.sh):
#   USE_V3=1, GIT_REF=v1.1.8, USE_BUILD_FRESH=1
#
# Prerequisites on the VM:
#   - Git clone of this repo (see install_ubuntu_clean.sh or your layout)
#   - systemd unit secure-ai-chat (or SERVICE_NAME)
#   - Node + npm (nvm under app home is supported by upgrade-curl-production.sh)
#   - Full npm install (devDependencies) when USE_BUILD_FRESH=1 — eslint required for lint in build:fresh
#
# Usage (from your laptop, repo root):
#   export SSH_TARGET=adminuser@YOUR_VM_PUBLIC_IP
#   bash scripts/build-remote-production-vm.sh
#
# Track main on the VM instead of v1.1.8:
#   GIT_REF=main SSH_TARGET=user@host bash scripts/build-remote-production-vm.sh
#
# Use legacy v2 wrapper (1.0.x-style defaults):
#   USE_V3=0 USE_V2=1 GIT_REF=main SSH_TARGET=user@host bash scripts/build-remote-production-vm.sh
#
# Environment:
#   SSH_TARGET      — user@host (required unless first argument)
#   SSH_OPTS        — extra ssh args
#   USE_V3          — 1 (default): upgrade-remote-production-v3.sh
#   USE_V2          — used when USE_V3=0 (default 1)
#   GIT_REF         — default v1.1.2 when USE_V3=1; main when USE_V3=0
#   USE_BUILD_FRESH — default 1 when USE_V3=1; 0 when USE_V3=0
#   APP_DIR, RUN_TYPECHECK, HEALTH_RETRIES — forwarded like run-remote-production-upgrade.sh
#   REPO_RAW        — GitHub raw base if fork
#
# On the VM only (equivalent to v3 defaults):
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-v3.sh | bash
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT" || exit 1

TARGET="${SSH_TARGET:-${1:-}}"
if [ -z "$TARGET" ]; then
  echo "Usage: SSH_TARGET=user@host bash scripts/build-remote-production-vm.sh" >&2
  echo "   or: bash scripts/build-remote-production-vm.sh user@host" >&2
  exit 1
fi

export USE_V3="${USE_V3:-1}"

if [ "${USE_V3}" = "1" ] || [ "${USE_V3}" = "true" ]; then
  export GIT_REF="${GIT_REF:-v1.1.8}"
  export USE_BUILD_FRESH="${USE_BUILD_FRESH:-1}"
  export USE_V2="${USE_V2:-0}"
else
  export GIT_REF="${GIT_REF:-main}"
  export USE_BUILD_FRESH="${USE_BUILD_FRESH:-0}"
  export USE_V2="${USE_V2:-1}"
fi

echo "==> Remote production build"
echo "    Target:          $TARGET"
echo "    USE_V3:          $USE_V3"
echo "    GIT_REF:         $GIT_REF"
echo "    USE_V2:          $USE_V2"
echo "    USE_BUILD_FRESH: $USE_BUILD_FRESH"
echo ""

exec bash "$SCRIPT_DIR/run-remote-production-upgrade.sh" "$TARGET"
