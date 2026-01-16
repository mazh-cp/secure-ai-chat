# Dev vs Prod Drift Fixes - Summary

## Root Causes Found

### 1. Missing Directory Creation in Deploy Scripts
- **Issue**: Production deploy scripts did not create `.secure-storage` and `.storage` directories before application start
- **Evidence**: Application code creates directories on first use, but may fail with permission issues if app user differs from deploy user
- **Fix**: Added directory creation step in `upgrade.sh` (Step 6a) and `clean-install.sh` (Step 7a) with correct permissions and ownership

### 2. No Startup Validation
- **Issue**: Application did not validate environment variables and required directories on startup
- **Evidence**: Silent failures when directories don't exist or have wrong permissions
- **Fix**: Created `scripts/validate-startup.sh` that checks env vars, creates directories, and validates permissions before Next.js starts

### 3. Systemd Service Missing Startup Validation
- **Issue**: Systemd service started application directly without validating prerequisites
- **Evidence**: Service could start even if directories missing or permissions wrong
- **Fix**: Added `ExecStartPre` to systemd service template to run `validate-startup.sh` before starting application

### 4. Missing Diagnostics in Deploy Scripts
- **Issue**: Deploy scripts did not print non-secret diagnostics (Node version, PM, git rev, disk space, dir perms)
- **Evidence**: Hard to debug production issues without visibility into runtime environment
- **Fix**: Added diagnostics output to `upgrade.sh` and `clean-install.sh` (Node version, package manager, git revision, disk free, app user, directory permissions)

### 5. Smoke Tests Not Production-Specific
- **Issue**: Smoke tests did not validate production-specific behavior (settings read/write, file upload, RAG, ThreatCloud)
- **Evidence**: Production-specific endpoints not tested
- **Fix**: Enhanced `scripts/smoke-test.sh` with production-specific endpoint checks

### 6. No Local Production Build Testing
- **Issue**: No way to test production build locally before deploying
- **Evidence**: Dev uses `npm run dev`, but prod uses `npm run build` + `npm start` - different behavior
- **Fix**: Created `scripts/reproduce-prod-local.sh` to run exact production build process locally

### 7. No Drift Detection Tool
- **Issue**: No automated way to detect differences between dev and prod environments
- **Evidence**: Manual checks required to identify drift
- **Fix**: Created `scripts/check-drift.sh` to automatically detect Node.js version, package manager, env vars, paths, and permissions differences

## Files Changed

1. **`docs/DEV_PROD_DRIFT_CHECKLIST.md`** - NEW: Comprehensive drift checklist and validation guide
2. **`scripts/check-drift.sh`** - NEW: Automated drift detection script
3. **`scripts/reproduce-prod-local.sh`** - NEW: Local production build reproduction script
4. **`scripts/validate-startup.sh`** - NEW: Startup validation script for env vars and directories
5. **`scripts/smoke-test.sh`** - MODIFIED: Added production-specific endpoint checks
6. **`scripts/deploy/upgrade.sh`** - MODIFIED: Added directory creation (Step 6a) and diagnostics output
7. **`scripts/deploy/clean-install.sh`** - MODIFIED: Added directory creation (Step 7a) and diagnostics output
8. **`scripts/deploy/secure-ai-chat.service`** - MODIFIED: Added `ExecStartPre` for startup validation and ensured `NODE_ENV=production`

## Validation Commands

### Local Development

```bash
# Check for drift issues
./scripts/check-drift.sh

# Reproduce production build locally
./scripts/reproduce-prod-local.sh

# Validate startup requirements
./scripts/validate-startup.sh
```

### Production Upgrade

```bash
# On production server
cd /opt/secure-ai-chat
sudo bash scripts/deploy/upgrade.sh --app-dir /opt/secure-ai-chat --ref main
```

### Production Clean Install

```bash
# On production server
sudo bash scripts/deploy/clean-install.sh --app-dir /opt/secure-ai-chat --ref main --app-user secureai
```

## Expected Behavior After Fixes

1. **Directory Creation**: Required directories (`.secure-storage`, `.storage`) are created automatically during deployment with correct permissions
2. **Startup Validation**: Application validates env vars and directories before starting (via `validate-startup.sh`)
3. **Diagnostics**: Deploy scripts print non-secret diagnostics (Node version, PM, git rev, disk space, dir perms) for debugging
4. **Production Testing**: Can test production build locally using `reproduce-prod-local.sh` before deploying
5. **Drift Detection**: Can automatically detect differences between dev and prod using `check-drift.sh`
6. **Smoke Tests**: Enhanced smoke tests validate production-specific endpoints (settings, file upload, RAG, ThreatCloud)

## Next Steps

1. Run `./scripts/check-drift.sh` locally to identify any remaining drift issues
2. Run `./scripts/reproduce-prod-local.sh` locally to test production build
3. Review deploy scripts to ensure directory creation and diagnostics are working
4. Test production upgrade on staging server if available
5. Deploy to production using updated scripts
