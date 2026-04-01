#!/usr/bin/env bash
# Secure AI Chat — fresh production install on a remote Ubuntu VM
#
# Runs the same full path as install_ubuntu_clean.sh (apt deps, dedicated user,
# Node 24 via nvm, clone, npm ci, production build, systemd, UFW) with defaults
# aligned to the current 1.1.x release line.
#
# --- One-liner (run ON THE VM as a normal user with sudo; not as root) ---
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-remote-production-vm.sh | bash
#
# --- Pin a different tag or branch ---
#   GIT_REF=main curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-remote-production-vm.sh | bash
#   GIT_REF=v1.1.3 curl -fsSL ... | bash
#
# --- Faster install (skip secrets/typecheck/lint gate; not recommended for prod) ---
#   USE_BUILD_FRESH=0 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-remote-production-vm.sh | bash
#
# --- Custom install directory / user (e.g. match adminuser home layout) ---
#   INSTALL_DIR=/home/adminuser/secure-ai-chat APP_USER=adminuser curl -fsSL ... | bash
#
# --- After install ---
#   • Configure API keys: sudo nano /opt/secure-ai-chat/.env.local (or your INSTALL_DIR)
#   • Restart: sudo systemctl restart secure-ai-chat
#   • Future upgrades (same machine): pipe upgrade-remote-production-v3.sh (default GIT_REF=v1.1.6)
#
# Repo: https://github.com/mazh-cp/secure-ai-chat

set -euo pipefail

INSTALL_SCRIPT_URL="${INSTALL_SCRIPT_URL:-https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_clean.sh}"

# Pin release for reproducible deploys (override with GIT_REF=main for latest main)
export BRANCH="${GIT_REF:-${BRANCH:-v1.1.6}}"
export INSTALL_DIR="${INSTALL_DIR:-/opt/secure-ai-chat}"
export APP_USER="${APP_USER:-secureai}"
export APP_GROUP="${APP_GROUP:-secureai}"
export NODE_VERSION="${NODE_VERSION:-24.13.0}"
export SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
# Match upgrade-remote-production-v3.sh: full production gate on the VM
export USE_BUILD_FRESH="${USE_BUILD_FRESH:-1}"
export REPO_URL="${REPO_URL:-https://github.com/mazh-cp/secure-ai-chat.git}"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Secure AI Chat — remote production install (fresh Ubuntu VM)   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Git ref (clone):${NC}     $BRANCH"
echo -e "${GREEN}Install directory:${NC}  $INSTALL_DIR"
echo -e "${GREEN}Service user:${NC}         $APP_USER"
echo -e "${GREEN}Node:${NC}                 $NODE_VERSION"
echo -e "${GREEN}Build:${NC}                $([ "${USE_BUILD_FRESH}" = "1" ] || [ "${USE_BUILD_FRESH}" = "true" ] && echo 'npm run build:fresh' || echo 'npm run build')"
echo -e "${GREEN}Installer script:${NC}     $INSTALL_SCRIPT_URL"
echo ""

curl -fsSL "$INSTALL_SCRIPT_URL" | bash
