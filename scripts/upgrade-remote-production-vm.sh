#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Upgrade Secure AI Chat on a remote production VM (full app: latest main).
#
# Applies everything currently on origin (e.g. Lakera server-first project_id,
# /api/scan + /api/chat merge helper, Settings copy, deploy scripts) once you have
# pushed:  git push origin main
#
# Prerequisites
# -------------
#   1. Code on GitHub:  git push origin <branch-or-tag>
#   2. SSH to the VM:   ssh user@your-vm
#
# Usage (from your laptop, any directory — uses bundled run-remote script)
# ------------------------------------------------------------------------
#   ./scripts/upgrade-remote-production-vm.sh user@YOUR_VM_HOST
#
#   APP_DIR=/opt/secure-ai-chat ./scripts/upgrade-remote-production-vm.sh user@vm
#   SSH_OPTS="-i ~/.ssh/prod_ed25519" ./scripts/upgrade-remote-production-vm.sh user@vm
#
# Environment (optional)
# ----------------------
#   SSH_TARGET   — same as first argument
#   SSH_OPTS     — extra ssh(1) flags (e.g. "-i ~/.ssh/key")
#   GIT_REF      — branch or tag to deploy (default: main)
#   APP_DIR      — remote install path (passed into the VM upgrade script)
#   USE_V2       — default 1; VM runs upgrade-remote-production-v2.sh via curl
#   USE_V3       — set to 1 for upgrade-remote-production-v3.sh instead
#   DIRECT       — set to 1 for git-only path (no raw.githubusercontent.com)
#   APP_USER     — with DIRECT=1, unix user for git/npm (default: secureai)
#   SERVICE_NAME — systemd unit (default: secure-ai-chat)
#   RUN_TYPECHECK, HEALTH_RETRIES, USE_BUILD_FRESH — forwarded when using USE_V2/USE_V3
#
# Default path (standard mode)
# ----------------------------
#   SSH → curl …/upgrade-remote-production-v2.sh | bash
#   That runs upgrade-curl-production.sh: backup .env.local / .secure-storage,
#   git fetch/checkout GIT_REF, npm ci, production build, restart service, /api/health.
#
# DIRECT=1 (no curl of raw GitHub scripts)
# ------------------------------------------
#   DIRECT=1 APP_DIR=/opt/secure-ai-chat APP_USER=secureai \
#     ./scripts/upgrade-remote-production-vm.sh user@vm
#
# VM-only one-liner (no laptop script)
# --------------------------------------
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-v2.sh | bash
#   curl -fsSL … | APP_DIR=/opt/secure-ai-chat GIT_REF=main bash
#
# See also: docs/UPGRADE_REMOTE.md
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
  echo "" >&2
  echo "  DIRECT=1 APP_DIR=/opt/secure-ai-chat $0 user@host   # git-only on VM" >&2
  exit 1
fi

export GIT_REF="${GIT_REF:-main}"

echo "=============================================================================="
echo "  Secure AI Chat — remote production VM upgrade"
echo "=============================================================================="
echo "  Target:     ${SSH_TARGET}"
echo "  Git ref:    ${GIT_REF}"
echo "  Repo root:  ${REPO_ROOT}"
[ -n "${APP_DIR:-}" ] && echo "  APP_DIR:    ${APP_DIR}"
echo ""
echo "  Push code first:  git push origin ${GIT_REF}"
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
  echo "==> Remote production upgrade (direct) finished."
  exit 0
fi

export USE_V2="${USE_V2:-1}"
export USE_V3="${USE_V3:-0}"

exec bash "$SCRIPT_DIR/run-remote-production-upgrade.sh" "${SSH_TARGET}"
