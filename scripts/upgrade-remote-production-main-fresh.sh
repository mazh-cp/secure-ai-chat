#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Secure AI Chat — upgrade existing production VM from latest main + build:fresh
#
# Use this when you want the newest commits on origin/main (PII/RAG fixes, storage
# root, Lakera tweaks, etc.) instead of a pinned release tag.
#
# Same underlying flow as upgrade-remote-production-v3.sh but default GIT_REF=main.
# Not a fresh install — for new VMs use install-remote-vm-v1.1.sh or
# fresh-production-build-from-remote-repo.sh (install path).
#
# On the production VM (vars after the pipe apply to bash, not curl):
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-main-fresh.sh | bash
#
# Pin a tag or branch instead of main:
#
#   curl -fsSL .../upgrade-remote-production-main-fresh.sh | GIT_REF=v1.1.13 bash
#
# Custom app directory:
#
#   curl -fsSL .../upgrade-remote-production-main-fresh.sh | APP_DIR=/opt/secure-ai-chat bash
#
# From laptop (repo checkout):
#
#   USE_MAIN_FRESH=1 SSH_TARGET=user@host bash scripts/run-remote-production-upgrade.sh
#   USE_MAIN_FRESH=1 SSH_TARGET=user@host bash scripts/build-remote-production-vm.sh
#
# Fork:
#   UPGRADE_SCRIPT_URL=https://raw.githubusercontent.com/you/secure-ai-chat/main/scripts/upgrade-curl-production.sh \
#     curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-main-fresh.sh | bash
#
# Repo: https://github.com/mazh-cp/secure-ai-chat
# -----------------------------------------------------------------------------

set -euo pipefail

export GIT_REF="${GIT_REF:-main}"
export USE_BUILD_FRESH="${USE_BUILD_FRESH:-1}"
export RUN_TYPECHECK="${RUN_TYPECHECK:-1}"
export HEALTH_RETRIES="${HEALTH_RETRIES:-0}"

UPGRADE_SCRIPT_URL="${UPGRADE_SCRIPT_URL:-https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh}"

echo "==> Remote production upgrade — latest main + build:fresh (GIT_REF=${GIT_REF})"
echo "==> USE_BUILD_FRESH=${USE_BUILD_FRESH} RUN_TYPECHECK=${RUN_TYPECHECK} HEALTH_RETRIES=${HEALTH_RETRIES}"
echo "==> Underlying: ${UPGRADE_SCRIPT_URL}"
echo ""

curl -fsSL "${UPGRADE_SCRIPT_URL}" | bash -s -- "$@"
