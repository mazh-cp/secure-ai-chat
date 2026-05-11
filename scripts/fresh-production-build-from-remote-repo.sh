#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Secure AI Chat — fresh install from the remote GitHub repo
#
# This script does NOT run an in-place upgrade. It runs install_ubuntu_clean.sh:
# apt deps, dedicated user, Node via nvm, clone at GIT_REF, npm ci, production
# build (build:fresh by default), systemd, UFW — for a new or wiped Ubuntu VM.
#
# To upgrade an existing install on the same machine, use instead:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-v3.sh | bash
#   or: upgrade-curl-production.sh with APP_DIR / GIT_REF / USE_BUILD_FRESH=1
#
# Filename is kept for stable bookmarked curl URLs; behavior is fresh install only.
#
# One-liner (on the VM as a normal user with sudo; not as root):
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fresh-production-build-from-remote-repo.sh | bash
#
# Track main instead of the pinned tag (keep default tag in sync with lib/app-release.ts):
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fresh-production-build-from-remote-repo.sh | GIT_REF=main bash
#
# Custom install directory (env, or first argument):
#
#   curl -fsSL .../fresh-production-build-from-remote-repo.sh | INSTALL_DIR=/home/adminuser/secure-ai-chat APP_USER=adminuser bash
#   curl -fsSL .../fresh-production-build-from-remote-repo.sh | bash -s -- /opt/secure-ai-chat
#
# Faster build (skip secrets/typecheck/lint — not recommended for production):
#
#   curl -fsSL .../fresh-production-build-from-remote-repo.sh | USE_BUILD_FRESH=0 bash
#
# Fork / alternate installer URL:
#
#   INSTALL_SCRIPT_URL=https://raw.githubusercontent.com/you/secure-ai-chat/main/scripts/install_ubuntu_clean.sh \
#     curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fresh-production-build-from-remote-repo.sh | bash
#
# Repo: https://github.com/mazh-cp/secure-ai-chat
# Same defaults as: scripts/install-remote-production-vm.sh, scripts/install-remote-vm-v1.1.sh
# -----------------------------------------------------------------------------

set -euo pipefail

INSTALL_SCRIPT_URL="${INSTALL_SCRIPT_URL:-https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_clean.sh}"

if [ -n "${1:-}" ]; then
  export INSTALL_DIR="$1"
fi

export INSTALL_DIR="${INSTALL_DIR:-/opt/secure-ai-chat}"
export BRANCH="${GIT_REF:-${BRANCH:-v1.1.13}}"
export APP_USER="${APP_USER:-secureai}"
export APP_GROUP="${APP_GROUP:-secureai}"
export NODE_VERSION="${NODE_VERSION:-24.13.0}"
export SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
export USE_BUILD_FRESH="${USE_BUILD_FRESH:-1}"
export REPO_URL="${REPO_URL:-https://github.com/mazh-cp/secure-ai-chat.git}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Secure AI Chat — fresh install from remote repo (curl → VM)     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Mode:${NC}                Fresh install (install_ubuntu_clean.sh), not upgrade"
echo -e "${GREEN}Git ref (clone):${NC}     $BRANCH"
echo -e "${GREEN}Install directory:${NC}  $INSTALL_DIR"
echo -e "${GREEN}Service user:${NC}        $APP_USER"
echo -e "${GREEN}Node:${NC}                $NODE_VERSION"
echo -e "${GREEN}Build:${NC}               $([ "${USE_BUILD_FRESH}" = "1" ] || [ "${USE_BUILD_FRESH}" = "true" ] && echo 'npm run build:fresh' || echo 'npm run build')"
echo -e "${GREEN}Installer script:${NC}    $INSTALL_SCRIPT_URL"
echo ""

curl -fsSL "$INSTALL_SCRIPT_URL" | bash
