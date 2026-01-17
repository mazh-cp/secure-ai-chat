#!/usr/bin/env bash
# Unified Installation Script - Idempotent Fresh Install
# Wrapper around install-production-ubuntu.sh for stability hardening
#
# Usage: bash scripts/install.sh [--app-dir /path/to/app] [--app-user username]
#
# This script ensures:
# - Node.js 24.13.0 is installed
# - npm ci for reproducible builds
# - Storage migrations run
# - Systemd service configured
# - Health checks pass

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Forward all arguments to install-production-ubuntu.sh
exec bash "$SCRIPT_DIR/install-production-ubuntu.sh" "$@"
