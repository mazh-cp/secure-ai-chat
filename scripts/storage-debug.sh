#!/usr/bin/env bash
# Storage persistence verification: store a test file, list, then call debug/storage.
# Uses a cookie jar so owner_id is consistent across requests.
# Requires server at BASE_URL (e.g. npm run start).

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT
FILE_ID="storage-debug-$(date +%s)-$$"

echo "=== 1. GET /api/owner (establish owner_id cookie) ==="
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/owner" | head -c 200
echo ""

echo ""
echo "=== 2. POST /api/files/store (upload test file) ==="
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE_URL/api/files/store" \
  -H "Content-Type: application/json" \
  -d "{\"fileId\":\"$FILE_ID\",\"fileName\":\"debug.txt\",\"fileContent\":\"Storage debug test content.\",\"fileType\":\"text/plain\",\"fileSize\":28,\"scanStatus\":\"pending\"}" | jq . 2>/dev/null || cat

echo ""
echo "=== 3. GET /api/files/list ==="
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/files/list" | jq . 2>/dev/null || cat

echo ""
echo "=== 4. GET /api/debug/storage ==="
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/debug/storage" | jq . 2>/dev/null || cat

echo ""
echo "Done. Check that debug/storage shows filesOnDiskForOwner and registryCount/registryFirstFileIds."
