# Safe Production Upgrade Guide

## Overview

This guide provides step-by-step instructions for safely upgrading a remote production instance to the latest version (including the file storage persistence hotfix) without breaking any existing functionality.

## Prerequisites

- SSH access to production VM
- Sudo privileges
- Current installation directory: `/opt/secure-ai-chat` (or your custom path)
- Backup of current installation (recommended)

## Pre-Upgrade Checklist

### 1. Verify Current Installation

```bash
# SSH into production VM
ssh user@your-production-vm

# Check current installation
cd /opt/secure-ai-chat
pwd
ls -la

# Check service status
sudo systemctl status secure-ai-chat

# Check current files
ls -la .storage/files/ 2>/dev/null || echo "No files stored yet"
cat .storage/files-metadata.json 2>/dev/null || echo "No metadata file"
```

### 2. Backup Current Installation

```bash
# Create backup directory
sudo mkdir -p /opt/backups
BACKUP_DIR="/opt/backups/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"

# Backup critical directories
sudo cp -r /opt/secure-ai-chat/.secure-storage "$BACKUP_DIR/.secure-storage" 2>/dev/null || true
sudo cp -r /opt/secure-ai-chat/.storage "$BACKUP_DIR/.storage" 2>/dev/null || true
sudo cp /opt/secure-ai-chat/.env.local "$BACKUP_DIR/.env.local" 2>/dev/null || true

# Backup package files
sudo cp /opt/secure-ai-chat/package.json "$BACKUP_DIR/package.json" 2>/dev/null || true
sudo cp /opt/secure-ai-chat/package-lock.json "$BACKUP_DIR/package-lock.json" 2>/dev/null || true

echo "Backup created at: $BACKUP_DIR"
```

### 3. Verify Service is Running

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check if app is responding
curl -s http://localhost:3000/api/health | jq . || echo "Health check failed"
```

## Upgrade Process

### Option 1: Using Upgrade Script (Recommended)

```bash
# 1. Download updated upgrade script
cd /opt/secure-ai-chat
sudo mkdir -p scripts/deploy
sudo curl -o scripts/deploy/upgrade.sh \
  https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/upgrade.sh
sudo curl -o scripts/deploy/common.sh \
  https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/common.sh

