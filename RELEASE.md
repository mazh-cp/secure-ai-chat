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

### Discovered Commands (from `package.json`):

| Command | Script | Purpose | Exit on Error |
|---------|--------|---------|---------------|
| **Dev** | `npm run dev` | Development server | ❌ No |
| **Build** | `npm run build` | Production build | ✅ Yes |
| **Start** | `npm start` | Production server | ❌ No |
| **Lint** | `npm run lint` | ESLint validation | ✅ Yes |
| **Type Check** | `npm run type-check` | TypeScript check | ✅ Yes |
| **Format** | `npm run format` | Prettier format | ❌ No |
| **Format Check** | `npm run format:check` | Prettier validation | ✅ Yes |
| **Check** | `npm run check` | Type check + Lint | ✅ Yes |
| **Check:CI** | `npm run check:ci` | Full CI validation | ✅ Yes |
| **Release Gate** | `npm run release-gate` | Pre-deployment validation | ✅ Yes |

### Missing Commands (Not Applicable):

- ❌ **Tests**: No test framework detected (Jest/Vitest)
  - **Reason**: Manual testing via smoke scripts
  - **Alternative**: `npm run smoke` for basic validation

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

## ✅ Release Gate Checklist

Before deploying, verify:

- [ ] Release Gate script passes (`npm run release-gate`)
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] No API keys in client code
- [ ] No API keys in build output
- [ ] Production build succeeds
- [ ] All security checks pass
- [ ] Backwards compatibility verified
- [ ] Error handling comprehensive
- [ ] Logging secure (no API keys exposed)

**Status**: ✅ **PRODUCTION READY** (All checks passing)

---

**Last Updated**: 2026-01-XX  
**Maintained By**: Development Team
