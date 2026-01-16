# Release Gate - Pre-Deployment Validation

This document defines the strict checklist that **must pass** before any deployment to production.

## Quick Start

Run the automated release gate:

```bash
npm run release-gate
# or
./scripts/release-gate.sh
```

## Release Gate Checklist

### ✅ Phase 0: Repository Sanity

- [ ] `package.json` exists
- [ ] `.gitignore` includes `.secure-storage`
- [ ] Git repository is clean (or changes are committed)

### ✅ Phase A: Correctness (Must be Green)

- [ ] **TypeScript Type Check**: `npm run typecheck` passes
- [ ] **ESLint Check**: `npm run lint` passes (warnings allowed, errors fail)
- [ ] **Runtime Errors**: No runtime errors in Settings or File toggle features
- [ ] **Backwards Compatibility**: Older settings objects work with safe defaults

### ✅ Phase B: Security Hard Gates (ThreatCloud Key Must NEVER Hit Client)

- [ ] **Server-Only Module Guard**: `lib/checkpoint-te.ts` has client-side import guard
- [ ] **No Client Imports**: Automated check passes (`npm run check:secrets`)
- [ ] **No localStorage Secrets**: No API keys in localStorage/sessionStorage
- [ ] **No Build Leakage**: No secrets in `.next/static` build output
- [ ] **Log Redaction**: Authorization headers and API keys are redacted in logs

### ✅ Phase C: Build & Tests

- [ ] **Clean Install**: `npm ci` succeeds
- [ ] **Production Build**: `npm run build` succeeds
- [ ] **Tests** (if configured): All tests pass
- [ ] **Smoke Tests**: `npm run smoke` passes (if available)

### ✅ Phase D: v1.0.10 Feature Validation

- [ ] **v1.0.10 Features Intact**: `npm run validate:v1.0.10` passes
  - Enhanced RAG System (automatic file indexing, content search)
  - File size/count limits (10MB, 5 files)
  - Content matching algorithm
  - File access control (inclusive filtering)
  - LLM instructions about files
  - Support for CSV, JSON, TXT files

### ✅ Phase E: Secret Leakage Scan

- [ ] **Client Code Scan**: `npm run check:secrets` passes
- [ ] **Build Output Scan**: No secrets in `.next/static`
- [ ] **Git History Scan**: No secrets in tracked source files

## Canonical Commands

### Development

```bash
npm run dev          # Start development server (0.0.0.0:3000)
```

### Code Quality

```bash
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type check (alias: type-check)
npm run check        # Run typecheck + lint
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
```

### Build & Deploy

```bash
npm run build        # Production build
npm run start        # Start production server
```

### Security

```bash
npm run check:secrets    # Check for ThreatCloud key leakage to client
npm run verify-security  # Verify key security (if available)
```

### Validation

```bash
npm run validate:v1.0.10 # Validate v1.0.10 features are not revoked
```

### Release Gate

```bash
npm run release-gate     # Run full release gate validation
```

### Testing

```bash
npm run smoke       # Run smoke tests (if available)
npm test            # Run tests (currently: no tests configured)
```

## Security Hard Gates

### ThreatCloud API Key Protection

The ThreatCloud API key **must NEVER** reach the client. Enforcement mechanisms:

1. **Server-Only Module Guard** (`lib/checkpoint-te.ts`):
   ```typescript
   if (typeof window !== 'undefined') {
     throw new Error('SECURITY VIOLATION: lib/checkpoint-te.ts is server-only')
   }
   ```

2. **Automated Client Scan** (`scripts/check-no-client-secrets.mjs`):
   - Scans all client-side code for ThreatCloud references
   - Detects server-only module imports
   - Detects `process.env` secret usage in client files
   - Run: `npm run check:secrets`

3. **Release Gate Integration**:
   - Automatically runs `check:secrets` in release gate
   - Fails deployment if violations found

### Log Redaction

All logging must redact sensitive information:

- Authorization headers: `Authorization: Bearer ***REDACTED***`
- API keys: Never log raw key values
- Server-side only: Logs should never expose secrets

