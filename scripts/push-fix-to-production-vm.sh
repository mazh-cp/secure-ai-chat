#!/usr/bin/env bash
# Back-compat alias for scripts/upgrade-remote-production-vm.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/upgrade-remote-production-vm.sh" "$@"
