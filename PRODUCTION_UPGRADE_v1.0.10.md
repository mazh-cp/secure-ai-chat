# Production Upgrade Guide - v1.0.10

**Date:** January 13, 2025  
**Version:** 1.0.10  
**Status:** ✅ Ready for Production Upgrade (PR #3 Merged to Main)

---

## 🎯 Upgrade Overview

This guide explains how to upgrade your remote production installation to version 1.0.10, which includes:
- Enhanced RAG System (automatic file indexing, intelligent content search)
- Dynamic Release Notes (loads from CHANGELOG.md)
- API Errors & Key Failures section in Logs
- Lakera Guard API v2 enhancements (payload & breakdown data)

**✅ PR Status:** PR #3 has been merged to `main` branch. All v1.0.10 features are now available on `main`.

---

## 📋 Pre-Upgrade Checklist

Before starting the upgrade:

- [ ] **Backup verification**: Current installation has backups enabled
- [ ] **Service status**: Check current version and service status
- [ ] **Maintenance window**: Plan for brief downtime (2-5 minutes)
- [ ] **API keys**: Ensure you have API keys backed up (script does this automatically)
- [ ] **Test environment**: If possible, test upgrade on staging first

**Check current version:**
```bash
curl http://YOUR_SERVER_IP/api/version
# Or if behind nginx:
curl http://YOUR_SERVER_IP/api/version
```

---

## 🚀 Automatic Upgrade (Recommended)

**✅ PR #3 has been merged to `main` branch. All v1.0.10 features are available.**

**Single command upgrade:**
```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade_remote.sh | bash
```

**What this does:**
1. ✅ Creates automatic backup of all settings
2. ✅ Pulls latest code from `main` branch (includes v1.0.10)
3. ✅ Preserves all API keys (`.env.local` and `.secure-storage`)
4. ✅ Updates dependencies (`npm ci`)
5. ✅ Rebuilds application (`npm run build`)
6. ✅ Restarts service
7. ✅ Verifies upgrade success

**Upgrade time:** 2-5 minutes  
**Downtime:** Minimal (service restart only)

---

## 🔧 Manual Upgrade (Alternative Method)

If you prefer to upgrade manually or need more control:

```bash
# On remote server
cd /opt/secure-ai-chat

# Create backup
BACKUP_DIR="/opt/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"
sudo cp -a .env.local "$BACKUP_DIR/.env.local" 2>/dev/null || true
sudo cp -a .secure-storage "$BACKUP_DIR/.secure-storage" 2>/dev/null || true
sudo cp -a .storage "$BACKUP_DIR/.storage" 2>/dev/null || true
echo "Backup created at: $BACKUP_DIR"

# Stop service
sudo systemctl stop secure-ai-chat

# Pull latest code from main (includes v1.0.10)
sudo -u secureai git fetch origin
sudo -u secureai git pull origin main

# Install dependencies
sudo -u secureai bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci
EOF

# Build application
sudo -u secureai bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm run build
EOF

# Start service
sudo systemctl start secure-ai-chat
sudo systemctl status secure-ai-chat

# Verify upgrade
sleep 3
curl http://localhost:3000/api/version
curl http://localhost:3000/api/health
```

---

## ✅ Post-Upgrade Verification

After the upgrade completes, verify everything is working:

### 1. Check Version
```bash
curl http://localhost:3000/api/version
# Expected: {"version":"1.0.10","name":"secure-ai-chat"}
```

### 2. Check Health
```bash
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"...","service":"secure-ai-chat"}
```

### 3. Check Service Status
```bash
sudo systemctl status secure-ai-chat
# Should show: active (running)
```

### 4. Check Logs
```bash
sudo journalctl -u secure-ai-chat -n 50 --no-pager
# Look for any errors or warnings
```

### 5. Test Application Features
- [ ] **Chat Interface**: Send a test message
- [ ] **File Upload**: Upload a test file and verify scanning
- [ ] **RAG Functionality**: Upload a file, then ask questions about it in chat
- [ ] **Release Notes**: Visit `/release-notes` and verify it loads dynamically
- [ ] **Logs Viewer**: Check `/dashboard` → Logs section → API Errors section
- [ ] **Settings**: Verify API keys are still configured

---

## 🔧 Troubleshooting

### Service Fails to Start

**Check logs:**
```bash
sudo journalctl -u secure-ai-chat -n 50 --no-pager
```

**Common issues:**

1. **Node.js path changed**
   ```bash
   # Find correct Node.js path
   sudo -u secureai bash -c 'export HOME=/opt/secure-ai-chat && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && which npm'
   
   # Update service file if needed
   sudo nano /etc/systemd/system/secure-ai-chat.service
   # Update ExecStart path
   sudo systemctl daemon-reload
   sudo systemctl restart secure-ai-chat
   ```

2. **Build errors**
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

3. **Permission issues**
   ```bash
   sudo chown -R secureai:secureai /opt/secure-ai-chat
   sudo systemctl restart secure-ai-chat
   ```

### Version Not Updated

If version endpoint still shows old version:
1. Check that build completed successfully
2. Verify service restarted (check logs)
3. Clear browser cache and try again
4. Check that you're on the correct branch/tag

### API Keys Not Working

**Important:** The upgrade script preserves all API keys automatically. If keys are missing:

1. Check backup directory:
   ```bash
   ls -la /opt/secure-ai-chat-backup-*/
   ```

2. Restore from backup if needed:
   ```bash
   BACKUP_DIR="/opt/secure-ai-chat-backup-YYYYMMDD-HHMMSS"
   sudo cp -a "$BACKUP_DIR/.env.local" /opt/secure-ai-chat/.env.local
   sudo cp -a "$BACKUP_DIR/.secure-storage" /opt/secure-ai-chat/.secure-storage
   sudo chown -R secureai:secureai /opt/secure-ai-chat/.secure-storage
   sudo systemctl restart secure-ai-chat
   ```

---

## 🔄 Rollback Procedure

If the upgrade causes issues, you can rollback:

```bash
# Stop service
sudo systemctl stop secure-ai-chat

# Restore from backup
BACKUP_DIR="/opt/secure-ai-chat-backup-YYYYMMDD-HHMMSS"  # Use your backup directory
sudo cp -a "$BACKUP_DIR/.env.local" /opt/secure-ai-chat/.env.local
sudo cp -a "$BACKUP_DIR/.secure-storage" /opt/secure-ai-chat/.secure-storage
sudo chown -R secureai:secureai /opt/secure-ai-chat/.secure-storage

# Checkout previous version (e.g., v1.0.9 or main)
cd /opt/secure-ai-chat
sudo -u secureai git checkout v1.0.9  # Or: git checkout main

# Rebuild
sudo -u secureai bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci
npm run build
EOF

# Start service
sudo systemctl start secure-ai-chat

# Verify
curl http://localhost:3000/api/version
```

---

## 📊 Upgrade Summary

**Version:** 1.0.10  
**Branch:** `main` (PR #3 merged)  
**Previous Version:** (varies, typically 1.0.9 or 1.0.8)  
**Upgrade Time:** 2-5 minutes  
**Downtime:** Minimal (service restart only)  
**Data Loss Risk:** None (all settings preserved)  
**PR Status:** ✅ Merged to main

**What's Preserved:**
- ✅ All API keys (`.env.local` and `.secure-storage`)
- ✅ All uploaded files (`.storage/`)
- ✅ All user preferences
- ✅ All configurations

**What's Updated:**
- ✅ Application code (enhanced RAG system)
- ✅ Dynamic Release Notes API
- ✅ API Errors & Key Failures in Logs
- ✅ Lakera Guard API v2 enhancements
- ✅ Dependencies (if changed)
- ✅ Build artifacts (`.next/` directory)

---

## 📝 Post-Upgrade Checklist

After successful upgrade:

- [ ] Version shows 1.0.10
- [ ] Service is running
- [ ] Health endpoint responds
- [ ] Chat functionality works
- [ ] File upload works
- [ ] RAG functionality works (chat queries uploaded files)
- [ ] Release Notes page loads dynamically
- [ ] Logs viewer shows API Errors section
- [ ] Settings page shows API keys correctly
- [ ] No errors in logs

---

## 🆘 Support

If you encounter issues:

1. **Check logs first:**
   ```bash
   sudo journalctl -u secure-ai-chat -f
   ```

2. **Review troubleshooting section** above

3. **Check backup directory** for recovery options

4. **GitHub Issues:** https://github.com/mazh-cp/secure-ai-chat/issues

---

## 📚 Related Documentation

- [UPGRADE_REMOTE.md](docs/UPGRADE_REMOTE.md) - General upgrade guide
- [RELEASE_v1.0.10.md](RELEASE_v1.0.10.md) - Release notes
- [USER_GUIDE_RAG.md](docs/USER_GUIDE_RAG.md) - RAG system user guide
- [INSTALL_UBUNTU_VM.md](docs/INSTALL_UBUNTU_VM.md) - Installation guide

---

**Last Updated:** January 13, 2025  
**Release:** v1.0.10