## Release Gate Script

The `scripts/release-gate.sh` script automatically:

1. Detects package manager (npm/yarn/pnpm)
2. Runs clean install (`npm ci` / equivalent)
3. Runs typecheck
4. Runs lint
5. Runs tests (if configured)
6. Runs build
7. Runs secret leakage scan
8. **Validates v1.0.10 features are not revoked** (NEW)
9. Scans build output for secrets
10. Scans git history for secrets
11. Prints PASS/FAIL summary

**Exit Codes:**
- `0`: All checks passed ✅
- `1`: One or more checks failed ❌
- `2`: Critical error (script failure)

## Manual Validation

If you need to run checks manually:

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Security check
npm run check:secrets

# v1.0.10 feature validation
npm run validate:v1.0.10

# Build
npm run build

# Verify build output
grep -r "CHECKPOINT.*API.*KEY" .next/static || echo "✅ No keys in build"
```

## Troubleshooting

### TypeScript Errors

```bash
npm run typecheck
# Fix errors, then re-run
```

### ESLint Errors

```bash
npm run lint
# Fix errors, then re-run
```

### Secret Leakage Detected

1. Review the violation report from `npm run check:secrets`
2. Remove any client-side references to ThreatCloud API key
3. Ensure server-only modules are not imported in client components
4. Re-run the check

### Build Failures

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

## Pre-Deployment Checklist

Before deploying to production:

- [ ] All release gate checks pass
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] No secret leakage detected
- [ ] **v1.0.10 features validated** (all features intact)
- [ ] Build succeeds
- [ ] All tests pass (if configured)
- [ ] Documentation updated (if needed)

## Emergency Bypass

**⚠️ NEVER bypass security checks in production.**

If you must bypass (development only):

```bash
# Skip release gate (NOT RECOMMENDED)
SKIP_RELEASE_GATE=1 npm run build
```

**Note**: This should only be used in extreme development scenarios and never in CI/CD pipelines.

## Publishing Changes to GitHub

Before publishing changes to GitHub, ensure:

1. **Git Status**: Repository is clean
   ```bash
   git status
   # Should show "working tree clean"
   ```

2. **Pull Latest**: Rebase on latest main
   ```bash
   git pull --rebase origin main
   ```

3. **Run Release Gate**: All checks must pass
   ```bash
   ./scripts/release-gate.sh
   ```

4. **Bump Version** (if needed): Update version in `package.json`
   ```bash
   # Edit package.json: "version": "1.0.12"
   # Or use npm version patch/minor/major
   npm version patch  # 1.0.11 -> 1.0.12
   ```

5. **Commit Changes**
   ```bash
   git add -A
   git commit -m "Release: stable build + deploy scripts + gates"
   ```

6. **Push to Main**
   ```bash
   git push origin main
   ```

7. **Create Tag** (if releasing new version)
   ```bash
   git tag v1.0.12
   git push origin v1.0.12
   ```

**Note**: The release gate ensures:
- ✅ TypeScript compilation passes
- ✅ ESLint checks pass
- ✅ Security checks pass (no client-side secret leakage)
- ✅ v1.0.10 features validated
- ✅ Build succeeds
- ✅ Secret leakage scans pass

## Safe Publish (One Command)

For the safest workflow, use the automated safe publish script:

```bash
# Basic usage (create/update PR)
./scripts/publish-safe.sh

