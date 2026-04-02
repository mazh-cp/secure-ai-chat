#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Push latest Secure AI Chat code from GitHub to your production VM
# (e.g. Lakera server-first project_id merge fix on branch main).
#
# Prerequisites
# -------------
#   1. Code is pushed to origin (usually main):
#        git push origin main
#   2. SSH works to the VM:
#        ssh user@your-vm
#
# Usage (from laptop, inside the secure-ai-chat repo clone)
# ---------------------------------------------------------
#   ./scripts/push-fix-to-production-vm.sh user@YOUR_VM_HOST
#
#   APP_DIR=/opt/secure-ai-chat ./scripts/push-fix-to-production-vm.sh user@vm
#   SSH_OPTS="-i ~/.ssh/prod_ed25519" ./scripts/push-fix-to-production-vm.sh user@vm
#
# Environment (optional)
# ----------------------
#   SSH_TARGET   — same as first argument if you prefer not to pass argv
#   SSH_OPTS     — extra ssh(1) flags
#   GIT_REF      — git ref to deploy (default: main)
#   APP_DIR      — remote install path (forwarded to the upgrade script on the VM)
#   USE_V2       — default 1; uses upgrade-remote-production-v2.sh from GitHub
#   USE_V3       — set to 1 to use upgrade-remote-production-v3.sh instead
#   RUN_TYPECHECK, HEALTH_RETRIES, USE_BUILD_FRESH — forwarded when supported
#
# What this script does
# ---------------------
#   Runs scripts/run-remote-production-upgrade.sh, which SSHs into the VM and
#   executes: curl …/upgrade-remote-production-v2.sh | bash
#   That pipeline backs up .env.local / .secure-storage, pulls GIT_REF, npm ci,
#   builds, restarts secure-ai-chat, and probes /api/health.
#
# If GitHub raw URLs are blocked or the repo is private
# -----------------------------------------------------
#   Use direct mode (git only on the VM; no curl of raw scripts):
#
#     DIRECT=1 APP_DIR=/opt/secure-ai-chat APP_USER=secureai \
#       ./scripts/push-fix-to-production-vm.sh user@vm
#
#   Or SSH manually and run the one-liner documented in docs/UPGRADE_REMOTE.md
#   (git pull in APP_DIR, npm ci, npm run build, systemctl restart secure-ai-chat).
#
# -----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -n "${1:-}" ]; then
  export SSH_TARGET="${SSH_TARGET:-$1}"
fi

if [ -z "${SSH_TARGET:-}" ]; then
  echo "Usage: $0 user@remote-host" >&2
  echo "   or: SSH_TARGET=user@remote-host $0" >&2
  exit 1
fi

export GIT_REF="${GIT_REF:-main}"

echo "=============================================================================="
echo "  Secure AI Chat — deploy latest code to production VM"
echo "=============================================================================="
echo "  Target:     ${SSH_TARGET}"
echo "  Git ref:    ${GIT_REF}"
echo "  Repo root:  ${REPO_ROOT}"
[ -n "${APP_DIR:-}" ] && echo "  APP_DIR:    ${APP_DIR}"
echo ""
echo "  Ensure you have already:  git push origin ${GIT_REF}"
echo "=============================================================================="
echo ""

DIRECT="${DIRECT:-0}"
if [ "${DIRECT}" = "1" ] || [ "${DIRECT}" = "true" ]; then
  REMOTE_APP_DIR="${APP_DIR:-/opt/secure-ai-chat}"
  REMOTE_USER="${APP_USER:-secureai}"
  REMOTE_SERVICE="${SERVICE_NAME:-secure-ai-chat}"

  echo "==> DIRECT=1: git pull + build on VM (no curl from raw.githubusercontent.com)"
  echo "    APP_DIR=${REMOTE_APP_DIR}  APP_USER=${REMOTE_USER}  SERVICE=${REMOTE_SERVICE}"
  echo ""

  # shellcheck disable=SC2086
  ssh ${SSH_OPTS:-} -t "${SSH_TARGET}" bash -s -- \
    "${GIT_REF}" "${REMOTE_APP_DIR}" "${REMOTE_USER}" "${REMOTE_SERVICE}" <<'REMOTE_EOF'
set -euo pipefail
GIT_REF="$1"
APP_DIR="$2"
APP_USER="$3"
SERVICE_NAME="$4"

if [ ! -d "$APP_DIR" ] || [ ! -f "$APP_DIR/package.json" ]; then
  echo "ERROR: APP_DIR missing or not an app root: $APP_DIR" >&2
  exit 1
fi

echo "==> Stop service (if running)"
if sudo systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  sudo systemctl stop "$SERVICE_NAME" || true
fi

echo "==> Fetch and checkout origin/${GIT_REF}"
sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin --tags
if ! sudo -u "$APP_USER" git -C "$APP_DIR" pull origin "$GIT_REF"; then
  echo "WARN: pull failed; resetting hard to origin/${GIT_REF}"
  sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/${GIT_REF}"
fi

echo "==> Install deps + production build"
sudo -u "$APP_USER" bash -c "
  set -euo pipefail
  cd \"$APP_DIR\" || exit 1
  export HOME=\"\${HOME:-$APP_DIR}\"
  if [ -s \"\$HOME/.nvm/nvm.sh\" ]; then
    # shellcheck source=/dev/null
    . \"\$HOME/.nvm/nvm.sh\"
  fi
  npm ci
  npm run build
"

echo "==> Start service"
sudo systemctl start "$SERVICE_NAME"
sleep 2
sudo systemctl is-active --quiet "$SERVICE_NAME" && echo "OK: $SERVICE_NAME is active" || {
  echo "WARN: service may not be active; check: sudo systemctl status $SERVICE_NAME"
  exit 1
}

echo "==> Health (localhost)"
curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" >/dev/null && echo "OK: /api/health" || echo "WARN: /api/health failed (check PORT / reverse proxy)"
REMOTE_EOF

  echo ""
  echo "==> Direct deploy finished."
  exit 0
fi

export USE_V2="${USE_V2:-1}"
export USE_V3="${USE_V3:-0}"

exec bash "$SCRIPT_DIR/run-remote-production-upgrade.sh" "${SSH_TARGET}"
