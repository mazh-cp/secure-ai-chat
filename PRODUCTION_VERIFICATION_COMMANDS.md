# Production VM Verification Commands

## 🔍 Verify if Production VM has Latest Code

Run these commands on your production VM to check if it has the latest code:

### Quick Verification (One Command)

```bash
cd /home/adminuser/secure-ai-chat && \
echo "=== GIT STATUS ===" && \
git fetch origin && \
echo "Current branch: $(git branch --show-current)" && \
echo "Current commit: $(git rev-parse HEAD)" && \
echo "Latest remote commit: $(git rev-parse origin/release/v1.0.5-new)" && \
echo "" && \
echo "=== VERSION CHECK ===" && \
echo "package.json version: $(node -p "require('./package.json').version")" && \
echo "" && \
echo "=== FILE VERIFICATION ===" && \
if [ -f "app/api/version/route.ts" ]; then echo "✅ Version API route exists"; else echo "❌ Version API route MISSING"; fi && \
echo "" && \
echo "=== COMPARISON ===" && \
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/release/v1.0.5-new)" ]; then echo "✅ Production is UP TO DATE"; else echo "❌ Production is OUT OF DATE - Run upgrade command"; fi
```

---

### Detailed Verification (Step-by-Step)

```bash
# Step 1: Navigate to repository
cd /home/adminuser/secure-ai-chat

# Step 2: Fetch latest from GitHub
git fetch origin

# Step 3: Check current branch
echo "Current branch:"
git branch --show-current

# Step 4: Check current commit
echo ""
echo "Current commit hash:"
git rev-parse HEAD

# Step 5: Check latest remote commit
echo ""
echo "Latest remote commit hash:"
git rev-parse origin/release/v1.0.5-new

# Step 6: Compare commits
echo ""
echo "Commit comparison:"
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/release/v1.0.5-new)" ]; then
  echo "✅ Production is UP TO DATE"
else
  echo "❌ Production is OUT OF DATE"
  echo ""
  echo "Commits behind:"
  git rev-list --count HEAD..origin/release/v1.0.5-new
  echo ""
  echo "Missing commits:"
  git log --oneline HEAD..origin/release/v1.0.5-new
fi

# Step 7: Check version in package.json
echo ""
echo "=== VERSION CHECK ==="
echo "package.json version:"
node -p "require('./package.json').version"

# Step 8: Check if version API route exists
echo ""
echo "=== FILE VERIFICATION ==="
if [ -f "app/api/version/route.ts" ]; then
  echo "✅ Version API route exists"
  echo "File content preview:"
  head -5 app/api/version/route.ts
else
  echo "❌ Version API route MISSING - This file should exist!"
fi

# Step 9: Check Layout.tsx for dynamic version
echo ""
if grep -q "appVersion" components/Layout.tsx 2>/dev/null; then
  echo "✅ Layout.tsx has dynamic version (appVersion)"
else
  echo "❌ Layout.tsx missing dynamic version - Still using hardcoded version"
fi

# Step 10: Check running service
echo ""
echo "=== SERVICE STATUS ==="
sudo systemctl status secure-ai-chat --no-pager | head -10
```

---

### API Endpoint Verification

```bash
# Check if version API endpoint is working
echo "=== API ENDPOINT CHECK ==="
curl -s http://localhost:3000/api/version | jq . || curl -s http://localhost:3000/api/version

# Check health endpoint
echo ""
echo "=== HEALTH CHECK ==="
curl -s http://localhost:3000/api/health | jq . || curl -s http://localhost:3000/api/health
```

---

### Complete Verification Script

Save this as `verify-production.sh` on your VM:

```bash
#!/bin/bash
set -e

REPO_DIR="/home/adminuser/secure-ai-chat"
cd "$REPO_DIR"

echo "═══════════════════════════════════════════════════════════════════"
echo "🔍 PRODUCTION CODE VERIFICATION"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Fetch latest
echo "📥 Fetching latest from GitHub..."
git fetch origin > /dev/null 2>&1

# Get commit hashes
CURRENT_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/release/v1.0.5-new)
CURRENT_BRANCH=$(git branch --show-current)

echo "📍 Current Branch: $CURRENT_BRANCH"
echo "📍 Current Commit: ${CURRENT_COMMIT:0:7}"
echo "📍 Remote Commit:  ${REMOTE_COMMIT:0:7}"
echo ""

# Compare
if [ "$CURRENT_COMMIT" = "$REMOTE_COMMIT" ]; then
  echo "✅ Production is UP TO DATE"
  STATUS="UP_TO_DATE"
else
  echo "❌ Production is OUT OF DATE"
  BEHIND=$(git rev-list --count HEAD..origin/release/v1.0.5-new)
  echo "   Behind by $BEHIND commit(s)"
  STATUS="OUT_OF_DATE"
fi

echo ""
echo "───────────────────────────────────────────────────────────────────"
echo "📦 VERSION INFORMATION"
echo "───────────────────────────────────────────────────────────────────"

# Check package.json version
PKG_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
echo "package.json version: $PKG_VERSION"

# Check if version API route exists
if [ -f "app/api/version/route.ts" ]; then
  echo "✅ Version API route: EXISTS"
else
  echo "❌ Version API route: MISSING"
fi

# Check Layout.tsx
if grep -q "appVersion" components/Layout.tsx 2>/dev/null; then
  echo "✅ Layout.tsx: Has dynamic version"
else
  echo "❌ Layout.tsx: Missing dynamic version"
fi

echo ""
echo "───────────────────────────────────────────────────────────────────"
echo "🌐 API ENDPOINT CHECK"
echo "───────────────────────────────────────────────────────────────────"

# Check version API
VERSION_API=$(curl -s http://localhost:3000/api/version 2>/dev/null || echo "ERROR")
if echo "$VERSION_API" | grep -q "version"; then
  echo "✅ Version API: Working"
  echo "$VERSION_API" | jq . 2>/dev/null || echo "$VERSION_API"
else
  echo "❌ Version API: Not responding or error"
fi

echo ""
echo "───────────────────────────────────────────────────────────────────"
echo "📋 RECOMMENDATION"
echo "───────────────────────────────────────────────────────────────────"

if [ "$STATUS" = "OUT_OF_DATE" ]; then
  echo "❌ Production needs upgrade!"
  echo ""
  echo "Run this command to upgrade:"
  echo "cd $REPO_DIR && git pull origin release/v1.0.5-new && npm ci && npm run build && sudo systemctl restart secure-ai-chat"
else
  echo "✅ Production is up to date!"
  echo ""
  echo "If version still not showing correctly:"
  echo "1. Clear browser cache"
  echo "2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)"
  echo "3. Check browser console for errors"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════"
```

---

## Quick Reference

**One-liner to check if up to date:**
```bash
cd /home/adminuser/secure-ai-chat && git fetch origin && [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/release/v1.0.5-new)" ] && echo "✅ UP TO DATE" || echo "❌ OUT OF DATE"
```

**Check version API:**
```bash
curl http://localhost:3000/api/version
```

**Check if version route exists:**
```bash
test -f /home/adminuser/secure-ai-chat/app/api/version/route.ts && echo "✅ EXISTS" || echo "❌ MISSING"
```

---

**Last Updated:** January 2026
