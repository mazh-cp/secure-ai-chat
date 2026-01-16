# Production Upgrade - Remote Script

## Quick Start

### One-Command Upgrade (Recommended)

SSH into your production VM and run:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-production.sh | bash
```

This script will:
- ✅ Create automatic backup
- ✅ Download latest upgrade scripts
- ✅ Stop service safely
- ✅ Run upgrade with all hotfixes
- ✅ Fix storage permissions for file persistence
- ✅ Restart service
- ✅ Verify upgrade success

## What Gets Upgraded

### Hotfixes Included
1. **File Storage Persistence** (0o755 directories, 0o644 files)
2. **10-File Upload Limit** (was 5)
3. **Storage Permissions Fix** (ensures files persist after restarts)

### Latest Features
- All bug fixes and enhancements
- Improved error handling
- Better diagnostics
- Rollback support on failure

## Custom Configuration

### Custom App Directory

```bash
APP_DIR=/custom/path curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-production.sh | bash
```

### Custom Git Reference (Tag/Branch)

```bash
GIT_REF=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-production.sh | bash
```

## Manual Steps (Alternative)

If you prefer manual control:

```bash
# 1. SSH into production VM
ssh user@your-production-vm

# 2. Navigate to app directory
cd /opt/secure-ai-chat

# 3. Download upgrade scripts
sudo mkdir -p scripts/deploy
sudo curl -o scripts/deploy/upgrade.sh \
  https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/upgrade.sh
sudo curl -o scripts/deploy/common.sh \
  https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/common.sh
sudo chmod +x scripts/deploy/*.sh
sudo chown $(whoami):$(whoami) scripts/deploy/*.sh

# 4. Run upgrade
bash scripts/deploy/upgrade.sh --app-dir /opt/secure-ai-chat --ref main
```

## Post-Upgrade Verification

After upgrade, verify everything is working:

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check health endpoint
curl -s http://localhost:3000/api/health | jq .

# Check storage permissions
ls -ld .storage .storage/files

# Expected output:
# drwxr-xr-x (755) for .storage
# drwxr-xr-x (755) for .storage/files
```

## Rollback (If Needed)

If issues occur, rollback from backup:

```bash
# Find backup directory
ls -la /opt/backups/

# Restore from backup
BACKUP_DIR="/opt/backups/secure-ai-chat-backup-YYYYMMDD-HHMMSS"  # Use your backup
sudo cp -r "$BACKUP_DIR/.storage" /opt/secure-ai-chat/.storage
sudo cp -r "$BACKUP_DIR/.secure-storage" /opt/secure-ai-chat/.secure-storage 2>/dev/null || true
sudo cp "$BACKUP_DIR/.env.local" /opt/secure-ai-chat/.env.local 2>/dev/null || true

# Restart service
sudo systemctl restart secure-ai-chat
```

## Troubleshooting

### Error: "App directory does not exist"

```bash
# Check current directory
pwd

# Verify app directory path
ls -la /opt/secure-ai-chat
```

### Error: "Service won't start"

```bash
# Check logs
sudo journalctl -u secure-ai-chat -n 100 --no-pager

# Check permissions
ls -ld .storage .secure-storage
```

### Error: "Files not persisting"

```bash
# Fix storage permissions manually
chmod 755 .storage
chmod 755 .storage/files
chown $(whoami):$(whoami) .storage -R
```

## Expected Changes

### File Storage
- `.storage/` directory: Mode `755` (persistent after restarts)
- `.storage/files/` directory: Mode `755` (persistent after restarts)
- Files: Mode `644` (accessible after restarts)
- Metadata: Mode `644` (accessible after restarts)

### File Limit
- Maximum files per upload: **10 files** (was 5)
- RAG supports up to 10 files in context

## Features

- ✅ **Automatic Backup**: Creates backup before upgrade
- ✅ **Permission Fixes**: Ensures storage directories have correct permissions
- ✅ **Service Handling**: Safely stops/starts systemd service
- ✅ **Health Verification**: Checks health endpoint after upgrade
- ✅ **Rollback Support**: Backup available for quick rollback
- ✅ **Non-Breaking**: Preserves existing files, API keys, settings

## Support

If you encounter issues:

1. Check service logs: `sudo journalctl -u secure-ai-chat -n 100`
2. Verify permissions: `ls -ld .storage .storage/files`
3. Check health endpoint: `curl http://localhost:3000/api/health`
4. Review backup location: `/opt/backups/`

## Version Info

- **Target Version**: v1.0.11+ (with file storage persistence hotfix)
- **Hotfix Commits**: `028e121`, `547ea85`
- **Key Changes**: File storage persistence, 10-file limit, permission fixes

---

**Last Updated**: Based on latest production-ready code  
**Status**: ✅ Ready for production deployment
