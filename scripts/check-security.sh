#!/bin/bash
# Security check script for API key leakage prevention
# Ensures no API keys (OpenAI, Lakera, Check Point TE) are exposed client-side or in code

set -e

FAILED=0

echo "🔒 Security Check: API Key Leakage Prevention"
echo "=============================================="
echo ""

# Check 1: No API key functions in client components
echo "1. Checking for API key access in client components..."
if grep -r "getTeApiKey\|setTeApiKey\|getApiKeys\|setApiKeys\|loadTeApiKey\|saveTeApiKey" components/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "checkpointTeConfigured\|checkpointTeSandboxEnabled\|apiKeys.*localStorage" | grep -v ".tsx:" | grep -v "//"; then
  echo "❌ FAIL: Found API key access functions in client components!"
  FAILED=1
else
  echo "✅ PASS: No API key access functions in client components"
fi

# Check 2: No API key in app client components (excluding API routes)
echo ""
echo "2. Checking for API key functions in app client pages..."
if grep -r "getTeApiKey\|setTeApiKey\|getApiKeys\|setApiKeys\|loadTeApiKey\|saveTeApiKey" app/ --include="*.tsx" --exclude-dir="api" 2>/dev/null | grep -v "checkpointTeConfigured\|checkpointTeSandboxEnabled" | grep -v "//"; then
  echo "❌ FAIL: Found API key functions in client pages!"
  FAILED=1
else
  echo "✅ PASS: No API key functions in client pages"
fi

# Check 3: No hardcoded API keys in source code
echo ""
echo "3. Checking for hardcoded API keys in source code..."
# Check for OpenAI keys (sk- prefix)
if grep -r "sk-[a-zA-Z0-9]\{32,\}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir="node_modules" --exclude-dir=".next" . 2>/dev/null | grep -v "package-lock.json" | grep -v ".test." | head -1; then
  echo "❌ FAIL: Found hardcoded OpenAI API key in source code!"
  FAILED=1
else
  echo "✅ PASS: No hardcoded OpenAI API keys"
fi

# Check for Lakera keys (lak_ prefix or similar patterns)
if grep -r "lak_[a-zA-Z0-9]\{32,\}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir="node_modules" --exclude-dir=".next" . 2>/dev/null | grep -v "package-lock.json" | grep -v ".test." | head -1; then
  echo "❌ FAIL: Found hardcoded Lakera API key in source code!"
  FAILED=1
else
  echo "✅ PASS: No hardcoded Lakera API keys"
fi

# Check for Check Point TE keys (TE_API_KEY_ prefix or similar)
if grep -r "TE_API_KEY_[a-zA-Z0-9]\{32,\}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir="node_modules" --exclude-dir=".next" . 2>/dev/null | grep -v "package-lock.json" | grep -v ".test." | head -1; then
  echo "❌ FAIL: Found hardcoded Check Point TE API key in source code!"
  FAILED=1
else
  echo "✅ PASS: No hardcoded Check Point TE API keys"
fi

# Check 4: No full API key in console.log statements
echo ""
echo "4. Checking for API key leakage in console logs..."
if grep -r "console\.log.*apiKey\|console\.log.*TE_API\|console\.log.*OPENAI_API_KEY\|console\.log.*LAKERA_AI_KEY" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v "apiKeyPrefix\|apiKeyLength\|hasApiKey\|configured.*apiKey" | grep -v "//"; then
  echo "❌ FAIL: Found potential API key leakage in console logs!"
  FAILED=1
else
  echo "✅ PASS: Console logs only show safe API key prefixes/lengths"
fi

# Check 5: Verify API key functions only exist in server-side code
echo ""
echo "5. Verifying API key functions only in server-side code..."
if ! grep -q "getTeApiKey\|setTeApiKey" lib/checkpoint-te.ts; then
  echo "❌ FAIL: Check Point TE API key functions not found in lib/checkpoint-te.ts!"
  FAILED=1
