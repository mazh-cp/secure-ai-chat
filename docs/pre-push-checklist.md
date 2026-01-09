# Pre-Push Verification Checklist

**IMPORTANT**: Run these checks before pushing to the repository to ensure deployment will succeed.

## Required Checks

### 1. Node.js Version Check

```bash
node -v
```

**Expected**: `v25.2.1`

**If incorrect**:
```bash
# Install nvm if not installed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Install and use Node.js v25.2.1
nvm install 25.2.1
nvm use 25.2.1
```

**Status**: ⬜ Pass / ⬜ Fail

---

### 2. Lint Check

```bash
npm run lint
```

**Expected**: `✔ No ESLint warnings or errors`

**Status**: ⬜ Pass / ⬜ Fail

---

### 3. Build Check

```bash
npm run build
```

**Expected**: Build completes successfully with no errors

**Status**: ⬜ Pass / ⬜ Fail

---

### 4. Theme Toggle Functionality

1. Start dev server: `npm run dev`
2. Open browser: `http://localhost:3000`
3. Click theme toggle button (top-left in header)
4. Verify theme switches between Day and Night modes
5. Refresh page - theme should persist
6. Check browser console for errors

**Expected**: 
- Theme toggle works
- Theme persists after refresh
- No console errors

**Status**: ⬜ Pass / ⬜ Fail

---

### 5. Theme Components Verification

Verify these files exist and are correct:

- [ ] `components/ThemeScript.tsx` exists
- [ ] `components/ThemeInit.tsx` exists
- [ ] `components/ThemeToggleButton.tsx` exists
- [ ] `app/layout.tsx` includes `<ThemeScript />` in `<head>`
- [ ] `app/layout.tsx` includes `<ThemeInit />` in `<body>`
- [ ] `components/Layout.tsx` includes `<ThemeToggleButton />` in header

**Status**: ⬜ Pass / ⬜ Fail

---

### 6. Restart-Proof Theme Check

1. Set theme to "Day" mode
2. Stop dev server (Ctrl+C)
3. Restart dev server: `npm run dev`
4. Reload page
5. Verify theme is still "Day" (no flash of wrong theme)

**Expected**: Theme persists after server restart

**Status**: ⬜ Pass / ⬜ Fail

---

## Quick Verification Script

Run this script to check most items automatically:

```bash
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
    exit 1
fi

# Check lint
echo ""
echo "2️⃣  Running lint..."
if npm run lint > /dev/null 2>&1; then
    echo "   ✅ Lint passed"
else
    echo "   ❌ Lint failed"
    exit 1
fi

# Check build
echo ""
echo "3️⃣  Running build..."
if npm run build > /dev/null 2>&1; then
    echo "   ✅ Build passed"
else
    echo "   ❌ Build failed"
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
```

Save as `scripts/pre-push-check.sh` and run:
```bash
chmod +x scripts/pre-push-check.sh
./scripts/pre-push-check.sh
```

## All Checks Must Pass

**Do not push** if any check fails. Fix the issues first, then re-run the checklist.

## After All Checks Pass

1. Commit changes: `git commit -m "Your commit message"`
2. Push to repository: `git push origin main`
3. Deploy using steps in `docs/deploy.md`