# With tag (create tag after PR is merged)
./scripts/publish-safe.sh --tag v1.0.12
```

### How It Works

The `publish-safe.sh` script ensures:

1. **Safety Checks**:
   - ✅ Refuses to run on `main` branch (must use feature branch)
   - ✅ Ensures working tree is clean (no uncommitted changes)
   - ✅ Verifies `origin` remote exists
   - ✅ Runs Release Gate locally (must PASS)

2. **Automated PR Creation**:
   - Pushes current branch to `origin`
   - Creates PR to `main` using GitHub CLI (if available)
   - Or provides manual PR URL if `gh` is not installed

3. **Tagging** (optional):
   - If `--tag vX.Y.Z` is provided, creates helper script for tagging after merge
   - Tag is created AFTER PR is merged (manual step for safety)

### Prerequisites

1. **Feature Branch**: Never run on `main` branch
   ```bash
   git checkout -b feature/your-change-name
   ```

2. **GitHub CLI** (optional but recommended):
   ```bash
   # Install from: https://cli.github.com/
   # Then authenticate:
   gh auth login
   ```

3. **Clean Working Tree**: Commit all changes before running
   ```bash
   git status  # Should be clean
   ```

### Usage Examples

#### Basic Workflow (No Tag)

```bash
# 1. Create feature branch
git checkout -b feature/add-new-feature

# 2. Make changes and commit
git add .
git commit -m "Add new feature"

# 3. Run safe publish
./scripts/publish-safe.sh

# 4. Script will:
#    - Run Release Gate (must pass)
#    - Push branch to origin
#    - Create/update PR to main
#    - Provide next steps
```

#### Workflow with Tag

```bash
# 1. Create feature branch
git checkout -b release/v1.0.12

# 2. Make changes and commit
git add .
git commit -m "Release v1.0.12: New features"

# 3. Run safe publish with tag
./scripts/publish-safe.sh --tag v1.0.12

# 4. After PR is merged, create tag:
bash .tag-after-merge-v1.0.12.sh
```

### Branch Protection Setup

To enforce the safe publish workflow on GitHub:

1. **Set `main` as Default Branch**:
   - Go to repository Settings → Branches
   - Ensure `main` is the default branch

2. **Enable Branch Protection**:
   - Go to Settings → Branches → Add rule for `main`
   - Enable:
     - ✅ **Require pull request reviews** before merging
     - ✅ **Require status checks to pass** → Select `release-gate`
     - ✅ **Require branches to be up to date** before merging
     - ✅ **Do not allow bypassing** (optional, for extra safety)

3. **Block Direct Pushes**:
   - With branch protection enabled, direct pushes to `main` are blocked
   - All changes must go through PR → CI → Review → Merge

### GitHub Actions Workflow

The `release-gate` GitHub Actions workflow runs automatically on:

- **Pull Requests** to `main` or `master`
- **Pushes** to `main` or `master`

The workflow:
1. Checks out code
2. Sets up Node.js 24.13.0
3. Enables corepack
4. Runs `./scripts/release-gate.sh`
5. Fails if Release Gate does not pass

**Workflow Name**: `release-gate` (required by branch protection)

### Troubleshooting

#### "Cannot run on 'main' branch"

**Solution**: Create a feature branch first:
```bash
git checkout -b feature/your-change-name
```

#### "Working tree is dirty"

**Solution**: Commit or stash changes:
```bash
git add .
git commit -m "Your commit message"
# OR
git stash
```

#### "GitHub CLI not found"

**Solution**: Either install GitHub CLI:
```bash
# macOS
brew install gh

# Ubuntu/Debian
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

Or use the manual PR URL provided by the script.

#### "Release Gate FAILED"

**Solution**: Fix the issues reported by Release Gate:
```bash
./scripts/release-gate.sh  # See detailed errors
# Fix issues, then re-run publish-safe.sh
```

### Manual PR Creation

If GitHub CLI is not available, the script provides a manual PR URL:

```
https://github.com/<owner>/<repo>/compare/main...<branch>?expand=1
```

1. Open the URL in your browser
2. Fill in PR title and description
3. Click "Create Pull Request"
4. Wait for CI checks to pass
5. Review and merge

### Assumptions

- **Branch Names**: Feature branches should not be named `main` or `master`
- **Remote Name**: Git remote must be named `origin`
- **GitHub CLI**: Optional but recommended for automatic PR creation
- **CI/CD**: GitHub Actions must be enabled in repository settings
- **Branch Protection**: Recommended but not required (script works without it)

---

**Last Updated**: 2026-01-16  
**Version**: 1.0.11
