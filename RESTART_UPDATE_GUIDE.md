# Restart and Update Local Installation Guide

This guide explains how to restart and update your local installation to reflect all changes in the newer build.

## Quick Update Command

```bash
# From your installation directory
cd ~/secure-ai-chat
bash scripts/restart-update.sh
```

Or download and run directly:
```bash
cd ~/secure-ai-chat
bash <(curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/restart-update.sh)
```

## What the Script Does

1. **Stops the service** - Safely stops secure-ai-chat service
2. **Updates repository** - Fetches latest changes and checks out v1.0.11
3. **Updates Node.js** - Ensures correct Node.js version from .nvmrc
4. **Updates dependencies** - Runs `npm ci` or `npm install`
5. **Rebuilds application** - Runs `npm run build`
6. **Verifies secure storage** - Ensures .secure-storage directory exists
7. **Restarts service** - Restarts the systemd service
8. **Verifies health** - Checks if service is responding

## Manual Update Steps

If you prefer to update manually:

### Step 1: Stop Service

```bash
sudo systemctl stop secure-ai-chat
```

### Step 2: Update Repository

```bash
cd ~/secure-ai-chat
git fetch origin --tags
git checkout v1.0.11
```

### Step 3: Update Dependencies

```bash
# Use npm ci for reproducible builds
npm ci

# Or if that fails
npm install
```

### Step 4: Rebuild

```bash
npm run build
```

### Step 5: Restart Service

```bash
sudo systemctl start secure-ai-chat
```

### Step 6: Verify

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check health
curl http://localhost:3000/api/health

# Check version
curl http://localhost:3000/api/version
```

## Update with Custom Options

### Update to Specific Tag

```bash
cd ~/secure-ai-chat
TAG=v1.0.11 bash scripts/restart-update.sh
```

### Update to Latest Main Branch

```bash
cd ~/secure-ai-chat
TAG="" BRANCH=main bash scripts/restart-update.sh
```

### Custom Installation Directory

```bash
APP_DIR=/opt/secure-ai-chat bash scripts/restart-update.sh
```

## Verification After Update

### 1. Service Status

```bash
sudo systemctl status secure-ai-chat
```

Expected: `Active: active (running)`

### 2. Health Check

```bash
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok"}`

### 3. Version Check

```bash
curl http://localhost:3000/api/version
```

Expected: `{"version":"1.0.11"}`

### 4. Full Validation

```bash
cd ~/secure-ai-chat
bash scripts/validate-fresh-install.sh
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
sudo journalctl -u secure-ai-chat -n 100

# Common issues:
# - Build failed
# - Port already in use
# - Missing dependencies
```

### Build Fails

```bash
# Clear node_modules and rebuild
cd ~/secure-ai-chat
rm -rf node_modules .next
npm install
npm run build
```

### Dependencies Issue

```bash
# Clear cache and reinstall
cd ~/secure-ai-chat
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm run build
```

### Port Already in Use

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill the process if needed
sudo kill -9 <PID>

# Or change port in .env.local
echo "PORT=3001" >> ~/secure-ai-chat/.env.local
sudo systemctl restart secure-ai-chat
```

## What Gets Preserved

The update process preserves:
- ✅ API keys in `.secure-storage/`
- ✅ Environment variables in `.env.local`
- ✅ Uploaded files in `.storage/`
- ✅ Systemd service configuration
- ✅ Firewall rules

## What Gets Updated

The update process updates:
- ✅ Application code
- ✅ npm dependencies
- ✅ Build artifacts (`.next/`)
- ✅ Node.js version (if .nvmrc changed)

## Rollback (If Needed)

If the update causes issues:

```bash
cd ~/secure-ai-chat

# Checkout previous version
git checkout v1.0.10  # or previous working version

# Rebuild
npm ci
npm run build

# Restart
sudo systemctl restart secure-ai-chat
```

## Pre-Update Checklist

Before updating:

- [ ] Backup API keys (optional): `sudo cp -r ~/secure-ai-chat/.secure-storage ~/backup`
- [ ] Check current version: `cd ~/secure-ai-chat && git describe --tags`
- [ ] Review changelog: Check what's new in v1.0.11
- [ ] Ensure sufficient disk space: `df -h`
- [ ] Check service is running: `sudo systemctl status secure-ai-chat`

## Post-Update Checklist

After updating:

- [ ] Service is running: `sudo systemctl status secure-ai-chat`
- [ ] Health endpoint works: `curl http://localhost:3000/api/health`
- [ ] Version is correct: `curl http://localhost:3000/api/version`
- [ ] Web interface loads: Open `http://localhost:3000`
- [ ] API keys still work: Check Settings page
- [ ] Chat functionality works: Test sending a message

## Quick Reference

```bash
# Full update and restart
cd ~/secure-ai-chat && bash scripts/restart-update.sh

# Just restart service
sudo systemctl restart secure-ai-chat

# Check status
sudo systemctl status secure-ai-chat

# View logs
sudo journalctl -u secure-ai-chat -f

# Test health
curl http://localhost:3000/api/health
```

## Related Documentation

- [Fresh Install Validation](./FRESH_INSTALL_VALIDATION.md)
- [Local Installation Validation](./LOCAL_INSTALLATION_VALIDATION.md)
- [Handle Existing Installation](./HANDLE_EXISTING_INSTALLATION.md)
