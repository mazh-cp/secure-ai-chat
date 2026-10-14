#!/usr/bin/env bash
# Secure AI Chat — Remote production upgrade v4 (v1.3.2 release)
#
# What's new in v1.3.2 vs v1.3.0:
#   - 13 Anthropic Claude models (5, 4, 3.7, 3.5, 3 families); default claude-sonnet-5-5
#   - 200 k context window registered for every claude-* model ID
#   - POST /api/lakera/results — Lakera Guard /v2/guard/results proxy (session-gated)
#   - resolveLakeraGuardResultsEndpoint() in lib/lakera-guard-endpoint.ts
#   - CHECKPOINT_WAF_INTEGRATION_SUMMARY.md docs consolidated
#   - RAG only for lookup questions; general questions answered by the model alone
#   - Lakera: batched retrieval scans, no duplicate chat/upload scans, 429 retry, quota message
#   - GPT-5.x / o-series: no temperature sent; Responses API text parsed correctly
#   - Settings PIN required to replace or delete existing keys/project IDs; PIN attempt lockout
#
# Defaults (override with env vars on the bash side of the pipe — not on curl):
#   GIT_REF=main            — tracks main (which is now v1.3.2); override to pin a tag
#   USE_BUILD_FRESH=1       — runs npm run build:fresh (check:secrets + typecheck + lint + build)
#   HEALTH_RETRIES=12       — set automatically when USE_BUILD_FRESH=1
#   SERVICE_NAME=secure-ai-chat
#
# --- Usage ---
#
# One-liner on the production VM:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-v4.sh | bash
#
# Pin to a specific tag instead of main:
#   curl -fsSL .../upgrade-remote-production-v4.sh | GIT_REF=v1.3.2 bash
#
# Custom app directory:
#   curl -fsSL .../upgrade-remote-production-v4.sh | APP_DIR=/opt/secure-ai-chat bash
#
# Faster build (skip lint/secrets gate — not recommended for production):
#   curl -fsSL .../upgrade-remote-production-v4.sh | USE_BUILD_FRESH=0 RUN_TYPECHECK=1 bash
#
# From laptop (repo checkout):
#   USE_V4=1 SSH_TARGET=user@host bash scripts/run-remote-production-upgrade.sh
#   # or directly:
#   ssh user@host 'curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-v4.sh | bash'
#
# IMPORTANT: variables on the LEFT of | apply only to curl, NOT to bash.
#   Wrong:  GIT_REF=main curl -fsSL ... | bash        # bash will NOT see GIT_REF
#   Right:  curl -fsSL ... | GIT_REF=main bash

set -euo pipefail

export GIT_REF="${GIT_REF:-main}"
export USE_BUILD_FRESH="${USE_BUILD_FRESH:-1}"
export RUN_TYPECHECK="${RUN_TYPECHECK:-1}"
export HEALTH_RETRIES="${HEALTH_RETRIES:-0}"

UPGRADE_SCRIPT_URL="${UPGRADE_SCRIPT_URL:-https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh}"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   Secure AI Chat — Production Upgrade v4 (release v1.3.2)   ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "==> GIT_REF=${GIT_REF}  USE_BUILD_FRESH=${USE_BUILD_FRESH}  HEALTH_RETRIES=${HEALTH_RETRIES}"
echo "==> Underlying upgrade engine: ${UPGRADE_SCRIPT_URL}"
echo ""
echo "  Upgrade highlights (v1.3.2):"
echo "  • 13 Anthropic Claude models registered (Claude 5 / 4 / 3.7 / 3.5 / 3)"
echo "  • Default model: claude-sonnet-5-5"
echo "  • 200k context window for all claude-* model IDs"
echo "  • POST /api/lakera/results — Lakera Guard results proxy (session-gated)"
echo "  • RAG only for lookup questions (e.g. 'who is taking X'), not general ones"
echo "  • Lower Lakera usage: batched + de-duplicated scans; clear quota-exceeded message"
echo "  • GPT-5.x / o-series temperature error fixed"
echo "  • No app login required; the Settings PIN now guards replacing or deleting existing"
echo "    API keys, project IDs and endpoints (set a PIN in Settings if you have not yet)"
echo ""

curl -fsSL "${UPGRADE_SCRIPT_URL}" | bash -s -- "$@"
