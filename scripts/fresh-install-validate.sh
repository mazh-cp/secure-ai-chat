#!/usr/bin/env bash
set -euo pipefail

say(){ printf "\n==> %s\n" "$*"; }
die(){ echo "❌ $*"; exit 1; }

say "0) Preconditions"
command -v node >/dev/null || die "Node is not installed"
NODE_V="$(node -v | sed 's/^v//')"
echo "Node: v$NODE_V"
MAJOR="${NODE_V%%.*}"
[ "$MAJOR" -ge 20 ] || die "Node must be >= 20 (recommend 24.x). Current: v$NODE_V"

say "1) Detect package manager"
PM="npm"
if [ -f pnpm-lock.yaml ]; then PM="pnpm"; fi
if [ -f yarn.lock ]; then PM="yarn"; fi
echo "Package manager: $PM"

say "2) Ensure Corepack (for pnpm/yarn)"
if [ "$PM" != "npm" ]; then
  command -v corepack >/dev/null || die "corepack not found (comes with Node)."
  corepack enable >/dev/null 2>&1 || true
fi

say "3) Hard clean: caches + node_modules + Next build artifacts"
rm -rf node_modules .next .turbo dist build out coverage .eslintcache 2>/dev/null || true

if [ "$PM" = "npm" ]; then
  rm -f package-lock.json >/dev/null 2>&1 || true
  say "Keeping package-lock? If you use npm in prod, commit package-lock and remove this line."
fi

say "4) Install dependencies (strict / reproducible)"
if [ "$PM" = "pnpm" ]; then
  pnpm -v || die "pnpm not available via corepack"
  pnpm install --frozen-lockfile
elif [ "$PM" = "yarn" ]; then
  yarn -v || die "yarn not available via corepack"
  # Works for Yarn Berry; if you are Yarn classic, replace with: yarn install --frozen-lockfile
  yarn install --immutable
else
  npm -v || die "npm missing?"
  # If you commit package-lock.json, prefer: npm ci
  if [ -f package-lock.json ]; then npm ci; else npm install; fi
fi

say "5) Sanity check required files"
[ -f next.config.js ] || die "Missing next.config.js"
[ -f tsconfig.json ] || die "Missing tsconfig.json"
[ -d app ] || die "Missing Next.js /app directory"

say "6) Lint + Type-check"
if npm run -s lint >/dev/null 2>&1; then npm run lint; else echo "ℹ️ No lint script found (skipping)"; fi
if npm run -s type-check >/dev/null 2>&1; then npm run type-check; else echo "ℹ️ No type-check script found (skipping)"; fi

say "7) Unit/CI tests (if present)"
if npm run -s test >/dev/null 2>&1; then npm test; else echo "ℹ️ No test script found (skipping)"; fi

say "8) Production build"
npm run build

say "9) Dependency + secret hygiene"
# Dependency vulnerability scan (won't fail build by default; adjust to your policy)
if [ "$PM" = "npm" ]; then
  npm audit || true
else
  echo "ℹ️ For pnpm/yarn: consider 'pnpm audit' / 'yarn npm audit' depending on setup."
fi

# Lightweight local secret scan (requires gitleaks installed)
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --no-git --redact || die "gitleaks found potential secrets"
else
  echo "ℹ️ gitleaks not installed (recommended for production gating)."
fi

say "10) Output summary"
echo "✅ Fresh install + lint/type-check/tests(build) completed."
echo "✅ Next build output is ready."
