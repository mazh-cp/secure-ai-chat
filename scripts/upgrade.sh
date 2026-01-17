#!/usr/bin/env bash
# Unified Upgrade Script - Idempotent In-Place Upgrade with Rollback
# Wrapper around upgrade-production-remote.sh for stability hardening
#
# Usage: bash scripts/upgrade.sh [--app-dir /path/to/app] [--ref main]
#
# This script ensures:
# - Automatic backup before upgrade
# - npm ci for reproducible builds
# - Storage migrations run
# - Automatic rollback on failure
# - Health checks after upgrade

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Forward all arguments to upgrade-production-remote.sh
exec bash "$SCRIPT_DIR/upgrade-production-remote.sh" "$@"
