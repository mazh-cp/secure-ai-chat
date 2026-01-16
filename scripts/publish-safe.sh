#!/usr/bin/env bash
# Safe Publish Workflow - One Command to Publish Changes Safely
# Never pushes broken code to main, always runs Release Gate, prefers PR merge
#
# Usage:
#   ./scripts/publish-safe.sh              # Create/update PR (no tag)
#   ./scripts/publish-safe.sh --tag v1.0.12  # Create/update PR and tag after merge
#
# Prerequisites:
#   - Working git repository with remote 'origin'
#   - Current branch is NOT 'main' (must use feature branch)
#   - GitHub CLI (gh) installed for automatic PR creation (optional)

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; exit 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }
info() { echo "${CYAN}ℹ️  INFO:${NC} $*"; }

# Parse arguments
TAG_ARG=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --tag)
      TAG_ARG="$2"
      if [[ ! "$TAG_ARG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]; then
        fail "Tag must follow semantic versioning: vX.Y.Z (e.g., v1.0.12)"
      fi
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--tag vX.Y.Z]"
      echo ""
      echo "Safe Publish Workflow - One command to publish changes safely"
      echo ""
      echo "Options:"
      echo "  --tag vX.Y.Z    Create annotated tag after PR is merged (optional)"
      echo "  --help, -h      Show this help message"
      echo ""
      echo "Prerequisites:"
      echo "  - Working git repository with remote 'origin'"
      echo "  - Current branch is NOT 'main' (must use feature branch)"
      echo "  - GitHub CLI (gh) installed for automatic PR creation (optional)"
      echo ""
      exit 0
      ;;
    *)
      fail "Unknown option: $1. Use --help for usage."
      ;;
  esac
done

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Safe Publish Workflow                            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# Safety Checks
# ============================================
say "Safety Checks"

# Check git is available
if ! command -v git >/dev/null 2>&1; then
  fail "git not found"
fi
ok "git found"

# Check working tree is clean
if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  fail "Working tree is dirty (uncommitted changes). Commit or stash changes first."
fi
ok "Working tree is clean"

# Check current branch is NOT main
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  fail "Cannot run on '$CURRENT_BRANCH' branch. Create a feature branch first:\n  git checkout -b feature/your-change-name"
fi
ok "Current branch: $CURRENT_BRANCH (not main)"

# Check origin remote exists
if ! git remote get-url origin >/dev/null 2>&1; then
  fail "Remote 'origin' not found. Add it with:\n  git remote add origin <repo-url>"
fi
ORIGIN_URL=$(git remote get-url origin)
ok "Origin remote: $ORIGIN_URL"

# Check if branch has commits
if ! git rev-parse HEAD >/dev/null 2>&1; then
  fail "Current branch has no commits. Make at least one commit first."
fi
ok "Branch has commits"

# ============================================
# Release Gate (Local)
# ============================================
say "Running Release Gate (Local)"

if [ ! -f "$ROOT/scripts/release-gate.sh" ]; then
  fail "release-gate.sh not found at $ROOT/scripts/release-gate.sh"
fi

# Make release-gate.sh executable
chmod +x "$ROOT/scripts/release-gate.sh"

# Run release gate
say "Executing: ./scripts/release-gate.sh"
if bash "$ROOT/scripts/release-gate.sh"; then
  ok "Release gate passed"
else
  fail "Release gate FAILED. Fix issues before publishing."
fi

# ============================================
# Push Branch to Origin
# ============================================
say "Pushing Branch to Origin"

# Check if branch exists on origin
if git ls-remote --heads origin "$CURRENT_BRANCH" | grep -q "$CURRENT_BRANCH"; then
  warn "Branch '$CURRENT_BRANCH' already exists on origin. Pushing updates..."
  if git push origin "$CURRENT_BRANCH"; then
    ok "Branch pushed (updated)"
  else
    fail "Failed to push branch. Ensure you have push access."
  fi
else
  say "Branch '$CURRENT_BRANCH' does not exist on origin. Pushing..."
  if git push -u origin "$CURRENT_BRANCH"; then
    ok "Branch pushed (new)"
  else
    fail "Failed to push branch. Ensure you have push access."
  fi
fi

# ============================================
# Create/Update PR using GitHub CLI
# ============================================
say "Creating/Updating Pull Request"

