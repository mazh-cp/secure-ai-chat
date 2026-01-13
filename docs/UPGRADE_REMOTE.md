# Safe Remote Upgrade Guide

This guide explains how to safely upgrade your remote Secure AI Chat installation from version 1.0.7 to 1.0.8 (or any future version) without losing any settings or API keys.

## Quick Upgrade (Recommended)

**Single-command upgrade:**

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade_remote.sh | bash
```

This script will:
- ✅ Create automatic backup of all settings
- ✅ Pull latest code from repository
- ✅ Preserve all API keys (`.env.local` and `.secure-storage`)
- ✅ Update dependencies
- ✅ Rebuild application
- ✅ Restart service
- ✅ Verify upgrade success

## What Gets Preserved

The upgrade script automatically backs up and restores:

1. **`.env.local`** - All environment variables and API keys
   - `OPENAI_API_KEY`
   - `LAKERA_AI_KEY`
   - `LAKERA_ENDPOINT`
   - `LAKERA_PROJECT_ID`
   - `PORT`
   - `HOSTNAME`
   - All other custom settings

2. **`.secure-storage/`** - Server-side encrypted API keys
   - Check Point TE API key (encrypted)
   - Any other server-side stored keys

3. **`.storage/`** - Application storage
   - File metadata
   - User preferences

## Manual Upgrade Steps

If you prefer to upgrade manually:

### Step 1: Create Backup

```bash
# Create backup directory
BACKUP_DIR="/opt/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"

# Backup critical files
sudo cp -a /opt/secure-ai-chat/.env.local "$BACKUP_DIR/.env.local"
sudo cp -a /opt/secure-ai-chat/.secure-storage "$BACKUP_DIR/.secure-storage" 2>/dev/null || true
sudo cp -a /opt/secure-ai-chat/.storage "$BACKUP_DIR/.storage" 2>/dev/null || true

echo "Backup created at: $BACKUP_DIR"
```

### Step 2: Stop Service

```bash
sudo systemctl stop secure-ai-chat
```

### Step 3: Pull Latest Code

```bash
cd /opt/secure-ai-chat
sudo -u secureai git fetch origin
sudo -u secureai git pull origin main
# Or if using a different branch:
# sudo -u secureai git pull origin release/1.0.8
```

### Step 4: Install Dependencies

```bash
cd /opt/secure-ai-chat
sudo -u secureai bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci
EOF
```

### Step 5: Build Application

```bash
cd /opt/secure-ai-chat
sudo -u secureai bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm run build
EOF
```

### Step 6: Restart Service

```bash
sudo systemctl start secure-ai-chat
sudo systemctl status secure-ai-chat
```

### Step 7: Verify Upgrade

```bash
# Check version
curl http://localhost:3000/api/version

# Check health
curl http://localhost:3000/api/health

# Check service status
sudo systemctl status secure-ai-chat
```

## Troubleshooting

### Service Fails to Start After Upgrade

**Check logs:**
```bash
sudo journalctl -u secure-ai-chat -n 50
```

**Common causes:**
1. **Node.js path changed** - Update systemd service file:
   ```bash
   # Find new Node.js path
   sudo -u secureai bash -c 'export HOME=/opt/secure-ai-chat && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && which npm'
   
   # Update service file
   sudo nano /etc/systemd/system/secure-ai-chat.service
   # Update ExecStart path
   sudo systemctl daemon-reload
   sudo systemctl restart secure-ai-chat
   ```

2. **Build errors** - Rebuild manually:
   ```bash
   cd /opt/secure-ai-chat
   sudo -u secureai bash << 'EOF'
   export HOME=/opt/secure-ai-chat
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   rm -rf .next
   npm run build
   EOF
   sudo systemctl restart secure-ai-chat
   ```

3. **Permission issues** - Fix ownership:
   ```bash
   sudo chown -R secureai:secureai /opt/secure-ai-chat
   sudo systemctl restart secure-ai-chat
   ```

### Rollback to Previous Version

If the upgrade fails, you can rollback:

```bash
# Stop service
sudo systemctl stop secure-ai-chat

# Restore from backup
BACKUP_DIR="/opt/secure-ai-chat-backup-YYYYMMDD-HHMMSS"  # Use your backup directory
sudo cp -a "$BACKUP_DIR/.env.local" /opt/secure-ai-chat/.env.local
sudo cp -a "$BACKUP_DIR/.secure-storage" /opt/secure-ai-chat/.secure-storage
sudo chown -R secureai:secureai /opt/secure-ai-chat/.secure-storage

# Checkout previous version
cd /opt/secure-ai-chat
sudo -u secureai git checkout v1.0.7  # Or previous version tag

# Rebuild
sudo -u secureai bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci
npm run build
EOF

# Restart service
sudo systemctl start secure-ai-chat
```

## Upgrade Checklist

Before upgrading:
- [ ] Verify current version: `curl http://localhost:3000/api/version`
- [ ] Check service is running: `sudo systemctl status secure-ai-chat`
- [ ] Note current port (if custom): `grep PORT /opt/secure-ai-chat/.env.local`

After upgrading:
- [ ] Verify new version: `curl http://localhost:3000/api/version`
- [ ] Check service status: `sudo systemctl status secure-ai-chat`
- [ ] Test health endpoint: `curl http://localhost:3000/api/health`
- [ ] Test application in browser
- [ ] Verify API keys still work (test chat/file upload)
- [ ] Check logs for errors: `sudo journalctl -u secure-ai-chat -f`

## Version-Specific Upgrade Notes

### Upgrading to 1.0.8

**New features:**
- Ubuntu VM installation scripts
- Auto-port detection
- Improved nginx configuration

**No breaking changes** - All settings and API keys are preserved.

## Best Practices

1. **Always backup before upgrading** - The upgrade script does this automatically
2. **Upgrade during maintenance window** - Brief downtime during upgrade
3. **Test after upgrade** - Verify all functionality works
4. **Keep backups** - Don't delete backup immediately, keep for a few days
5. **Monitor logs** - Watch logs after upgrade for any issues

## Support

If you encounter issues during upgrade:
1. Check logs: `sudo journalctl -u secure-ai-chat -n 100`
2. Review troubleshooting section above
3. Check [INSTALL_UBUNTU_VM.md](INSTALL_UBUNTU_VM.md) for installation details
