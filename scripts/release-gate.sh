#!/usr/bin/env bash
set -euo pipefail

# =========================
# Release Gate (Strict) + Repo Update Helpers
# Target release branch: release/v1.0.5
# =========================

PASS=true
say() { printf "\n==> %s\n" "$*"; }
fail() { echo "❌ FAIL: $*"; PASS=false; }
ok() { echo "✅ PASS: $*"; }

# Show failing line on error (still honors PASS/FAIL blocks)
trap 'echo "❌ ERROR at line $LINENO"; exit 2' ERR

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

say "Release Gate starting in: $ROOT"

# --- Enhancement 1: repo sanity / informative context ---
if ! command -v git >/dev/null 2>&1; then
  echo "❌ FAIL: git not found"
  exit 2
fi
if [[ ! -f package.json ]]; then
  echo "❌ FAIL: package.json not found in repo root"
  exit 2
fi

# --- Enhancement 2: enforce clean working tree (strict) ---
if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌ FAIL: Working tree is not clean. Commit/stash changes before release."
  exit 2
fi
ok "Working tree clean"

# --- Enhancement 3: detect package manager from lockfiles (unchanged behavior) ---
PM=""
INSTALL_CMD=""
RUN_CMD=""
if [[ -f pnpm-lock.yaml ]]; then
  PM="pnpm"
  INSTALL_CMD="pnpm install --frozen-lockfile"
  RUN_CMD="pnpm"
elif [[ -f yarn.lock ]]; then
  PM="yarn"
  INSTALL_CMD="yarn install --immutable || yarn install --frozen-lockfile"
  RUN_CMD="yarn"
elif [[ -f package-lock.json ]]; then
  PM="npm"
  INSTALL_CMD="npm ci"
  RUN_CMD="npm"
else
  echo "❌ FAIL: No lockfile found (pnpm-lock.yaml/yarn.lock/package-lock.json)."
  exit 2
fi
ok "Detected package manager: ${PM}"

# --- Enhancement 4: ensure Node exists + print versions ---
if ! command -v node >/dev/null 2>&1; then
  echo "❌ FAIL: node not found"
  exit 2
fi
ok "Node: $(node -v) | PM: ${PM}"

# --- Enhancement 5: hard set release version + branch naming ---
TARGET_VERSION="1.0.5"
TARGET_BRANCH="release/v${TARGET_VERSION}"

# Update package.json version (only if needed) without blocking older npm
say "Set version -> ${TARGET_VERSION}"
CURRENT_VERSION="$(node -p "require('./package.json').version")"
if [[ "$CURRENT_VERSION" != "$TARGET_VERSION" ]]; then
  # npm version updates package.json + creates a git tag by default; avoid that.
  # We'll edit package.json directly to keep behavior predictable.
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    p.version = '${TARGET_VERSION}';
    fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
  "
  ok "package.json version updated ${CURRENT_VERSION} -> ${TARGET_VERSION}"
else
  ok "package.json already at ${TARGET_VERSION}"
fi

# --- Enhancement 6: update repo base branch then create/refresh release branch ---
say "Sync base branch and create ${TARGET_BRANCH}"
BASE_BRANCH="${BASE_BRANCH:-main}"

git fetch --all --prune

# Ensure base exists locally
if git show-ref --verify --quiet "refs/heads/${BASE_BRANCH}"; then
  git checkout "${BASE_BRANCH}"
else
  # Try to create it from origin if missing locally
  git checkout -b "${BASE_BRANCH}" "origin/${BASE_BRANCH}"
fi

git pull --ff-only origin "${BASE_BRANCH}"
ok "Base branch synced: ${BASE_BRANCH}"

# Create/update release branch off base
git checkout -B "${TARGET_BRANCH}" "${BASE_BRANCH}"
ok "On branch: ${TARGET_BRANCH}"

# Commit version bump if it changed
if [[ -n "$(git status --porcelain)" ]]; then
  git add package.json
  git commit -m "chore(release): bump version to ${TARGET_VERSION}"
  ok "Committed version bump"
