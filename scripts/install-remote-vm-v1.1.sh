#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Secure AI Chat — remote VM install (v1.1.x line, 2026)
#
# Combines production defaults from install-remote-production-vm.sh with the
# environment checks from install-new-ubuntu-vm.sh. Use this for new Ubuntu
# cloud VMs when you want one documented entry point.
#
# Prerequisites
#   • Ubuntu x86_64, 22.04 or newer (24.04 LTS recommended)
#   • Run as a normal user with sudo (not root), unless ALLOW_ROOT_INSTALL=1
#   • Outbound HTTPS (GitHub, registry.npmjs.org, Node download via nvm)
#
# One-liner (on the VM) — default pinned tag v1.1.13, /opt/secure-ai-chat, build:fresh:
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-remote-vm-v1.1.sh | bash
#
# Track main (latest from default branch):
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-remote-vm-v1.1.sh | GIT_REF=main bash
#
# Pin another tag (put variables on the bash side of the pipe, not on curl):
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-remote-vm-v1.1.sh | GIT_REF=v1.1.13 bash
#
# Custom install directory and user:
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-remote-vm-v1.1.sh | INSTALL_DIR=/home/adminuser/secure-ai-chat APP_USER=adminuser bash
#
# Faster build (skips secrets/typecheck/lint gate — not recommended for production):
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-remote-vm-v1.1.sh | USE_BUILD_FRESH=0 bash
#
# After install
#   • Keys: sudo nano /opt/secure-ai-chat/.env.local (or your INSTALL_DIR)
#   • Restart: sudo systemctl restart secure-ai-chat
#   • Future upgrades on same VM (existing install): upgrade-remote-production-v3.sh or upgrade-curl-production.sh
#   • Same fresh-install one-liner as this file: fresh-production-build-from-remote-repo.sh → install_ubuntu_clean.sh
#
# Repo: https://github.com/mazh-cp/secure-ai-chat
# Underlying: scripts/install_ubuntu_clean.sh (apt, user, nvm Node, clone, npm ci, build, systemd, UFW)
# -----------------------------------------------------------------------------

set -euo pipefail

INSTALL_SCRIPT_URL="${INSTALL_SCRIPT_URL:-https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_clean.sh}"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ "${EUID:-0}" -eq 0 ] && [ -z "${ALLOW_ROOT_INSTALL:-}" ]; then
  echo -e "${RED}Do not run as root.${NC} Use a sudo-capable user (e.g. ubuntu). For automation, set ALLOW_ROOT_INSTALL=1." >&2
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo -e "${RED}sudo is required.${NC}" >&2
  exit 1
fi

if [ "${SKIP_OS_CHECK:-0}" != "1" ] && [ -r /etc/os-release ]; then
  # shellcheck source=/dev/null
  . /etc/os-release
  if [ "${ID:-}" = "ubuntu" ]; then
    ver="${VERSION_ID%%.*}"
    if [ -n "${ver}" ] && [ "${ver}" -lt 22 ] 2>/dev/null; then
      echo -e "${YELLOW}Warning:${NC} Ubuntu ${VERSION_ID:-?} is below 22.04; this stack targets 22.04+ / 24.04 LTS." >&2
      echo "Set SKIP_OS_CHECK=1 to suppress." >&2
      sleep 2
    else
      echo -e "${GREEN}Detected:${NC} ${PRETTY_NAME:-Ubuntu ${VERSION_ID:-}}"
    fi
  else
    echo -e "${YELLOW}Warning:${NC} OS is ${ID:-unknown}, not Ubuntu. Continue at your own risk." >&2
    sleep 2
  fi
fi

# Keep in sync with install-remote-production-vm.sh / lib/app-release.ts when cutting releases
export BRANCH="${GIT_REF:-${BRANCH:-v1.1.13}}"
export INSTALL_DIR="${INSTALL_DIR:-/opt/secure-ai-chat}"
export APP_USER="${APP_USER:-secureai}"
export APP_GROUP="${APP_GROUP:-secureai}"
export NODE_VERSION="${NODE_VERSION:-24.13.0}"
export SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
export USE_BUILD_FRESH="${USE_BUILD_FRESH:-1}"
export REPO_URL="${REPO_URL:-https://github.com/mazh-cp/secure-ai-chat.git}"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Secure AI Chat — remote VM install (v1.1.13, Ubuntu 22.04+)    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Git ref (clone):${NC}      $BRANCH"
echo -e "${GREEN}Install directory:${NC}   $INSTALL_DIR"
echo -e "${GREEN}Service user:${NC}        $APP_USER"
echo -e "${GREEN}Node:${NC}                $NODE_VERSION"
echo -e "${GREEN}Build:${NC}               $([ "${USE_BUILD_FRESH}" = "1" ] || [ "${USE_BUILD_FRESH}" = "true" ] && echo 'npm run build:fresh' || echo 'npm run build')"
echo -e "${GREEN}Underlying script:${NC}  $INSTALL_SCRIPT_URL"
echo ""
echo "Fetching installer…"
curl -fsSL "$INSTALL_SCRIPT_URL" | bash
