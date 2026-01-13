# Release Gate - Pre-Deployment Validation

**Version**: 1.0.1  
**Purpose**: Ensure code correctness, security, stability, and backwards compatibility before deployment

---

## 🎯 Overview

The Release Gate is a comprehensive validation system that must **PASS** before any deployment. It ensures:

- ✅ **Code Correctness**: TypeScript, ESLint, Build pass
- ✅ **Security**: API keys never reach client-side code
- ✅ **Stability**: No blocking operations, resource-safe file handling
- ✅ **Backwards Compatibility**: Existing users continue to work
- ✅ **Observability**: Comprehensive server-side logging

---

## 📋 Release Gate Checklist

### ✅ **PASS/FAIL Criteria**

| Check | Status | Description |
|-------|--------|-------------|
| **Clean Install** | ✅ REQUIRED | Fresh dependency installation |
| **Type Check** | ✅ REQUIRED | TypeScript compilation errors = FAIL |
| **Lint** | ✅ REQUIRED | ESLint errors/warnings = FAIL |
| **Security: Client Leakage** | ✅ REQUIRED | API keys in client components = FAIL |
| **Security: Build Output** | ✅ REQUIRED | API keys in build bundle = FAIL |
| **Build** | ✅ REQUIRED | Production build must succeed |

**Exit Code**: `0` = PASS, `1` = FAIL (Do NOT deploy)

---

## 🚀 Quick Start

### Run Release Gate (Single Command)

```bash
# Detects package manager automatically (npm/yarn/pnpm)
npm run release-gate

# Or run directly
bash scripts/release-gate.sh
```

**Output**: PASS/FAIL with detailed logs

---

## 📖 Repository Commands

### All Available Commands (from `package.json`):

| Command | Script | Purpose | Exit on Error | Notes |
|---------|--------|---------|---------------|-------|
| **dev** | `npm run dev` | Development server (0.0.0.0) | ❌ No | Runs on all interfaces |
| **build** | `npm run build` | Production build | ✅ Yes | Next.js production build |
| **start** | `npm start` | Production server | ❌ No | Next.js production server |
| **lint** | `npm run lint` | ESLint validation | ✅ Yes | Next.js ESLint config |
| **type-check** | `npm run type-check` | TypeScript check | ✅ Yes | `tsc --noEmit` |
| **typecheck** | `npm run typecheck` | TypeScript check (alias) | ✅ Yes | Same as type-check |
| **format** | `npm run format` | Prettier format files | ❌ No | Formats all files |
| **format:check** | `npm run format:check` | Prettier validation | ✅ Yes | Checks formatting |
| **check** | `npm run check` | Type check + Lint | ✅ Yes | Runs both checks |
| **check:ci** | `npm run check:ci` | Full CI validation | ✅ Yes | Type + Lint + Format |
| **check:node** | `npm run check:node` | Node.js version check | ✅ Yes | Verifies Node 25.2.1 |
| **pre-push** | `npm run pre-push` | Pre-push validation | ✅ Yes | Node + Lint + Build |
| **smoke** | `npm run smoke` | Smoke tests | ❌ No | Basic validation script |
| **release-gate** | `npm run release-gate` | Pre-deployment validation | ✅ Yes | **STRICT** - All checks |
| **verify-security** | `npm run verify-security` | Security verification | ✅ Yes | Key security checks |
| **validate-env** | `npm run validate-env` | Environment validation | ✅ Yes | Env var checks |
| **test** | `npm run test` | Test placeholder | ❌ No | Echo message (no tests) |

### Command Usage:

```bash
# Development
npm run dev              # Start development server

# Building
npm run build            # Production build
npm run type-check       # TypeScript type checking
npm run lint             # ESLint validation

# Formatting
npm run format           # Format all files
npm run format:check     # Check formatting

# Validation
npm run check            # Type check + Lint
npm run check:ci         # Full CI validation (Type + Lint + Format)
npm run release-gate     # **STRICT** Pre-deployment validation

# Security
npm run verify-security  # Verify key security
npm run validate-env     # Validate environment variables

# Production
npm start                # Production server
```

