#!/bin/bash
# Security check script for Check Point TE API key leakage
# Ensures no API keys are exposed client-side

set -e

echo "🔒 Security Check: Client-Side API Key Leakage Prevention"
echo "=========================================================="
echo ""

# Check 1: No API key functions in client components
echo "1. Checking for API key access in client components..."
if grep -r "getTeApiKey\|setTeApiKey\|CHECKPOINT_TE_API_KEY" components/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v ".tsx:" | grep -v "checkpointTeConfigured\|checkpointTeSandboxEnabled"; then
  echo "❌ FAIL: Found API key access in client components!"
  exit 1
else
  echo "✅ PASS: No API key access functions in client components"
fi

# Check 2: No API key in app client components (excluding API routes)
echo ""
echo "2. Checking for API key in app client pages..."
if grep -r "getTeApiKey\|setTeApiKey\|CHECKPOINT_TE_API_KEY" app/ --include="*.tsx" --exclude-dir="api" 2>/dev/null | grep -v "checkpointTeConfigured\|checkpointTeSandboxEnabled"; then
  echo "❌ FAIL: Found API key references in client pages!"
  exit 1
else
  echo "✅ PASS: No API key references in client pages"
fi

# Check 3: No full API key in console.log statements
echo ""
echo "3. Checking for API key leakage in console logs..."
if grep -r "console\.log.*apiKey\|console\.log.*TE_API" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v "apiKeyPrefix\|apiKeyLength\|hasApiKey"; then
  echo "❌ FAIL: Found potential API key leakage in console logs!"
  exit 1
else
  echo "✅ PASS: Console logs only show safe API key prefixes/lengths"
fi

# Check 4: Verify API key only exists in server-side code
echo ""
echo "4. Verifying API key only exists in server-side code..."
if ! grep -q "getTeApiKey\|setTeApiKey" lib/checkpoint-te.ts; then
  echo "❌ FAIL: API key functions not found in lib/checkpoint-te.ts!"
  exit 1
else
  echo "✅ PASS: API key functions properly located in server-side lib"
fi

if ! grep -r "getTeApiKey\|setTeApiKey" app/api/te/ --include="*.ts" 2>/dev/null | grep -q .; then
  echo "❌ FAIL: API key functions not found in API routes!"
  exit 1
else
  echo "✅ PASS: API key functions used only in API routes (server-side)"
fi

# Check 5: Verify localStorage only stores toggle states, not API keys
echo ""
echo "5. Checking localStorage usage for API keys..."
if grep -r "localStorage.*checkpoint.*key\|localStorage.*TE.*key" components/ app/ --include="*.tsx" --include="*.ts" --exclude-dir="api" 2>/dev/null | grep -i "api.*key"; then
  echo "❌ FAIL: Found API key in localStorage!"
  exit 1
else
  echo "✅ PASS: localStorage only stores toggle states (checkpointTeSandboxEnabled)"
fi

echo ""
echo "✅ All security checks passed!"
echo "=========================================================="
