# Clean Reinstallation Guide

This guide provides instructions for performing a complete clean reinstallation of Secure AI Chat v1.0.11 with all latest changes.

## Quick Clean Reinstall

```bash
# Download and run clean reinstall script
bash <(curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/clean-reinstall.sh)
```

Or if you already have the repo:
```bash
cd ~/secure-ai-chat
bash scripts/clean-reinstall.sh
```

## What the Clean Reinstall Does

1. **Stops and removes service** - Safely stops and disables systemd service
2. **Creates backup** - Backs up API keys, .env.local, and uploaded files
3. **Removes existing installation** - Completely removes old installation directory
4. **Fresh installation** - Performs clean installation with all latest changes
5. **Restores backup** - Restores your API keys and configuration
6. **Validates installation** - Runs comprehensive validation checks
7. **Verifies service** - Checks that service is running and healthy

## Manual Clean Reinstall Steps

If you prefer to do it manually:

### Step 1: Stop and Remove Service

```bash
# Stop service
sudo systemctl stop secure-ai-chat

# Disable service
sudo systemctl disable secure-ai-chat

# Remove service file
sudo rm -f /etc/systemd/system/secure-ai-chat.service
sudo systemctl daemon-reload
```

### Step 2: Backup Important Data

```bash
# Create backup directory
BACKUP_DIR=~/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)
mkdir -p $BACKUP_DIR

# Backup API keys
sudo cp -r ~/secure-ai-chat/.secure-storage $BACKUP_DIR/.secure-storage 2>/dev/null || true

# Backup .env.local
cp ~/secure-ai-chat/.env.local $BACKUP_DIR/.env.local 2>/dev/null || true

# Backup uploaded files
cp -r ~/secure-ai-chat/.storage $BACKUP_DIR/.storage 2>/dev/null || true
```

### Step 3: Remove Existing Installation

```bash
# Kill any running processes
sudo pkill -f "secure-ai-chat" || true

# Remove directory
rm -rf ~/secure-ai-chat
```

### Step 4: Fresh Installation

```bash
# Run installation script
CLEAN_INSTALL=true TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh | bash
```

### Step 5: Restore Backup

```bash
cd ~/secure-ai-chat

# Restore API keys
sudo cp -r $BACKUP_DIR/.secure-storage .secure-storage
sudo chmod 700 .secure-storage
sudo chmod 600 .secure-storage/*.enc 2>/dev/null || true

# Restore .env.local
cp $BACKUP_DIR/.env.local .env.local

# Restore uploaded files
cp -r $BACKUP_DIR/.storage .storage 2>/dev/null || true
```

### Step 6: Validate

```bash
cd ~/secure-ai-chat
bash scripts/validate-fresh-install.sh
```

## Custom Options

### Custom Installation Directory

```bash
INSTALL_DIR=/opt bash <(curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/clean-reinstall.sh)
```

### Custom Version/Tag

```bash
TAG=v1.0.11 bash <(curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/clean-reinstall.sh)
```

## What Gets Preserved

The clean reinstall script automatically backs up and restores:

- ✅ **API Keys** - All API keys from `.secure-storage/`
- ✅ **Environment Variables** - `.env.local` configuration
- ✅ **Uploaded Files** - Files in `.storage/` directory

## What Gets Replaced

The clean reinstall replaces:

- ✅ **Application Code** - Fresh code from repository
- ✅ **Dependencies** - Fresh npm packages
- ✅ **Build Artifacts** - Fresh `.next/` build
- ✅ **Service Configuration** - Fresh systemd service

## Verification After Reinstall

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

### 4. API Keys Status

```bash
curl http://localhost:3000/api/keys
```

Should show your restored API keys as configured.

### 5. Web Interface

Open `http://localhost:3000` and verify:
- ✅ Home page loads
- ✅ Settings page shows API keys (if restored)
- ✅ Chat page works
- ✅ Files page works

## Troubleshooting

### Service Won't Start

```bash
# Check logs
sudo journalctl -u secure-ai-chat -n 100

# Common fixes:
# 1. Check if port is in use
sudo lsof -i :3000

# 2. Rebuild if needed
cd ~/secure-ai-chat
npm run build
sudo systemctl restart secure-ai-chat
```

### API Keys Not Restored

```bash
# Check backup
ls -la ~/secure-ai-chat-backup-*/

# Manually restore
sudo cp -r ~/secure-ai-chat-backup-*/.secure-storage ~/secure-ai-chat/.secure-storage
sudo chmod 700 ~/secure-ai-chat/.secure-storage
sudo systemctl restart secure-ai-chat
```

### Build Fails

```bash
cd ~/secure-ai-chat

# Clear and rebuild
rm -rf node_modules .next
npm install
npm run build
```

## Backup Location

Backups are stored in:
```
~/secure-ai-chat-backup-YYYYMMDD-HHMMSS/
```

After verifying everything works, you can remove the backup:
```bash
rm -rf ~/secure-ai-chat-backup-*
```

## Comparison: Clean Reinstall vs Update

### Clean Reinstall
- ✅ Removes everything and starts fresh
- ✅ Ensures no leftover files or configurations
- ✅ Best for major version changes
- ✅ Resolves persistent issues
- ⚠️ Requires backup/restore of data

### Update (restart-update.sh)
- ✅ Faster (only updates changed files)
- ✅ Preserves everything automatically
- ✅ Best for minor updates
- ✅ Less disruptive

**Use clean reinstall when:**
- You're experiencing persistent issues
- Major version upgrade
- Want to start completely fresh
- Installation is corrupted

**Use update when:**
- Just need latest code changes
- Everything is working fine
- Quick update needed

## Complete Clean Reinstall Command

```bash
# One command to do everything
bash <(curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/clean-reinstall.sh)
```

This will:
1. Stop service
2. Backup your data
3. Remove old installation
4. Install fresh
5. Restore your data
6. Validate installation
7. Start service

## Post-Reinstall Checklist

- [ ] Service is running
- [ ] Health endpoint responds
- [ ] Version is 1.0.11
- [ ] API keys are restored
- [ ] Web interface loads
- [ ] Chat functionality works
- [ ] File upload works
- [ ] Validation script passes
- [ ] Backup can be removed (after verification)

## Related Documentation

- [Fresh Install Validation](./FRESH_INSTALL_VALIDATION.md)
- [Restart Update Guide](./RESTART_UPDATE_GUIDE.md)
- [Handle Existing Installation](./HANDLE_EXISTING_INSTALLATION.md)
- [Local Installation Validation](./LOCAL_INSTALLATION_VALIDATION.md)
