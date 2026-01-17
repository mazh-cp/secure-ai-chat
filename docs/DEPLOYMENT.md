# Deployment Guide

Complete guide for deploying Secure AI Chat to production servers.

## Quick Upgrade (One Command)

For existing installations, upgrade with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-inline.sh | bash
```

Or with custom options:
```bash
APP_DIR=/opt/secure-ai-chat GIT_REF=main curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-inline.sh | bash
```

**What it does:**
- Auto-detects installation directory
- Creates comprehensive backup (API keys, files, config, build)
- Updates code from repository
- Installs dependencies (`npm ci`)
- Runs storage migrations
- Builds application
- Restarts service
- Verifies upgrade
- Includes automatic rollback on failure

**Safe for production:** Includes backups, error handling, and rollback capability.

## Prerequisites

### System Requirements

- **OS**: Ubuntu 18.04+ or Debian 10+
- **Node.js**: v24.13.0 (LTS) - installed automatically by scripts
- **Ports**: 
  - 3000 (application) - configurable via PORT env var
  - 22 (SSH) - required for remote access
- **Disk Space**: Minimum 2GB free (for dependencies and build)
- **Memory**: Minimum 512MB RAM

### Required Packages

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y curl git build-essential ca-certificates
```

### Environment Variables

Create `/etc/secure-ai-chat.env` (or use `.env.local` in app directory):

```bash
# Application
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# API Keys (optional - can be configured via Settings UI)
# OPENAI_API_KEY=
# LAKERA_AI_KEY=
# CHECKPOINT_TE_API_KEY=
```

**Important**: API keys can be configured via the Settings UI (stored securely in `.secure-storage/`). Environment variables are optional.

## Stable Build Validation

Before deploying, validate the build is stable:

### Step 1: Run Release Gate

```bash
./scripts/release-gate.sh
```

This validates:
- TypeScript compilation
- ESLint checks
- Security (no client-side secret leakage)
- v1.0.10 features intact
- Production build
- Secret leakage scans

### Step 2: Verify Build Output

```bash
npm run build
ls -la .next/
```

Ensure `.next/` directory exists with build artifacts.

### Step 3: Start Server and Run Smoke Tests

```bash
# Start server (in background or separate terminal)
npm start &

# Wait for server to be ready
sleep 5

# Run smoke tests
BASE_URL=http://localhost:3000 ./scripts/smoke-test.sh
```

Smoke tests verify:
- Health endpoints respond correctly
- Status endpoints don't expose secrets
- List endpoints work
- No secrets in responses or logs

## Unified Installation Scripts (Recommended)

### Fresh Install (Idempotent)

**Usage:**
```bash
bash scripts/install.sh --app-dir /opt/secure-ai-chat --app-user appuser
```

**What it does:**
1. Creates app user (if needed)
2. Creates app directory with correct ownership
3. Installs Node.js v24.13.0 via nvm
4. Clones repository
5. Runs `npm ci` (frozen install)
6. Runs storage migrations (`npm run migrate`)
7. Builds application
8. Configures systemd service
9. Starts service
10. Runs health check

**Idempotent:** Safe to run multiple times. Skips steps already completed.

### In-Place Upgrade (Idempotent with Auto-Rollback)

**Usage:**
```bash
bash scripts/upgrade.sh --app-dir /opt/secure-ai-chat --ref main
```

**What it does:**
1. Creates backup (`.secure-storage`, `.storage`, `.env.local`, `.next`)
2. Pulls latest code from git
3. Stops service
4. Runs `npm ci` (frozen install)
5. Runs storage migrations (`npm run migrate`)
6. Builds application
7. Restarts service
8. Runs health check
9. **Automatic rollback** if service fails or health check fails

**Idempotent:** Safe to run multiple times. Creates new backup each time.

### Manual Rollback

If automatic rollback fails:

