#!/usr/bin/env bash
# Secure AI Chat — Remote production upgrade v3 (1.1.x release line)
#
# Intended for the post–1.0.22 toolchain: ESLint 9 flat config, exceljs, build:fresh,
# verify-build, check:secrets (client + git-tracked leak scan), npm audit hygiene.
#
# Defaults (override with env vars on the bash that consumes this pipe):
#   GIT_REF=v1.1.3        — pin this tag on the VM; falls back to main if tag missing (see upgrade-curl-production.sh)
#   USE_BUILD_FRESH=1     — npm run build:fresh on server (secrets + typecheck + lint + verify standalone)
#   RUN_TYPECHECK=1       — kept for parity; skipped inside build:fresh when USE_BUILD_FRESH=1
#   HEALTH_RETRIES=0      — upgrade-curl sets 12 when USE_BUILD_FRESH=1 and retries were 0
#
# On the production VM:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-v3.sh | bash
#
# Track main instead of the tag:
#   curl -fsSL .../upgrade-remote-production-v3.sh | GIT_REF=main bash
#
# Faster build (skip lint/secrets gate — not recommended for production):
#   curl -fsSL .../upgrade-remote-production-v3.sh | USE_BUILD_FRESH=0 RUN_TYPECHECK=1 bash
#
# Custom app directory:
#   curl -fsSL .../upgrade-remote-production-v3.sh | APP_DIR=/opt/secure-ai-chat bash
#
# From laptop (repo checkout):
#   USE_V3=1 SSH_TARGET=user@host bash scripts/run-remote-production-upgrade.sh
#
# Fork:
#   UPGRADE_SCRIPT_URL=https://raw.githubusercontent.com/you/secure-ai-chat/main/scripts/upgrade-curl-production.sh \
#     curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-v3.sh | bash
#
set -euo pipefail

export GIT_REF="${GIT_REF:-v1.1.3}"
export USE_BUILD_FRESH="${USE_BUILD_FRESH:-1}"
export RUN_TYPECHECK="${RUN_TYPECHECK:-1}"
export HEALTH_RETRIES="${HEALTH_RETRIES:-0}"

UPGRADE_SCRIPT_URL="${UPGRADE_SCRIPT_URL:-https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh}"

echo "==> Remote production upgrade v3 — release line 1.1.x (default tag ${GIT_REF})"
echo "==> USE_BUILD_FRESH=${USE_BUILD_FRESH} RUN_TYPECHECK=${RUN_TYPECHECK} HEALTH_RETRIES=${HEALTH_RETRIES}"
echo "==> Underlying: ${UPGRADE_SCRIPT_URL}"
echo ""

curl -fsSL "${UPGRADE_SCRIPT_URL}" | bash -s -- "$@"
