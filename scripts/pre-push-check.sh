#!/bin/bash
set -euo pipefail

echo "🔍 Pre-Push Verification Checklist"
echo "=================================="
echo ""

# Check Node.js version
echo "1️⃣  Checking Node.js version..."
NODE_VERSION=$(node -v)
if [ "$NODE_VERSION" = "v25.2.1" ]; then
    echo "   ✅ Node.js version: $NODE_VERSION"
else
    echo "   ❌ Node.js version mismatch: $NODE_VERSION (expected v25.2.1)"
    echo "   💡 Run: nvm install 25.2.1 && nvm use 25.2.1"
    exit 1
fi

# Check lint
echo ""
echo "2️⃣  Running lint..."
if npm run lint > /dev/null 2>&1; then
    echo "   ✅ Lint passed"
else
    echo "   ❌ Lint failed"
    npm run lint
    exit 1
fi

# Check build
echo ""
echo "3️⃣  Running build..."
if npm run build > /dev/null 2>&1; then
    echo "   ✅ Build passed"
else
    echo "   ❌ Build failed"
    npm run build
    exit 1
fi

# Check theme files
echo ""
echo "4️⃣  Checking theme components..."
if [ -f "components/ThemeScript.tsx" ] && \
   [ -f "components/ThemeInit.tsx" ] && \
   [ -f "components/ThemeToggleButton.tsx" ]; then
    echo "   ✅ Theme components exist"
else
    echo "   ❌ Missing theme components"
    exit 1
fi

# Check layout includes theme components
echo ""
echo "5️⃣  Checking layout includes theme components..."
if grep -q "ThemeScript" app/layout.tsx && \
   grep -q "ThemeInit" app/layout.tsx && \
   grep -q "ThemeToggleButton" components/Layout.tsx; then
    echo "   ✅ Theme components integrated"
else
    echo "   ❌ Theme components not properly integrated"
    exit 1
fi

echo ""
echo "✨ All automated checks passed!"
echo ""
echo "⚠️  Manual checks required:"
echo "   - Theme toggle works in browser"
echo "   - Theme persists after refresh"
echo "   - Theme persists after server restart"
echo "   - No console errors"
echo ""
echo "✅ Ready to push!"