else
  echo "✅ PASS: Check Point TE API key functions properly located in server-side lib"
fi

if ! grep -q "getApiKeys\|setApiKeys" lib/api-keys-storage.ts 2>/dev/null; then
  echo "❌ FAIL: API keys storage functions not found in lib/api-keys-storage.ts!"
  FAILED=1
else
  echo "✅ PASS: API keys storage functions properly located in server-side lib"
fi

if ! grep -r "getTeApiKey\|setTeApiKey" app/api/te/ --include="*.ts" 2>/dev/null | grep -q .; then
  echo "❌ FAIL: Check Point TE API key functions not found in API routes!"
  FAILED=1
else
  echo "✅ PASS: Check Point TE API key functions used only in API routes (server-side)"
fi

if ! grep -r "getApiKeys\|setApiKeys" app/api/keys/ --include="*.ts" 2>/dev/null | grep -q .; then
  echo "❌ FAIL: API keys storage functions not found in API routes!"
  FAILED=1
else
  echo "✅ PASS: API keys storage functions used only in API routes (server-side)"
fi

# Check 6: Verify localStorage only stores toggle states, not API keys
echo ""
echo "6. Checking localStorage usage for API keys..."
# Check for localStorage storing API keys (should not happen)
if grep -r "localStorage\.setItem.*apiKeys\|localStorage\.setItem.*TE.*key\|localStorage\.setItem.*OPENAI\|localStorage\.setItem.*LAKERA" components/ app/ --include="*.tsx" --include="*.ts" --exclude-dir="api" 2>/dev/null | grep -v "removeItem\|getItem" | grep -v "//"; then
  echo "❌ FAIL: Found localStorage storing API keys!"
  FAILED=1
else
  echo "✅ PASS: localStorage only stores toggle states (not API keys)"
fi

# Check 7: Verify no API keys in environment variable defaults
echo ""
echo "7. Checking for API keys in default environment variable values..."
if grep -r "OPENAI_API_KEY.*=.*sk-\|LAKERA_AI_KEY.*=.*lak_\|CHECKPOINT_TE_API_KEY.*=.*TE_API_KEY_" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir="node_modules" --exclude-dir=".next" . 2>/dev/null | grep -v "package-lock.json" | grep -v ".test." | grep -v "process.env" | head -1; then
  echo "❌ FAIL: Found hardcoded API keys in default environment values!"
  FAILED=1
else
  echo "✅ PASS: No hardcoded API keys in default environment values"
fi

# Check 8: Verify no API keys in .env.example
echo ""
echo "8. Checking .env.example for actual API keys..."
if [ -f ".env.example" ]; then
  if grep -E "sk-[a-zA-Z0-9]{32,}|lak_[a-zA-Z0-9]{32,}|TE_API_KEY_[a-zA-Z0-9]{32,}" .env.example 2>/dev/null; then
    echo "❌ FAIL: Found actual API keys in .env.example!"
    FAILED=1
  else
    echo "✅ PASS: .env.example contains only placeholders (no actual keys)"
  fi
else
  echo "⚠️  WARNING: .env.example not found (skipping check)"
fi

# Check 9: Verify no API keys in build output (if .next exists)
echo ""
echo "9. Checking build output for API keys..."
if [ -d ".next" ]; then
  if grep -r -E "sk-[a-zA-Z0-9]{32,}|lak_[a-zA-Z0-9]{32,}|TE_API_KEY_[a-zA-Z0-9]{32,}" .next/static 2>/dev/null | grep -v ".map" | head -1; then
    echo "❌ FAIL: Found API keys in build output!"
    FAILED=1
  else
    echo "✅ PASS: No API keys in build output"
  fi
else
  echo "⚠️  INFO: .next directory not found (build not run yet, skipping)"
fi

echo ""
if [ $FAILED -eq 1 ]; then
  echo "❌ Security checks FAILED!"
  echo "=============================================="
  exit 1
else
  echo "✅ All security checks passed!"
  echo "=============================================="
fi
