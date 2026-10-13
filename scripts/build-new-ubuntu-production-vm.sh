#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Secure AI Chat — Build a NEW production VM (Ubuntu 22.04 / 24.04 LTS+)
#
# Run this ON the fresh Ubuntu VM as a normal user with sudo (not as root).
# It installs apt deps, creates service user, Node 24 via nvm, clones the repo,
# runs npm ci + build:fresh, enables systemd + UFW.
#
# ========================= ONE-LINERS (on the VM) =========================
#
# Stable release pin (default of this script: v1.3.0):
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/build-new-ubuntu-production-vm.sh | bash
#
# Latest main:
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/build-new-ubuntu-production-vm.sh | GIT_REF=main bash
#
# Ollama in-app manage feature branch (until merged):
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/cursor/ollama-in-app-model-install/scripts/build-new-ubuntu-production-vm.sh | GIT_REF=cursor/ollama-in-app-model-install bash
#
# Custom install dir / user (e.g. Azure adminuser home):
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/build-new-ubuntu-production-vm.sh | \
#     INSTALL_DIR=/home/adminuser/secure-ai-chat APP_USER=adminuser APP_GROUP=adminuser bash
#
# Also install Ollama on the host after the app is up:
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/build-new-ubuntu-production-vm.sh | \
#     INSTALL_OLLAMA=1 bash
#
# ========================= FROM YOUR LAPTOP (SSH) =========================
#
#   export SSH_TARGET=adminuser@YOUR_VM_IP
#   ssh "$SSH_TARGET" 'curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/build-new-ubuntu-production-vm.sh | GIT_REF=v1.3.0 bash'
#
# Put env overrides on the RIGHT of the pipe (bash sees them). Wrong:
#   GIT_REF=v1.3.0 curl ... | bash
#
# Repo: https://github.com/mazh-cp/secure-ai-chat
# -----------------------------------------------------------------------------

set -euo pipefail

# Prefer raw from the same ref you are installing when possible; fall back to main's clean installer.
INSTALL_SCRIPT_URL="${INSTALL_SCRIPT_URL:-https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_clean.sh}"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ "${EUID:-0}" -eq 0 ] && [ -z "${ALLOW_ROOT_INSTALL:-}" ]; then
  echo -e "${RED}Do not run as root.${NC} Use a sudo-capable user (e.g. ubuntu / adminuser)." >&2
  echo "For automation only: ALLOW_ROOT_INSTALL=1" >&2
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo -e "${RED}sudo is required.${NC}" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo -e "${YELLOW}curl missing — installing…${NC}"
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y curl
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

# Production defaults (override with env vars AFTER the pipe)
export BRANCH="${GIT_REF:-${BRANCH:-v1.3.0}}"
export INSTALL_DIR="${INSTALL_DIR:-/opt/secure-ai-chat}"
export APP_USER="${APP_USER:-secureai}"
export APP_GROUP="${APP_GROUP:-secureai}"
export NODE_VERSION="${NODE_VERSION:-24.13.0}"
export SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
export USE_BUILD_FRESH="${USE_BUILD_FRESH:-1}"
export REPO_URL="${REPO_URL:-https://github.com/mazh-cp/secure-ai-chat.git}"
INSTALL_OLLAMA="${INSTALL_OLLAMA:-0}"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Secure AI Chat — NEW Ubuntu production VM build             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Git ref (clone):${NC}      $BRANCH"
echo -e "${GREEN}Install directory:${NC}   $INSTALL_DIR"
echo -e "${GREEN}Service user:${NC}        $APP_USER"
echo -e "${GREEN}Node:${NC}                $NODE_VERSION"
echo -e "${GREEN}Build:${NC}               $([ "${USE_BUILD_FRESH}" = "1" ] || [ "${USE_BUILD_FRESH}" = "true" ] && echo 'npm run build:fresh' || echo 'npm run build')"
echo -e "${GREEN}Install Ollama:${NC}      $INSTALL_OLLAMA"
echo -e "${GREEN}Underlying script:${NC}  $INSTALL_SCRIPT_URL"
echo ""
echo "Fetching clean installer…"
curl -fsSL "$INSTALL_SCRIPT_URL" | bash

echo ""
echo -e "${GREEN}==> App install finished.${NC}"

if [ "${INSTALL_OLLAMA}" = "1" ] || [ "${INSTALL_OLLAMA}" = "true" ]; then
  echo ""
  echo -e "${BLUE}==> Installing Ollama (loopback inference for Local model)${NC}"
  if command -v ollama >/dev/null 2>&1; then
    echo "ollama already on PATH: $(command -v ollama)"
  else
    curl -fsSL https://ollama.com/install.sh | sh
  fi
  # Prefer systemd user/service if the installer registered one
  if systemctl list-unit-files 2>/dev/null | grep -q '^ollama\.service'; then
    sudo systemctl enable --now ollama || true
  fi
  echo "Ollama: set Local Model Base URL in the app to http://127.0.0.1:11434/v1"
  echo "Optional pull: ollama pull llama3.2"
fi

echo ""
echo -e "${BLUE}==> Post-install checklist${NC}"
echo "  1. Configure keys:  sudo nano ${INSTALL_DIR}/.env.local"
echo "  2. Restart app:     sudo systemctl restart ${SERVICE_NAME}"
echo "  3. Status:          sudo systemctl status ${SERVICE_NAME} --no-pager"
echo "  4. Health:          curl -fsS http://127.0.0.1:3000/api/health"
echo "  5. Version:         curl -fsS http://127.0.0.1:3000/api/version"
echo "  6. Open firewall if needed (installer may already open 3000 via UFW)"
echo ""
echo -e "${GREEN}Done. Secure AI Chat production VM build complete.${NC}"
