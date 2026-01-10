#!/bin/bash
# Environment Variable Validation Script
# Validates that critical environment variables are set (warns, doesn't fail)
# Used for startup checks and documentation

set -euo pipefail

WARNINGS=0

echo "🔍 Checking environment variables..."
echo ""

# Check Node.js version
REQUIRED_NODE="25.2.1"
CURRENT_NODE=$(node -v | sed 's/v//')
if [ "$CURRENT_NODE" != "$REQUIRED_NODE" ]; then
    echo "⚠️  WARNING: Node.js version mismatch"
    echo "   Required: v${REQUIRED_NODE}"
    echo "   Current:  v${CURRENT_NODE}"
    echo "   Note: Application may still work, but recommended to use v${REQUIRED_NODE}"
    echo ""
    WARNINGS=$((WARNINGS + 1))
fi

# Check NODE_ENV
if [ -z "${NODE_ENV:-}" ]; then
    echo "ℹ️  INFO: NODE_ENV not set (defaults to 'production' in Docker/systemd)"
else
    echo "✅ NODE_ENV=${NODE_ENV}"
fi

# Check PORT
if [ -z "${PORT:-}" ]; then
    echo "ℹ️  INFO: PORT not set (defaults to 3000)"
else
    echo "✅ PORT=${PORT}"
fi

# Check HOSTNAME
if [ -z "${HOSTNAME:-}" ]; then
    echo "ℹ️  INFO: HOSTNAME not set (defaults to 0.0.0.0)"
else
    echo "✅ HOSTNAME=${HOSTNAME}"
fi

echo ""

# Optional API keys (warn if not set, but don't fail)
echo "📋 API Key Status (optional - can be configured via Settings UI):"

if [ -z "${OPENAI_API_KEY:-}" ]; then
    echo "   ⚠️  OPENAI_API_KEY not set (required for chat functionality)"
    echo "      Configure via Settings UI or set environment variable"
    WARNINGS=$((WARNINGS + 1))
else
    echo "   ✅ OPENAI_API_KEY is set"
fi

if [ -z "${LAKERA_AI_KEY:-}" ]; then
    echo "   ℹ️  LAKERA_AI_KEY not set (optional - for security scanning)"
else
    echo "   ✅ LAKERA_AI_KEY is set"
fi

if [ -z "${CHECKPOINT_TE_API_KEY:-}" ]; then
    echo "   ℹ️  CHECKPOINT_TE_API_KEY not set (optional - for file sandboxing)"
else
    echo "   ✅ CHECKPOINT_TE_API_KEY is set"
fi

echo ""

# Summary
if [ $WARNINGS -eq 0 ]; then
    echo "✅ Environment check passed (no critical warnings)"
    exit 0
else
    echo "⚠️  Environment check completed with ${WARNINGS} warning(s)"
    echo "   Application can still start, but some features may not work"
    echo "   Configure missing variables via Settings UI or environment variables"
    exit 0  # Don't fail - graceful degradation
fi