else
  ok "No version bump commit needed"
fi

# Push release branch (updates GitHub branch with latest code)
say "Push to GitHub: ${TARGET_BRANCH}"
git push -u origin "${TARGET_BRANCH}"
ok "GitHub updated"

# =========================
# Release Gate checks
# =========================

# Clean install
say "Clean install"
if bash -lc "$INSTALL_CMD"; then ok "Install"; else fail "Install"; fi

# Lint
say "Lint"
if node -e "process.exit(require('./package.json').scripts?.lint?0:1)" 2>/dev/null; then
  if bash -lc "$RUN_CMD run lint"; then ok "Lint"; else fail "Lint"; fi
else
  echo "ℹ️  No lint script found; treating as FAIL (strict gate)."
  fail "Lint script missing"
fi

# Typecheck
say "Typecheck"
if node -e "process.exit(require('./package.json').scripts?.typecheck?0:1)" 2>/dev/null; then
  if bash -lc "$RUN_CMD run typecheck"; then ok "Typecheck"; else fail "Typecheck"; fi
else
  echo "ℹ️  No typecheck script found; treating as FAIL (strict gate)."
  fail "Typecheck script missing"
fi

# Tests (strict: if tests exist, must pass; if absent, PASS with note)
say "Tests"
if node -e "process.exit(require('./package.json').scripts?.test?0:1)" 2>/dev/null; then
  if bash -lc "$RUN_CMD run test"; then ok "Tests"; else fail "Tests"; fi
else
  echo "ℹ️  No test script found; PASS (no tests present)."
  ok "Tests (not present)"
fi

# Build
say "Build"
if node -e "process.exit(require('./package.json').scripts?.build?0:1)" 2>/dev/null; then
  if bash -lc "$RUN_CMD run build"; then ok "Build"; else fail "Build"; fi
else
  echo "ℹ️  No build script found; treating as FAIL (strict gate)."
  fail "Build script missing"
fi

# Secret leakage scan (repo + client bundle/output)
say "Secret scan"
if command -v gitleaks >/dev/null 2>&1; then
  if gitleaks detect --source . --no-git --redact --exit-code 1; then
    ok "Gitleaks repo scan"
  else
    fail "Gitleaks repo scan"
  fi

  OUT_DIR=""
  for d in .next dist build out; do
    if [[ -d "$d" ]]; then OUT_DIR="$d"; break; fi
  done

  if [[ -n "$OUT_DIR" ]]; then
    say "Secret scan output dir: $OUT_DIR"
    if gitleaks detect --source "$OUT_DIR" --no-git --redact --exit-code 1; then
      ok "Gitleaks output scan"
    else
      fail "Gitleaks output scan"
    fi
  else
    echo "ℹ️  No build output dir found (.next/dist/build/out). Skipping output scan."
    ok "Output scan (not applicable)"
  fi
else
  echo "❌ gitleaks not found. Install gitleaks to pass the release gate."
  fail "Secret scan tool missing (gitleaks)"
fi

# --- Enhancement 7: quick dependency vuln scan if tool exists (non-breaking) ---
say "Dependency audit (best-effort)"
if [[ "$PM" == "npm" ]]; then
  if npm audit --audit-level=high; then ok "npm audit"; else fail "npm audit"; fi
elif [[ "$PM" == "yarn" ]]; then
  echo "ℹ️  yarn audit varies by version; skipping by default."
  ok "yarn audit (skipped)"
elif [[ "$PM" == "pnpm" ]]; then
  if pnpm audit --audit-level high; then ok "pnpm audit"; else fail "pnpm audit"; fi
fi

# Final result
say "Release Gate result"
if [[ "$PASS" == "true" ]]; then
  echo "✅✅✅ RELEASE GATE: PASS"
  exit 0
else
  echo "❌❌❌ RELEASE GATE: FAIL"
  exit 1
fi
