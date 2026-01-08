#!/bin/bash

# Automated GitHub upload script for Secure AI Chat
# Usage: ./scripts/push-to-github.sh [commit-message]

set -euo pipefail

# Configuration
REPO_URL="https://github.com/mazh-cp/secure-ai-chat.git"
BRANCH="main"
COMMIT_MESSAGE="${1:-Update}"
CURRENT_YEAR=$(date +%Y)
OWNER="mazh-cp"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 GitHub Upload Script for Secure AI Chat"
echo "=========================================="
echo ""

# Validate we're in the project root
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found. Please run this script from the project root."
  exit 1
fi

echo "✅ Project root validated"
echo ""

# Ensure LICENSE exists and is MIT
if [ ! -f "LICENSE" ]; then
  echo "📝 Creating LICENSE file..."
  cat > LICENSE << EOF
MIT License

Copyright (c) ${CURRENT_YEAR} ${OWNER}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
  echo "✅ LICENSE created"
else
  # Verify it's MIT license
  if ! grep -q "MIT License" LICENSE; then
    echo "⚠️  Warning: LICENSE exists but doesn't appear to be MIT. Please verify manually."
  else
    echo "✅ LICENSE exists and is MIT"
  fi
fi
echo ""

# Ensure .gitignore contains required patterns
REQUIRED_IGNORES=(
  "node_modules"
  ".next"
  "dist"
  "build"
  "coverage"
  ".env"
  ".env.*"
  ".env.local"
  ".DS_Store"
)

echo "📋 Checking .gitignore..."
if [ ! -f ".gitignore" ]; then
  echo "Creating .gitignore..."
  touch .gitignore
fi

MISSING_IGNORES=()
for ignore in "${REQUIRED_IGNORES[@]}"; do
  # Escape special characters for grep
  escaped_ignore=$(printf '%s\n' "$ignore" | sed 's/[[\.*^$()+?{|]/\\&/g')
  # Check for pattern with or without leading slash, with or without trailing slash
  if ! grep -qE "^/?${escaped_ignore}(/|$)" .gitignore && ! grep -qE "^${escaped_ignore}$" .gitignore; then
    MISSING_IGNORES+=("$ignore")
  fi
done

if [ ${#MISSING_IGNORES[@]} -gt 0 ]; then
  echo "Adding missing patterns to .gitignore..."
  for ignore in "${MISSING_IGNORES[@]}"; do
    echo "$ignore" >> .gitignore
    echo "  + $ignore"
  done
  echo "✅ .gitignore updated"
else
  echo "✅ .gitignore contains all required patterns"
fi
echo ""

# Remove tracked env files from git index (if git is initialized)
if [ -d ".git" ]; then
  echo "🧹 Removing tracked .env files from git index..."
  git rm -r --cached .env .env.* .env.local 2>/dev/null || true
  echo "✅ Cleaned up tracked env files"
  echo ""
fi

# Initialize git if .git doesn't exist
if [ ! -d ".git" ]; then
  echo "📦 Initializing git repository..."
  git init
  echo "✅ Git repository initialized"
  echo ""
fi

# Ensure branch is main (rename if needed)
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [ -z "$CURRENT_BRANCH" ]; then
  # No commits yet, create main branch
  git checkout -b "$BRANCH" 2>/dev/null || true
  echo "✅ Created branch: $BRANCH"
elif [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "🔄 Renaming branch from '$CURRENT_BRANCH' to '$BRANCH'..."
  git branch -m "$BRANCH"
  echo "✅ Branch renamed to: $BRANCH"
else
  echo "✅ Already on branch: $BRANCH"
fi
echo ""

# Ensure origin remote exists and points to the repo URL
if git remote | grep -q "^origin$"; then
  CURRENT_URL=$(git remote get-url origin 2>/dev/null || echo "")
  if [ "$CURRENT_URL" != "$REPO_URL" ]; then
    echo "🔄 Updating origin remote URL..."
    git remote set-url origin "$REPO_URL"
    echo "✅ Origin remote updated"
  else
    echo "✅ Origin remote is correctly configured"
  fi
else
  echo "➕ Adding origin remote..."
  git remote add origin "$REPO_URL"
  echo "✅ Origin remote added"
fi
echo ""

# Stage all changes
echo "📝 Staging all changes..."
git add -A
echo "✅ All changes staged"
echo ""

# Check if there are changes to commit
if git diff --staged --quiet; then
  echo "ℹ️  No changes to commit"
else
  # Commit with message
  echo "💾 Committing changes..."
  git commit -m "$COMMIT_MESSAGE"
  echo "✅ Changes committed: $COMMIT_MESSAGE"
  echo ""
fi

# Push with upstream
echo "🚀 Pushing to GitHub..."
if git push -u origin "$BRANCH" 2>&1; then
  echo ""
  echo -e "${GREEN}✅ Success!${NC}"
  echo ""
  echo -e "${GREEN}Repository URL:${NC} $REPO_URL"
  echo -e "${GREEN}Branch:${NC} $BRANCH"
  echo ""
  echo "View your repository at:"
  echo "  https://github.com/mazh-cp/secure-ai-chat"
else
  echo ""
  echo -e "${YELLOW}⚠️  Push completed with warnings or errors.${NC}"
  echo "If this is the first push, you may need to:"
  echo "  1. Create the repository on GitHub first"
  echo "  2. Or use: git push -u origin $BRANCH --force (if you're sure)"
  exit 1
fi