### Missing Commands (Not Applicable):

- ❌ **Tests**: No test framework detected (Jest/Vitest)
  - **Reason**: Manual testing via smoke scripts
  - **Alternative**: `npm run smoke` for basic validation
  - **Note**: Test command exists but only echoes a message

---

## 🔒 Security Hard Gates

### 1. **API Key Leakage Prevention**

**Rule**: Check Point TE API keys **MUST NEVER** reach client-side code.

#### ✅ Automated Safeguards:

**A) ESLint Rule** (`.eslintrc.json`):
```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "@/lib/checkpoint-te",
            "message": "❌ SECURITY: checkpoint-te.ts must NOT be imported in client components."
          }
        ]
      }
    ]
  },
  "overrides": [
    {
      "files": ["app/api/**/*.ts", "lib/**/*.ts"],
      "rules": {
        "no-restricted-imports": "off"
      }
    }
  ]
}
```

**B) Security Audit Script** (`scripts/check-security.sh`):
- Checks for API key functions in client components
- Verifies no API keys in localStorage/sessionStorage
- Validates console logs only show safe prefixes

**C) Build Output Check** (Release Gate):
- Scans `.next/static` for API key strings
- Fails if keys detected in client bundle

#### ✅ Manual Verification:

```bash
# Check client components
grep -r "getTeApiKey\|setTeApiKey" components/ app/ --include="*.tsx" --exclude-dir="api" | grep -v "checkpointTeConfigured\|checkpointTeSandboxEnabled"

# Check build output
grep -r "TE_API_KEY\|CHECKPOINT_TE_API_KEY" .next/static 2>/dev/null || echo "✅ No API keys in build"
```

### 2. **Logging Security**

**Rule**: API keys must be redacted in all logs.

#### ✅ Implementation:
- ✅ Console logs show only prefix (first 10 chars) and length
- ✅ Authorization headers redacted (first 30 chars only)
- ✅ System logs never contain full API keys
- ✅ Error messages never expose API keys

---

## 🔄 Backwards Compatibility

### ✅ Verified Compatibility:

1. **Settings Migration**:
   - ✅ New `checkpointTeSandboxEnabled` toggle defaults to `false`
   - ✅ Existing users without toggle continue to work
   - ✅ No required fields added to settings schema

2. **File Upload**:
   - ✅ Works identically when TE toggle is OFF
   - ✅ Existing Lakera scanning continues to work
   - ✅ No breaking changes to file upload flow

3. **API Endpoints**:
   - ✅ All endpoints optional (work without API keys)
   - ✅ Missing API keys handled gracefully (not breaking errors)
   - ✅ Existing endpoints unchanged

### ✅ Safe Defaults:

- `checkpointTeSandboxEnabled`: `false` (disabled by default)
- `checkpointTeConfigured`: `false` (checked via API)
- TE API key: Optional (can be set via Settings UI or env var)

---

## 🛡️ ThreatCloud Proxy Hardening

### ✅ Defensive Engineering:

1. **Timeouts**:
   - ✅ Upload: 30 seconds (AbortController)
   - ✅ Query: 30 seconds per request
   - ✅ Polling: 60 seconds total (30 attempts × 2s)

2. **Retries & Backoff**:
   - ✅ Polling retries up to 30 attempts (2s interval)
   - ✅ Query failures retry within polling loop
   - ✅ Network errors handled with user-friendly messages

3. **Response Validation**:
   - ✅ Upload response validates structure and hashes
   - ✅ Query response validates log fields and status
   - ✅ Invalid responses return safe fallback

4. **Polling Termination**:
   - ✅ Timeout-based check (60s total)
   - ✅ Max attempts check (30 attempts)
   - ✅ Status-based termination (FOUND/PARTIALLY_FOUND/NOT_FOUND)
   - ✅ Safe fallback to "unknown" after timeout

5. **Error Messages**:
   - ✅ User-friendly messages (no stack traces)
   - ✅ Troubleshooting tips for common errors
   - ✅ No sensitive data in error responses
   - ✅ Errors logged to System Logs with request IDs