# Check if GitHub CLI is available
if command -v gh >/dev/null 2>&1; then
  # Verify gh is authenticated
  if ! gh auth status >/dev/null 2>&1; then
    warn "GitHub CLI not authenticated. Run: gh auth login"
    info "Continuing with manual PR instructions..."
    HAS_GH=false
  else
    HAS_GH=true
    ok "GitHub CLI (gh) found and authenticated"
  fi
else
  HAS_GH=false
  warn "GitHub CLI (gh) not found. Install from: https://cli.github.com/"
  info "Continuing with manual PR instructions..."
fi

# Get repository name from origin URL
REPO_URL="${ORIGIN_URL}"
if [[ "$REPO_URL" =~ git@github.com:([^/]+)/([^/]+)(\.git)?$ ]]; then
  REPO_OWNER="${BASH_REMATCH[1]}"
  REPO_NAME="${BASH_REMATCH[2]%.git}"
elif [[ "$REPO_URL" =~ https://github.com/([^/]+)/([^/]+)(\.git)?$ ]]; then
  REPO_OWNER="${BASH_REMATCH[1]}"
  REPO_NAME="${BASH_REMATCH[2]%.git}"
else
  warn "Could not parse repository from origin URL: $REPO_URL"
  REPO_OWNER=""
  REPO_NAME=""
fi

if [ "$HAS_GH" = true ] && [ -n "$REPO_OWNER" ] && [ -n "$REPO_NAME" ]; then
  # Check if PR already exists for this branch
  EXISTING_PR=$(gh pr list --base main --head "$CURRENT_BRANCH" --json number,url,title,state --jq '.[0]' 2>/dev/null || echo "null")
  
  if [ "$EXISTING_PR" != "null" ] && [ -n "$EXISTING_PR" ]; then
    PR_NUMBER=$(echo "$EXISTING_PR" | jq -r '.number // empty' 2>/dev/null || echo "")
    PR_URL=$(echo "$EXISTING_PR" | jq -r '.url // empty' 2>/dev/null || echo "")
    PR_STATE=$(echo "$EXISTING_PR" | jq -r '.state // empty' 2>/dev/null || echo "")
    
    if [ -n "$PR_NUMBER" ] && [ "$PR_STATE" = "OPEN" ]; then
      ok "PR #$PR_NUMBER already exists: $PR_URL"
      info "PR will be updated automatically by the push"
      
      # Check if auto-merge is available
      if gh pr view "$PR_NUMBER" --json mergeable,mergeStateStatus 2>/dev/null | jq -e '.mergeable == true and .mergeStateStatus == "CLEAN"' >/dev/null 2>&1; then
        info "PR is mergeable and ready. You can enable auto-merge:"
        echo "  gh pr merge $PR_NUMBER --auto --squash"
      else
        info "Waiting for CI checks to pass. View PR: $PR_URL"
      fi
    elif [ "$PR_STATE" = "MERGED" ]; then
      ok "PR #$PR_NUMBER has already been merged"
      PR_MERGED=true
    else
      warn "PR exists but is in state: $PR_STATE"
      info "View PR: $PR_URL"
    fi
  else
    # Create new PR
    PR_TITLE="Release: $(git log -1 --pretty=%B | head -1 || echo "Changes from $CURRENT_BRANCH")"
    PR_BODY="## Changes

This PR was created automatically by the safe publish workflow.

### Release Gate Status
✅ All checks passed locally

### Branch
\`$CURRENT_BRANCH\`

### Latest Commit
$(git log -1 --pretty=format:"**%h** - %s%n%n%b" || echo "Unable to get commit details")

### Tagging
$([ -n "$TAG_ARG" ] && echo "Tag \`$TAG_ARG\` will be created after merge." || echo "No tag requested.")

---

**Note**: This PR requires the 'release-gate' GitHub Actions workflow to pass before merging."

    say "Creating PR: $PR_TITLE"
    if PR_OUTPUT=$(gh pr create --base main --head "$CURRENT_BRANCH" --title "$PR_TITLE" --body "$PR_BODY" 2>&1); then
      PR_URL=$(echo "$PR_OUTPUT" | grep -o 'https://github.com/[^ ]*' | head -1 || echo "")
      ok "PR created successfully"
      if [ -n "$PR_URL" ]; then
        info "PR URL: $PR_URL"
      fi
      
      # Show PR number if available
      PR_NUMBER=$(echo "$PR_OUTPUT" | grep -oP 'pull/\K[0-9]+' | head -1 || gh pr list --base main --head "$CURRENT_BRANCH" --json number --jq '.[0].number' 2>/dev/null || echo "")
      if [ -n "$PR_NUMBER" ]; then
        info "PR #$PR_NUMBER is ready for review"
        info "View PR: gh pr view $PR_NUMBER"
        info "To enable auto-merge after checks pass: gh pr merge $PR_NUMBER --auto --squash"
      fi
    else
      warn "Failed to create PR via GitHub CLI"
      echo "$PR_OUTPUT"
      HAS_GH=false  # Fall through to manual instructions
    fi
  fi
else
  # Manual PR instructions
  if [ -n "$REPO_OWNER" ] && [ -n "$REPO_NAME" ]; then
    PR_URL="https://github.com/$REPO_OWNER/$REPO_NAME/compare/main...$CURRENT_BRANCH?expand=1"
    info "Create PR manually:"
    echo ""
    echo "  $PR_URL"
    echo ""
    info "Or using GitHub CLI (if installed):"
    echo "  gh pr create --base main --head $CURRENT_BRANCH --title 'Release: <your-title>' --body '<description>'"
    echo ""
  else
    info "Create PR manually using your repository URL and branch: $CURRENT_BRANCH"
  fi
fi

# ============================================
# Tagging Instructions (if requested)
# ============================================
if [ -n "$TAG_ARG" ]; then
  say "Tagging Instructions"
  
  if [ "${PR_MERGED:-false}" = true ]; then
    warn "PR is already merged. You can create the tag now:"
    echo ""
    echo "  git checkout main"
    echo "  git pull origin main"
    echo "  git tag -a $TAG_ARG -m 'Release $TAG_ARG'"
    echo "  git push origin $TAG_ARG"
    echo ""
  else
    info "Tag '$TAG_ARG' will be created AFTER PR is merged."
    echo ""
    echo "After PR is merged, run:"
    echo "  git checkout main"
    echo "  git pull origin main"
    echo "  git tag -a $TAG_ARG -m 'Release $TAG_ARG'"
    echo "  git push origin $TAG_ARG"
    echo ""
    
    # Create a helper script for tagging after merge
    TAG_SCRIPT="$ROOT/.tag-after-merge-$TAG_ARG.sh"
    cat > "$TAG_SCRIPT" << EOF
#!/usr/bin/env bash
# Tag creation script for $TAG_ARG
# Run this after PR is merged

set -euo pipefail

git checkout main
git pull origin main
git tag -a $TAG_ARG -m "Release $TAG_ARG"
git push origin $TAG_ARG

echo "✅ Tag $TAG_ARG created and pushed"
EOF
    chmod +x "$TAG_SCRIPT"
    ok "Tagging script created: $TAG_SCRIPT"
    info "Run this script after PR is merged: bash $TAG_SCRIPT"
  fi
fi

# ============================================
# Summary
# ============================================
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  ✅ SAFE PUBLISH: COMPLETE                    ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Summary"
info "Branch: $CURRENT_BRANCH"
info "Status: Pushed to origin"
info "Release Gate: PASSED"

if [ "$HAS_GH" = true ] && [ -n "${PR_URL:-}" ]; then
  info "PR: $PR_URL"
  echo ""
  say "Next Steps"
  echo "  1. Wait for CI checks to pass (release-gate workflow)"
  echo "  2. Review and merge PR: $PR_URL"
  if [ -n "${PR_NUMBER:-}" ]; then
    echo "  3. (Optional) Enable auto-merge: gh pr merge $PR_NUMBER --auto --squash"
  fi
  if [ -n "$TAG_ARG" ]; then
    echo "  4. After merge, create tag: bash .tag-after-merge-$TAG_ARG.sh"
  fi
else
  echo ""
  say "Next Steps"
  echo "  1. Create PR manually (see URL above)"
  echo "  2. Wait for CI checks to pass"
  echo "  3. Review and merge PR"
  if [ -n "$TAG_ARG" ]; then
    echo "  4. After merge, create tag: bash .tag-after-merge-$TAG_ARG.sh"
  fi
fi
echo ""

exit 0