# 2. Make scripts executable
sudo chmod +x scripts/deploy/*.sh
sudo chown $(whoami):$(whoami) scripts/deploy/*.sh

# 3. Run upgrade (as regular user, NOT root)
bash scripts/deploy/upgrade.sh --app-dir /opt/secure-ai-chat --ref main
```

### Option 2: Manual Upgrade (If Script Fails)

```bash
cd /opt/secure-ai-chat

# 1. Ensure .storage directory exists with correct permissions
sudo mkdir -p .storage/files
sudo chmod 755 .storage
sudo chmod 755 .storage/files
sudo chown $(whoami):$(whoami) .storage -R

# 2. Pull latest code
git fetch origin main
git checkout main
git pull origin main

# 3. Install dependencies (preserves package-lock.json)
npm ci

# 4. Build application
npm run build

# 5. Restart service
sudo systemctl restart secure-ai-chat

# 6. Verify service is running
sudo systemctl status secure-ai-chat
```

## Post-Upgrade Verification

### 1. Service Status

```bash
# Check service is running
sudo systemctl status secure-ai-chat

# Check service logs
sudo journalctl -u secure-ai-chat -n 50 --no-pager
```

### 2. Health Check

```bash
# Check health endpoint
curl -s http://localhost:3000/api/health | jq .

# Expected output:
# {
#   "status": "healthy",
#   "timestamp": "...",
#   "version": "1.0.11"
# }
```

### 3. File Storage Verification

```bash
# Check storage directory exists and has correct permissions
ls -ld .storage
ls -ld .storage/files

# Expected permissions:
# drwxr-xr-x (755) for .storage
# drwxr-xr-x (755) for .storage/files

# Check if metadata file exists
ls -la .storage/files-metadata.json 2>/dev/null && echo "✅ Metadata file exists" || echo "⚠️ No metadata file (will be created on first upload)"

# Check current file count
ls -la .storage/files/*.dat 2>/dev/null | wc -l
```

### 4. Functional Testing

#### Test 1: File Upload
1. Go to Files page in browser
2. Upload a test file
3. Verify file is stored
4. Refresh page - file should persist

#### Test 2: Upload 10 Files
1. Go to Files page
2. Upload 10 files (should accept up to 10)
3. Verify all files are stored

#### Test 3: File Persistence After Restart
```bash
# Upload some files via UI, then:
sudo systemctl restart secure-ai-chat
# Wait 10 seconds
# Check files page - files should still be there
```

#### Test 4: RAG Functionality
1. Upload 5-10 files
2. Go to Chat page
3. Enable RAG (if toggle exists)
4. Ask a question about the files
5. Verify RAG uses file context

#### Test 5: API Keys
1. Go to Settings page
2. Verify API keys are still configured
3. Test chat with OpenAI API

## Rollback Procedure (If Issues Occur)

### Option 1: Quick Rollback (Service Only)

```bash
# Stop service
sudo systemctl stop secure-ai-chat

# Restore from backup
BACKUP_DIR="/opt/backups/secure-ai-chat-backup-YYYYMMDD-HHMMSS"  # Use your backup dir
sudo cp -r "$BACKUP_DIR/.storage" /opt/secure-ai-chat/.storage
sudo cp -r "$BACKUP_DIR/.secure-storage" /opt/secure-ai-chat/.secure-storage 2>/dev/null || true
sudo cp "$BACKUP_DIR/.env.local" /opt/secure-ai-chat/.env.local 2>/dev/null || true

# Restart service
sudo systemctl start secure-ai-chat
```

### Option 2: Full Git Rollback

```bash
cd /opt/secure-ai-chat

# Check git log for previous commit
git log --oneline -10

# Reset to previous commit (replace COMMIT_HASH with actual hash)
git reset --hard COMMIT_HASH

# Rebuild
npm ci
npm run build

# Restart service
sudo systemctl restart secure-ai-chat
```

## Troubleshooting

### Issue: Service Won't Start

```bash
# Check logs
sudo journalctl -u secure-ai-chat -n 100 --no-pager

# Check permissions
ls -ld /opt/secure-ai-chat/.storage
ls -ld /opt/secure-ai-chat/.secure-storage

# Fix permissions if needed
sudo chmod 755 /opt/secure-ai-chat/.storage
sudo chown $(whoami):$(whoami) /opt/secure-ai-chat/.storage -R
```

### Issue: Files Not Persisting

```bash
# Check directory exists and permissions
ls -ld .storage
ls -ld .storage/files

# Fix permissions
chmod 755 .storage
chmod 755 .storage/files
chown $(whoami):$(whoami) .storage -R
```

### Issue: Can't Upload 10 Files

```bash
# Verify latest code is deployed
cd /opt/secure-ai-chat
git log --oneline -5

# Check FileUploader.tsx has MAX_FILES = 10
grep "MAX_FILES" components/FileUploader.tsx
```

### Issue: API Keys Not Working

```bash
# Check .secure-storage permissions
ls -ld .secure-storage

# Verify keys exist
ls -la .secure-storage/api-keys.enc 2>/dev/null || echo "Keys not found"

# Check service can read keys
sudo systemctl restart secure-ai-chat
sudo journalctl -u secure-ai-chat -n 20 --no-pager
```

## Expected Changes After Upgrade

### File Storage
- ✅ `.storage/` directory: Mode `755` (was `700`)
- ✅ `.storage/files/` directory: Mode `755` (was `700`)
- ✅ Files: Mode `644` (explicitly set)
- ✅ Metadata: Mode `644` (explicitly set)

### File Limit
- ✅ Maximum files per upload: **10 files** (was 5)
- ✅ RAG supports up to 10 files in context

### Compatibility
- ✅ Existing files remain accessible
- ✅ API keys remain configured
- ✅ Settings remain intact
- ✅ No data loss

## Quick Reference Commands

```bash
# Full upgrade (one command)
cd /opt/secure-ai-chat && \
sudo mkdir -p scripts/deploy && \
sudo curl -o scripts/deploy/upgrade.sh https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/upgrade.sh && \
sudo curl -o scripts/deploy/common.sh https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/common.sh && \
sudo chmod +x scripts/deploy/*.sh && \
sudo chown $(whoami):$(whoami) scripts/deploy/*.sh && \
bash scripts/deploy/upgrade.sh --app-dir /opt/secure-ai-chat --ref main

# Check status after upgrade
sudo systemctl status secure-ai-chat && \
curl -s http://localhost:3000/api/health | jq . && \
ls -ld .storage .storage/files
```

## Support

If you encounter issues during upgrade:

1. Check service logs: `sudo journalctl -u secure-ai-chat -n 100`
2. Verify permissions: `ls -ld .storage .secure-storage`
3. Check health endpoint: `curl http://localhost:3000/api/health`
4. Review backup before rollback

## Version Info

- **Target Version**: v1.0.11+ (with file storage persistence hotfix)
- **Hotfix Commit**: `028e121`
- **Key Changes**: File storage persistence, 10-file limit

---

**Last Updated**: Based on latest production-ready code  
**Status**: ✅ Safe for production deployment
