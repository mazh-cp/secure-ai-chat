# Dev vs Prod Drift Checklist

This document identifies and validates differences between local development and production deployments to ensure parity and stability.

## Runtime + Toolchain Parity

### Node.js Version
- **Local Dev**: Check with `node -v`
- **Production**: Should match `.nvmrc` (currently: `24.13.0`)
- **Validation**: Run `./scripts/check-drift.sh --check-node`

### Package Manager
- **Local Dev**: Check with `which npm` and `npm -v`
- **Production**: Should match detected lockfile (`package-lock.json` → npm, `yarn.lock` → yarn, `pnpm-lock.yaml` → pnpm)
- **Validation**: Run `./scripts/check-drift.sh --check-pm`

### Lockfile Usage
- **Local Dev**: Uses `package-lock.json`
- **Production**: Must use `npm ci` (not `npm install`) for reproducible builds
- **Validation**: Ensure deploy scripts use `npm ci` or equivalent frozen install

## Build Mode Differences

### Development Mode
```bash
npm run dev  # next dev -H 0.0.0.0
```
- Hot reload enabled
- Source maps enabled
- Development optimizations
- No build cache validation

### Production Mode
```bash
npm run build  # next build
npm start      # next start
```
- Optimized bundles
- No source maps (unless configured)
- Static optimization
- Build cache required (`.next` directory)

**Validation**: Run `./scripts/reproduce-prod-local.sh` to test production build locally

## Environment Variables

### Local Development
- File: `.env.local` (gitignored)
- Loaded by Next.js automatically
- Optional: API keys can be configured via UI

### Production
- File: `/etc/secure-ai-chat.env` (systemd EnvironmentFile)
- Or: Environment variables set in systemd service
- Required vars (without values - can be configured via UI):
  - `NODE_ENV=production`
  - `PORT=3000`
  - `HOSTNAME=0.0.0.0`
- Optional vars (can be set via env or UI):
  - `OPENAI_API_KEY` (optional - can be set via Settings UI)
  - `LAKERA_AI_KEY` (optional - can be set via Settings UI)
  - `CHECKPOINT_TE_API_KEY` (optional - can be set via Settings UI)

**Validation**: Run `./scripts/check-drift.sh --check-env`

## Config Parity

### Storage Paths

#### Local Development
- `.secure-storage/` - Encrypted API keys (mode 700)
- `.storage/` - Uploaded files, metadata (mode 755)
- `.next/` - Build output (mode 755)

#### Production
- `{{APP_DIR}}/.secure-storage/` - Encrypted API keys (mode 700, owned by app user)
- `{{APP_DIR}}/.storage/` - Uploaded files, metadata (mode 755, owned by app user)
- `{{APP_DIR}}/.next/` - Build output (mode 755, owned by app user)

**Validation**: Run `./scripts/check-drift.sh --check-paths`

### Permissions

#### Local Development
- Created by current user
- Permissions set automatically by Node.js `fs.mkdir`

#### Production
- Created by deploy script (as app user or root, then chown to app user)
- Must ensure writable by app user
- Must ensure `.secure-storage` is mode 700

**Validation**: Run `./scripts/check-drift.sh --check-perms`

## Persistence Parity

### Required Directories

1. **`.secure-storage/`**
   - Purpose: Encrypted API keys
   - Mode: `700` (owner read/write/execute only)
   - Owner: App user
   - Created by: `lib/api-keys-storage.ts::ensureStorageDir()`

2. **`.storage/`** (if used for file uploads)
   - Purpose: Uploaded files, metadata
   - Mode: `755` (owner read/write/execute, others read/execute)
   - Owner: App user
   - Created by: Application code on first upload

3. **`.next/`**
   - Purpose: Next.js build output
   - Mode: `755`
   - Owner: App user
   - Created by: `npm run build`

**Validation**: Deploy scripts must create these directories if they don't exist

## Known Drift Issues

### 1. Node.js Version Mismatch
- **Issue**: Local may use different Node.js version than production
- **Fix**: Enforce Node.js version in deploy scripts and release-gate
- **Status**: ✅ Fixed in `scripts/deploy/common.sh::ensure_node_version()`

### 2. Missing Directory Creation
- **Issue**: Production may not create required directories before first use
- **Fix**: Deploy scripts must `mkdir -p` and `chown` required directories
- **Status**: 🔧 Needs fix in deploy scripts

### 3. Environment Variable Validation
- **Issue**: No startup validation for required env vars
- **Fix**: Create startup validation script that checks env vars and directories
- **Status**: 🔧 Needs implementation

### 4. Production Build Not Tested Locally
- **Issue**: Dev uses `npm run dev`, but prod uses `npm run build` + `npm start`
- **Fix**: Create script to reproduce production build locally
- **Status**: 🔧 Needs implementation

### 5. Missing Smoke Tests in Production Mode
- **Issue**: Smoke tests may not validate production-specific behavior
- **Fix**: Enhance `scripts/smoke-test.sh` with production-specific checks
- **Status**: 🔧 Needs enhancement

## Validation Commands

```bash
# Check all drift issues
./scripts/check-drift.sh

# Check specific items
./scripts/check-drift.sh --check-node
./scripts/check-drift.sh --check-env
./scripts/check-drift.sh --check-paths
./scripts/check-drift.sh --check-perms

# Reproduce production build locally
./scripts/reproduce-prod-local.sh

# Validate startup (env vars, directories)
./scripts/validate-startup.sh
```

## Next Steps

1. Run `./scripts/check-drift.sh` to identify current drift
2. Run `./scripts/reproduce-prod-local.sh` to test production build
3. Review deploy scripts to ensure parity
4. Add startup validation to application
5. Run enhanced smoke tests after deployment
