#!/usr/bin/env bash
# Deploy Secure AI Chat to a remote VM after code is on GitHub.
#
# Typical workflow
# ---------------
# 1. Push your branch (usually main) to origin:
#      git push origin main
# 2. From this repo on your laptop, run this script with SSH access to the VM:
#      ./scripts/deploy-upgrade-remote-vm.sh adminuser@YOUR_VM_IP
#
#    Same behavior with more options (DIRECT=1, docs): ./scripts/upgrade-remote-production-vm.sh user@host
#
# What it does
# ------------
# SSH into the VM and run the same upgrade as:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-v2.sh | bash
# That script pulls GIT_REF from origin, installs deps, builds, and restarts the service.
#
# Environment (optional)
# ----------------------
#   SSH_TARGET     — user@host if you do not pass it as the first argument
#   SSH_OPTS       — extra ssh flags, e.g. "-i ~/.ssh/id_ed25519"
#   GIT_REF        — git ref on origin (default: main)
#   APP_DIR        — remote install path (default: detected on server, often /home/adminuser/secure-ai-chat)
#   RUN_TYPECHECK  — 1 to run typecheck before build (default via v2 wrapper)
#   HEALTH_RETRIES — retries for /api/health after restart
#   REPO_RAW       — raw GitHub base for upgrade scripts (forks), e.g.
#                    https://raw.githubusercontent.com/you/secure-ai-chat/main/scripts
#
# Examples
# --------
#   ./scripts/deploy-upgrade-remote-vm.sh adminuser@203.0.113.50
#   GIT_REF=main APP_DIR=/opt/secure-ai-chat ./scripts/deploy-upgrade-remote-vm.sh adminuser@vm
#   SSH_OPTS="-i ~/.ssh/prod_ed25519" ./scripts/deploy-upgrade-remote-vm.sh deploy@vm
#
# On the VM only (no laptop script)
# ---------------------------------
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-v2.sh | bash
#   curl -fsSL ... | GIT_REF=main APP_DIR=/home/adminuser/secure-ai-chat bash
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -n "${1:-}" ]; then
  export SSH_TARGET="${SSH_TARGET:-$1}"
fi

if [ -z "${SSH_TARGET:-}" ]; then
  echo "Usage: $0 user@remote-host" >&2
  echo "   or: SSH_TARGET=user@remote-host $0" >&2
  exit 1
fi

export GIT_REF="${GIT_REF:-main}"

echo "==> Remote VM upgrade"
echo "    SSH_TARGET=${SSH_TARGET}"
echo "    GIT_REF=${GIT_REF}"
[ -n "${APP_DIR:-}" ] && echo "    APP_DIR=${APP_DIR}"
echo ""

exec bash "$SCRIPT_DIR/run-remote-production-upgrade.sh"
