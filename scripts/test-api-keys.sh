#!/bin/bash
# Test script to verify API keys are stored and retrievable

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "Testing API Keys Storage..."
echo ""

# Check if keys file exists
if [ -f ".secure-storage/api-keys.enc" ]; then
    FILE_SIZE=$(stat -f%z .secure-storage/api-keys.enc 2>/dev/null || stat -c%s .secure-storage/api-keys.enc 2>/dev/null || echo "0")
    echo "✅ Keys file exists (${FILE_SIZE} bytes)"
else
    echo "❌ Keys file does not exist"
    echo "   Please save your keys in Settings page first"
    exit 1
fi

# Test server endpoint
echo ""
echo "Testing server endpoint..."
KEYS_STATUS=$(curl -sf http://localhost:3000/api/keys 2>/dev/null || echo "{}")
echo "$KEYS_STATUS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    configured = data.get('configured', {})
    print('Configuration Status:')
    print(f'  OpenAI Key: {\"✅ Configured\" if configured.get(\"openAiKey\") else \"❌ Not configured\"}')
    print(f'  Azure OpenAI Key: {\"✅ Configured\" if configured.get(\"azureOpenAiKey\") else \"❌ Not configured\"}')
    print(f'  Azure OpenAI Endpoint: {\"✅ Configured\" if configured.get(\"azureOpenAiEndpoint\") else \"❌ Not configured\"}')
except Exception as e:
    print(f'Error: {e}')
"

echo ""
echo "If keys show as configured but chat still fails, the issue may be:"
echo "  1. Keys file corruption - try re-saving keys in Settings"
echo "  2. Cache issue - restart the server"
echo "  3. Encryption key mismatch - check environment variables"
echo ""