### ✅ File Limits:

- ✅ **Size**: 50 MB (enforced frontend + backend)
- ✅ **Type**: `.pdf`, `.txt`, `.md`, `.json`, `.csv`, `.docx`
- ✅ **Early Rejection**: Files rejected before upload attempt

---

## 📊 Stability Assurance

### ✅ Performance:
- ✅ Non-blocking UI (all operations async)
- ✅ No synchronous waits (polling uses async/await)
- ✅ Request timeouts prevent hanging
- ✅ UI responsiveness maintained

### ✅ Resource Safety:
- ✅ Memory efficient (streams for file upload)
- ✅ Max file size (50 MB) prevents memory bloat
- ✅ Proper cleanup (buffers released after upload)
- ✅ No memory leaks observed

### ✅ Concurrency:
- ✅ Parallel uploads handled independently
- ✅ No shared state between uploads
- ✅ Each upload has unique request ID
- ✅ Error isolation (one failure doesn't affect others)

### ✅ Fail-Safe Behavior:
- ✅ App works fully without Check Point TE configured
- ✅ If TE fails, file upload continues (user notified)
- ✅ All errors caught and handled gracefully
- ✅ React error boundaries prevent UI crashes

### ✅ Restart Safety:
- ✅ API key persisted to encrypted file
- ✅ Environment variable fallback
- ✅ Key loaded on server startup
- ✅ No in-memory-only reliance

---

## 🔍 Release Gate Process

### Step-by-Step:

1. **Clean Install**: Fresh dependency installation
2. **Type Check**: TypeScript compilation errors = FAIL
3. **Lint**: ESLint errors/warnings = FAIL (includes security rule)
4. **Security Audit**: API key leakage check = FAIL if detected
5. **Build**: Production build must succeed
6. **Build Output Check**: API keys in bundle = FAIL
7. **Summary**: PASS/FAIL with detailed results

### Exit Codes:
- `0` = **PASS** (Ready for deployment)
- `1` = **FAIL** (Do NOT deploy - fix errors first)

---

## 📝 Release Gate Output

### ✅ PASS Example:
```
╔═══════════════════════════════════════════════════════════════╗
║                    ✅ RELEASE GATE: PASS                      ║
║                                                               ║
║  All checks passed. Ready for deployment.                    ║
╚═══════════════════════════════════════════════════════════════╝
```

### ❌ FAIL Example:
```
╔═══════════════════════════════════════════════════════════════╗
║                    ❌ RELEASE GATE: FAIL                      ║
║                                                               ║
║  One or more checks failed. Do not deploy.                   ║
║  Review the errors above and fix before proceeding.          ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## 🚨 Common Failures & Fixes

### TypeScript Errors:
- **Issue**: Type errors in code
- **Fix**: Run `npm run type-check` and fix reported errors

### ESLint Errors:
- **Issue**: Code style or security violations
- **Fix**: Run `npm run lint` and fix reported errors
- **Security**: If `checkpoint-te` import detected in client, remove it and use API routes instead

### Build Failures:
- **Issue**: Production build fails
- **Fix**: Check build logs for errors, fix compilation issues

### Security Failures:
- **Issue**: API keys detected in client code or build output
- **Fix**: 
  1. Remove any direct imports of `@/lib/checkpoint-te` from client components
  2. Use API routes (`/api/te/*`) instead
  3. Verify no API keys in localStorage/sessionStorage
  4. Check console logs don't expose full API keys

---

## 📚 Additional Documentation

- **Post-Change Validation Report**: `POST_CHANGE_VALIDATION_REPORT.md`
- **Security Checklist**: `FINAL_VALIDATION_CHECKLIST.md`
- **Validation Checklist**: `VALIDATION_CHECKLIST.md`

---

## ✅ Release Gate Checklist (STRICT - ALL MUST PASS)

### 🔴 Hard Gates (MUST PASS - No Exceptions)

Before deploying, **ALL** of the following must pass:

| Check | Command | Status | Failure Action |
|-------|---------|--------|----------------|
| **Clean Install** | `npm ci` or detected package manager | ✅ REQUIRED | FAIL - Fix dependency issues |
| **TypeScript Compilation** | `npm run type-check` | ✅ REQUIRED | FAIL - Fix type errors |
| **ESLint Validation** | `npm run lint` | ✅ REQUIRED | FAIL - Fix lint errors |
| **Security: Client Key Leakage** | `grep -r checkpoint-te components/` | ✅ REQUIRED | FAIL - Remove client imports |
| **Security: Build Output Scan** | `grep -r "sk-" .next/static` | ✅ REQUIRED | FAIL - Remove keys from build |
| **Production Build** | `npm run build` | ✅ REQUIRED | FAIL - Fix build errors |
| **Git Secret Scan** | `git grep "sk-[a-zA-Z0-9]\{48\}"` | ✅ REQUIRED | FAIL - Remove keys from code |

### 🟡 Warnings (Non-Blocking but Recommended)

| Check | Status | Action |
|-------|--------|--------|
| **Format Check** | ⚠️ Recommended | Run `npm run format` if failed |
| **Node Version** | ⚠️ Recommended | Use Node 25.2.1 |
| **Git Status** | ⚠️ Recommended | Commit/stash changes |

### ✅ Verification Commands

```bash
# Run full Release Gate (RECOMMENDED)
npm run release-gate

# Manual verification
npm run type-check   # Must pass
npm run lint         # Must pass (warnings OK)
npm run build        # Must pass
npm run verify-security  # Must pass
```

### 🚨 Failure Response

If Release Gate **FAILS**:
1. **DO NOT DEPLOY** - Fix all failures first
2. Review error messages from `npm run release-gate`
3. Fix TypeScript errors: `npm run type-check`
4. Fix ESLint errors: `npm run lint`
5. Remove API keys from code if detected
6. Re-run Release Gate until **ALL checks PASS**

### ✅ Success Criteria

Release Gate **PASSES** when:
- ✅ All TypeScript errors resolved
- ✅ All ESLint errors resolved
- ✅ No API keys in client code
- ✅ No API keys in build output
- ✅ No API keys in tracked source files
- ✅ Production build succeeds

**Exit Code**: `0` = ✅ **PASS** (Ready for deployment), `1` = ❌ **FAIL** (Do NOT deploy)

---

## 📋 Quick Reference: Release Gate Process

### 1. Pre-Deployment Checklist

```bash
# Step 1: Clean working directory
git status  # Should be clean or only allowlisted files

# Step 2: Run Release Gate (AUTOMATED)
npm run release-gate

# Step 3: If PASS, proceed with deployment
# Step 4: If FAIL, fix errors and repeat Step 2
```

### 2. Release Gate Output

**✅ PASS Example**:
```
╔═══════════════════════════════════════════════════════════════╗
║                    ✅ RELEASE GATE: PASS                      ║
║                                                               ║
║  All checks passed. Ready for deployment.                    ║
╚═══════════════════════════════════════════════════════════════╝
```

**❌ FAIL Example**:
```
╔═══════════════════════════════════════════════════════════════╗
║                    ❌ RELEASE GATE: FAIL                      ║
║                                                               ║
║  One or more checks failed. Do NOT deploy.                   ║
╚═══════════════════════════════════════════════════════════════╝

Failed checks:
  ❌ TypeScript compilation: FAILED
  ❌ Security: API keys found in client code
```

### 3. Common Failures & Fixes

| Failure | Fix |
|---------|-----|
| TypeScript errors | Run `npm run type-check` and fix errors |
| ESLint errors | Run `npm run lint` and fix errors |
| Client key leakage | Remove `checkpoint-te` imports from client components |
| Build failures | Check build logs, fix compilation errors |
| Secret leakage | Remove API keys from source code |

---

**Status**: ✅ **PRODUCTION READY** (All checks passing)

**Last Updated**: 2025-01-XX  
**Maintained By**: Development Team

---

**Last Updated**: 2026-01-XX  
**Maintained By**: Development Team