```bash
# 1. Stop service
sudo systemctl stop secure-ai-chat

# 2. Find latest backup
ls -lt /opt/secure-ai-chat/.backups/

# 3. Restore from backup
cd /opt/secure-ai-chat
BACKUP_PATH=/opt/secure-ai-chat/.backups/upgrade-YYYYMMDD-HHMMSS
cp -r "$BACKUP_PATH/.secure-storage" .
cp -r "$BACKUP_PATH/.storage" .
cp "$BACKUP_PATH/.env.local" .
cp -r "$BACKUP_PATH/.next" .

# 4. Restore git state (if needed)
git checkout $(cat "$BACKUP_PATH/.git-ref")

# 5. Restart service
sudo systemctl start secure-ai-chat
sudo systemctl status secure-ai-chat
```

### Storage Configuration

Storage path is configurable via `STORAGE_DIR` environment variable:

```bash
# Default: ./.storage (relative to project root)
STORAGE_DIR=./.storage

# Custom path: /var/lib/secure-ai-chat/storage
STORAGE_DIR=/var/lib/secure-ai-chat/storage
```

**Important:** Storage directory should be:
- Outside the repository (not in `.git`)
- Writable by the app user
- Persisted across upgrades (not deleted during upgrades)
- Backed up regularly

### Environment Validation

The application validates environment variables at runtime (non-fatal):

```bash
# Check environment validation (logs warnings/errors but doesn't crash)
# Validation runs automatically on first health check (/api/health)
curl http://localhost:3000/api/health
```

**Validation checks:**
- Required variables for production
- Storage directory path safety
- NEXT_PUBLIC_ variables don't leak secrets
- Port number is valid

Validation errors are logged but don't crash the application.

## Deployment Workflows

### Workflow A: Upgrade Existing Installation

Upgrade an existing installation in-place (safe, idempotent, rollback-friendly).

**Usage:**
```bash
sudo ./scripts/deploy/upgrade.sh --app-dir /opt/secure-ai-chat --ref main
```

**Options:**
- `--app-dir`: Application directory (required)
- `--ref`: Git reference to deploy (default: `main`)
- `--backup-dir`: Custom backup directory (default: `{app-dir}/.backups`)
- `--no-rollback`: Disable automatic rollback on failure

**Steps:**
1. Validates git repository is clean (or stashes changes)
2. Fetches latest code and checks out target ref
3. Creates timestamped backup of current build + config
4. Installs dependencies (frozen/immutable)
5. Runs release gate (MUST PASS)
6. Builds production bundle
7. Restarts systemd service
8. Runs smoke tests
9. **Auto-rollback** if any step fails

**Rollback:**
If upgrade fails, the script automatically:
- Restores previous git commit
- Restores previous build (.next directory)
- Restarts service with previous version

Manual rollback:
```bash
cd /opt/secure-ai-chat
git checkout <previous-commit>
cp -r .backups/upgrade-YYYYMMDD_HHMMSS/.next .next
sudo systemctl restart secure-ai-chat
```

### Workflow B: Clean Install on New Server

Full setup from scratch on a brand-new server.

**Usage:**
```bash
sudo ./scripts/deploy/clean-install.sh --app-dir /opt/secure-ai-chat --ref main
```

**Options:**
- `--app-dir`: Application directory (required, default: `/opt/secure-ai-chat`)
- `--ref`: Git reference to deploy (default: `main`)
- `--app-user`: Application user (default: `secureai`)
- `--skip-os-deps`: Skip OS dependency check

**Steps:**
1. Checks/installs OS prerequisites (curl, git, build-essential)
2. Installs Node.js v24.13.0 via nvm
3. Creates app user (`secureai`) and app directory
4. Clones repository into app directory
5. Installs dependencies (frozen/immutable)
6. Runs release gate (MUST PASS)
7. Builds production bundle
8. Creates systemd service file
9. Creates environment file template
10. Starts service and runs smoke tests

**Post-Installation:**
1. Configure API keys via Settings UI or edit `/etc/secure-ai-chat.env`
2. Check service status: `sudo systemctl status secure-ai-chat`
3. View logs: `sudo journalctl -u secure-ai-chat -f`
4. Access app: `http://localhost:3000`

