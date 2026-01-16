#!/bin/bash
# Test script to validate installation script syntax and logic

echo "=== Testing Installation Script ==="
echo ""

SCRIPT="scripts/install-ubuntu-v1.0.11.sh"

# 1. Check if script exists
if [ ! -f "$SCRIPT" ]; then
    echo "❌ Script not found: $SCRIPT"
    exit 1
fi
echo "✅ Script exists"

# 2. Check syntax
echo ""
echo "Checking syntax..."
if bash -n "$SCRIPT" 2>&1; then
    echo "✅ Syntax check passed"
else
    echo "❌ Syntax errors found"
    bash -n "$SCRIPT"
    exit 1
fi

# 3. Check for common issues
echo ""
echo "Checking for common issues..."

# Check for unclosed braces
BRACE_COUNT=$(grep -o '{' "$SCRIPT" | wc -l)
CLOSE_BRACE_COUNT=$(grep -o '}' "$SCRIPT" | wc -l)
if [ "$BRACE_COUNT" -ne "$CLOSE_BRACE_COUNT" ]; then
    echo "❌ Unmatched braces: $BRACE_COUNT open, $CLOSE_BRACE_COUNT close"
    exit 1
fi
echo "✅ Braces matched"

# Check for unclosed if statements
IF_COUNT=$(grep -c "^if " "$SCRIPT" || echo "0")
FI_COUNT=$(grep -c "^fi" "$SCRIPT" || echo "0")
if [ "$IF_COUNT" -ne "$FI_COUNT" ]; then
    echo "⚠️  If/fi count mismatch: $IF_COUNT if, $FI_COUNT fi"
    echo "   (This may be normal if some if statements are on same line)"
else
    echo "✅ If/fi statements matched"
fi

# Check for shebang
if ! head -1 "$SCRIPT" | grep -q "^#!/bin/bash"; then
    echo "⚠️  Missing or incorrect shebang"
else
    echo "✅ Shebang present"
fi

# Check for set commands
if grep -q "set -e" "$SCRIPT"; then
    echo "✅ Error handling enabled (set -e)"
else
    echo "⚠️  No 'set -e' found"
fi

echo ""
echo "=== Test Complete ==="
echo "✅ Script appears to be valid"
