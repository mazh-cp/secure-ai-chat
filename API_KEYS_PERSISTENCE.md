# API Keys Persistence Across Upgrades and Reboots

## 🔒 Guaranteed Persistence

All API keys are **guaranteed to persist** across:
- ✅ System reboots
- ✅ Application restarts
- ✅ Version upgrades
- ✅ Code deployments
- ✅ Git pull operations

## 📁 Storage Location

All API keys are stored in the **`.secure-storage/`** directory at the project root:

```
/home/adminuser/secure-ai-chat/.secure-storage/
├── api-keys.enc              # OpenAI, Lakera AI, Lakera Project ID, Lakera Endpoint
├── checkpoint-te-key.enc     # Check Point TE API key
├── verification-pin.hash     # PIN for key removal protection
└── system-logs.json          # System logs (non-sensitive)
```

## 🔐 Encryption

All keys are **encrypted at rest** using AES-256-CBC:
- **OpenAI API Key**: Encrypted in `api-keys.enc`
- **Lakera AI API Key**: Encrypted in `api-keys.enc`
- **Lakera Project ID**: Encrypted in `api-keys.enc`
- **Lakera Endpoint**: Encrypted in `api-keys.enc`
- **Check Point TE API Key**: Encrypted in `checkpoint-te-key.enc`
- **Verification PIN**: Hashed (PBKDF2) in `verification-pin.hash`

## 🛡️ Protection Mechanisms

### 1. Directory Permissions
- **`.secure-storage/`**: `700` (owner read/write/execute only)
- **Encrypted files**: `600` (owner read/write only)
- **Hash files**: `600` (owner read/write only)

### 2. Git Exclusion
- `.secure-storage/` is in `.gitignore` - **never committed to git**
- Keys are **never exposed** in version control

### 3. Upgrade Script Protection
The upgrade script (`scripts/upgrade-production.sh`) includes:
- ✅ **Backup** of `.secure-storage/` before upgrade
- ✅ **Preservation** of `.secure-storage/` during upgrade
- ✅ **Permission restoration** after upgrade
- ✅ **Verification** that keys exist after upgrade

### 4. Build Process Protection
- `.secure-storage/` is **never touched** during `npm run build`
- Next.js build process only affects `.next/` directory
- No cleanup scripts delete `.secure-storage/`

## 📋 Upgrade Process

When you run an upgrade:

1. **Backup Created**: `.secure-storage/` is backed up to `.backups/`
2. **Code Updated**: Git pulls latest code
3. **Dependencies Installed**: `npm ci` (doesn't touch `.secure-storage/`)
4. **Application Built**: `npm run build` (only affects `.next/`)
5. **Keys Preserved**: `.secure-storage/` remains untouched
6. **Permissions Restored**: Directory permissions verified
7. **Verification**: Script confirms keys still exist

## 🔍 Verification Commands

### Check if keys exist:
```bash
cd /home/adminuser/secure-ai-chat
ls -la .secure-storage/
```

### Check permissions:
```bash
stat -c '%a %n' .secure-storage/
stat -c '%a %n' .secure-storage/*.enc
```

### Verify keys after upgrade:
```bash
# After upgrade, check API endpoints
curl http://localhost:3000/api/keys
curl http://localhost:3000/api/te/config
```

## ⚠️ Important Notes

### What is Preserved:
- ✅ All API keys (OpenAI, Lakera AI, Check Point TE)
- ✅ Lakera Project ID
- ✅ Lakera Endpoint
- ✅ Verification PIN
- ✅ System logs

### What is NOT Preserved:
- ❌ Uploaded files (stored in `.storage/`, cleared every 24 hours)
- ❌ RAG embeddings (recreated from files)
- ❌ Build cache (`.next/` is rebuilt)

### Manual Backup (Recommended):
Before major upgrades, manually backup keys:
```bash
cd /home/adminuser/secure-ai-chat
tar -czf secure-storage-backup-$(date +%Y%m%d).tar.gz .secure-storage/
# Store backup in safe location
```

### Restore from Backup:
```bash
cd /home/adminuser/secure-ai-chat
tar -xzf secure-storage-backup-YYYYMMDD.tar.gz
chmod 700 .secure-storage/
chmod 600 .secure-storage/*.enc
chmod 600 .secure-storage/*.hash
```

## 🚨 Troubleshooting

### Keys Missing After Upgrade

If keys are missing after upgrade:

1. **Check backup**:
   ```bash
   ls -la .backups/
   ```

2. **Restore from backup**:
   ```bash
   cd /home/adminuser/secure-ai-chat
   tar -xzf .backups/backup-YYYYMMDD-HHMMSS-*.tar.gz .secure-storage/
   chmod 700 .secure-storage/
   chmod 600 .secure-storage/*.enc
   ```

3. **Verify permissions**:
   ```bash
   chmod 700 .secure-storage/
   find .secure-storage -type f -exec chmod 600 {} \;
   ```

### Permission Issues

If you get permission errors:
```bash
cd /home/adminuser/secure-ai-chat
sudo chown -R adminuser:adminuser .secure-storage/
chmod 700 .secure-storage/
find .secure-storage -type f -exec chmod 600 {} \;
```

## 📝 Summary

**Your API keys are safe!** The `.secure-storage/` directory is:
- ✅ Excluded from git
- ✅ Backed up during upgrades
- ✅ Preserved during all operations
- ✅ Encrypted at rest
- ✅ Protected by file permissions

**No action required** - keys persist automatically across all upgrades and reboots.

---

**Last Updated**: January 2026  
**Version**: 1.0.5
