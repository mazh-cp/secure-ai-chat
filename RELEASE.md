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

---

**Last Updated**: 2026-01-16  
**Version**: 1.0.11
