#!/usr/bin/env bash
# Guard: fail CI if any file changed vs v1.0.11-freeze is outside file/RAG/security paths.
# Ensures post-freeze work is restricted to file upload/list/delete, RAG, and security.
# Usage: run from repo root; requires tag v1.0.11-freeze to exist (create once: git tag v1.0.11-freeze <commit-before-2026-01-19>).

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

FREEZE_TAG="${FREEZE_TAG:-v1.0.11-freeze}"
COMPARE_REF="${1:-HEAD}"   # Compare freeze to this ref (default HEAD)

# Allowed path prefixes (one per line). Only these may change vs freeze.
# Add new paths here when intentionally expanding scope (file/RAG/security only).
ALLOWED_PREFIXES=(
  'app/api/files/'
  'app/api/chat/'
  'app/api/scan/'
  'app/api/health/'
  'app/api/version/'
  'app/files/'
  'lib/registry/'
  'lib/rag/'
  'lib/storage/'
  'lib/security/'
  'lib/files/'
  'lib/persistent-storage.ts'
  'lib/file-content-processor.ts'
  'lib/policies/'
  'components/FileList.tsx'
  'components/FileUploader.tsx'
  'types/files.ts'
  'scripts/guard-prejan19.sh'
  'scripts/smoke-file-rag-stability.sh'
  'scripts/fresh-local-validate.sh'
  'scripts/clean-local.sh'
  'scripts/fresh-setup-1.0.12.sh'
  'scripts/smoke-rag-pipeline.sh'
  'app/page.tsx'
  'lib/app-release.ts'
  'docs/'
  'README.md'
  'package.json'
  'CHANGELOG.md'
  '.github/workflows/ci.yml'
)

if ! git rev-parse "$FREEZE_TAG" &>/dev/null; then
  echo -e "${RED}Guard: tag $FREEZE_TAG not found. Create it from the last commit before 2026-01-19, e.g.:${NC}"
  echo "  git tag v1.0.11-freeze \$(git rev-list -n1 --before='2026-01-19' HEAD)"
  exit 1
fi

CHANGED="$(git diff --name-only "$FREEZE_TAG" "$COMPARE_REF" 2>/dev/null || true)"
if [ -z "$CHANGED" ]; then
  echo -e "${GREEN}Guard: no files changed vs $FREEZE_TAG. OK.${NC}"
  exit 0
fi

FAILED=0
while IFS= read -r path; do
  [ -z "$path" ] && continue
  allowed=0
  for prefix in "${ALLOWED_PREFIXES[@]}"; do
    if [[ "$path" == "$prefix"* ]] || [[ "$path" == "$prefix" ]]; then
      allowed=1
      break
    fi
  done
  if [ "$allowed" -eq 0 ]; then
    echo -e "${RED}Guard: disallowed change (not under file/RAG/security): $path${NC}"
    FAILED=1
  fi
done <<< "$CHANGED"

if [ "$FAILED" -eq 1 ]; then
  echo ""
  echo -e "${RED}CI guard failed: only file/RAG/security paths may change vs $FREEZE_TAG.${NC}"
  echo "Allowed prefixes: app/api/files/, app/api/chat/, app/api/scan/, app/api/health/, app/api/version/, app/files/, lib/registry/, lib/rag/, lib/storage/, lib/security/, lib/files/, lib/persistent-storage.ts, lib/file-content-processor.ts, lib/policies/, components/FileList.tsx, components/FileUploader.tsx, types/files.ts, scripts/guard-prejan19.sh, scripts/smoke-*.sh (RAG), docs/, package.json, CHANGELOG.md."
  exit 1
fi

echo -e "${GREEN}Guard: all changed files are under allowed file/RAG/security paths. OK.${NC}"
exit 0
