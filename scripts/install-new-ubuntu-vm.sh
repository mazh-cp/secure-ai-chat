#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Secure AI Chat — install on a newer Ubuntu VM (22.04 / 24.04 LTS+)
#
# This script only validates the environment and exports production-friendly
# defaults, then runs the same installer as install-remote-production-vm.sh
# (which wraps install_ubuntu_clean.sh: apt deps, user secureai, nvm Node,
# clone, npm ci, build:fresh, systemd, UFW).
#
# Prerequisites
#   • Ubuntu x86_64, 22.04 or newer (24.04 LTS recommended)
#   • Run as a normal user with sudo (not root); cloud images usually OK
#   • Outbound HTTPS (GitHub, registry.npmjs.org, Node download if needed)
#
# One-liner (on the VM):
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-new-ubuntu-vm.sh | bash
#
# Pin a release tag (recommended for production):
#   GIT_REF=v1.1.10 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-new-ubuntu-vm.sh | bash
#
# Track main instead of a tag:
#   GIT_REF=main curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-new-ubuntu-vm.sh | bash
#
# Custom paths (advanced):
#   INSTALL_DIR=/opt/secure-ai-chat APP_USER=secureai GIT_REF=v1.1.10 \
#     curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-new-ubuntu-vm.sh | bash
#
# Skip Ubuntu version warning only (not recommended):
#   SKIP_OS_CHECK=1 curl -fsSL ... | bash
#
# Repo: https://github.com/mazh-cp/secure-ai-chat
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
  echo -e "${RED}sudo is required.${NC} Install sudo or run from a standard Ubuntu cloud image." >&2
  exit 1
fi

if [ "${SKIP_OS_CHECK:-0}" != "1" ] && [ -r /etc/os-release ]; then
  # shellcheck source=/dev/null
  . /etc/os-release
  if [ "${ID:-}" = "ubuntu" ]; then
    ver="${VERSION_ID%%.*}"
    if [ -n "${ver}" ] && [ "${ver}" -lt 22 ] 2>/dev/null; then
      echo -e "${YELLOW}Warning:${NC} Ubuntu ${VERSION_ID:-?} is below 22.04; this stack targets 22.04+ / 24.04 LTS. Continue at your own risk." >&2
      echo "Set SKIP_OS_CHECK=1 to suppress this check." >&2
      sleep 2
    else
      echo -e "${GREEN}Detected:${NC} ${PRETTY_NAME:-Ubuntu ${VERSION_ID:-}}"
    fi
  else
    echo -e "${YELLOW}Warning:${NC} OS is ${ID:-unknown}, not Ubuntu. Installer is written for Ubuntu; other distros may fail." >&2
    sleep 2
  fi
fi

# Same defaults as install-remote-production-vm.sh (keep in sync when bumping releases)
export BRANCH="${GIT_REF:-${BRANCH:-v1.1.10}}"
export INSTALL_DIR="${INSTALL_DIR:-/opt/secure-ai-chat}"
export APP_USER="${APP_USER:-secureai}"
export APP_GROUP="${APP_GROUP:-secureai}"
export NODE_VERSION="${NODE_VERSION:-24.13.0}"
export SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
export USE_BUILD_FRESH="${USE_BUILD_FRESH:-1}"
export REPO_URL="${REPO_URL:-https://github.com/mazh-cp/secure-ai-chat.git}"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Secure AI Chat — new Ubuntu VM install (22.04+ / 24.04)     ║${NC}"
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