## Systemd Service Configuration

The deployment scripts create a systemd service file at `/etc/systemd/system/secure-ai-chat.service`.

### Service Management

```bash
# Enable service (start on boot)
sudo systemctl enable secure-ai-chat

# Start service
sudo systemctl start secure-ai-chat

# Stop service
sudo systemctl stop secure-ai-chat

# Restart service
sudo systemctl restart secure-ai-chat

# Check status
sudo systemctl status secure-ai-chat

# View logs
sudo journalctl -u secure-ai-chat -f
```

### Environment File

The service uses `/etc/secure-ai-chat.env` for environment variables.

**Important**: 
- Never commit this file with actual secrets
- API keys can be configured via Settings UI (stored in `.secure-storage/`)
- Environment variables are optional (Settings UI takes precedence)

### Service File Template

The service file template is located at `scripts/deploy/secure-ai-chat.service`.

It includes:
- User/group: `secureai`
- Working directory: `/opt/secure-ai-chat` (or specified `--app-dir`)
- Environment file: `/etc/secure-ai-chat.env`
- Auto-restart: `Restart=always, RestartSec=5`
- Security: `NoNewPrivileges=true, PrivateTmp=true`

## Smoke Tests

Smoke tests validate the application is running correctly after deployment.

**Run manually:**
```bash
BASE_URL=http://localhost:3000 ./scripts/smoke-test.sh
```

**What it tests:**
- `/api/health` - Health check endpoint
- `/api/version` - Version endpoint
- `/api/keys/retrieve` - Keys status (no values)
- `/api/te/config` - Check Point TE config status
- `/api/files` - Files list
- `/api/models` - Models list
- `/api/waf/health` - WAF health (optional)
- Secret leakage in responses and logs

**Exit Codes:**
- `0`: All tests passed ✅
- `1`: One or more tests failed ❌

## Troubleshooting

### Build Failures

```bash
# Clean install
rm -rf node_modules package-lock.json
npm ci

# Rebuild
npm run build
```

### Service Won't Start

```bash
# Check logs
sudo journalctl -u secure-ai-chat -n 50

# Check permissions
ls -la /opt/secure-ai-chat
sudo chown -R secureai:secureai /opt/secure-ai-chat

# Check Node.js path
sudo -u secureai bash -c 'source ~/.nvm/nvm.sh && which node'
```

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process or change PORT in /etc/secure-ai-chat.env
```

### Rollback After Failed Upgrade

```bash
cd /opt/secure-ai-chat

# Find latest backup
ls -lt .backups/

# Restore previous version
git checkout <previous-commit>
cp -r .backups/upgrade-YYYYMMDD_HHMMSS/.next .next
sudo systemctl restart secure-ai-chat
```

## Security Considerations

1. **Never commit secrets**: API keys should be in `/etc/secure-ai-chat.env` or configured via Settings UI
2. **File permissions**: `.secure-storage/` should be `700` (owner read/write/execute only)
3. **Environment file**: `/etc/secure-ai-chat.env` should be `600` (owner read/write only)
4. **Service user**: Run as dedicated user (`secureai`), not root
5. **Logs**: Check logs for any secret leakage: `sudo journalctl -u secure-ai-chat | grep -i "api.*key"`

## Production Checklist

Before deploying to production:

- [ ] Release gate passes: `./scripts/release-gate.sh`
- [ ] Build succeeds: `npm run build`
- [ ] Smoke tests pass: `./scripts/smoke-test.sh`
- [ ] Environment file configured (or API keys via Settings UI)
- [ ] Systemd service enabled and running
- [ ] Firewall configured (UFW/iptables)
- [ ] SSL/TLS configured (nginx reverse proxy recommended)
- [ ] Monitoring configured (logs, health checks)
- [ ] Backup strategy in place

---

**Last Updated**: 2026-01-16  
**Version**: 1.0.11
