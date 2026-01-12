# Production Key Security Guide

## Overview

This document ensures that API keys are:
1. ✅ **Never committed to GitHub** - All key storage is excluded from git
2. ✅ **Persistent across restarts** - Keys survive server restarts and upgrades
3. ✅ **Encrypted at rest** - All keys are encrypted before storage
4. ✅ **Properly secured** - File permissions restrict access

## Key Storage Location

All API keys are stored in the **`.secure-storage/`** directory at the project root:

```
secure-ai-chat/
├── .secure-storage/              # ← API keys stored here (NEVER in git)
│   ├── api-keys.enc              # Encrypted: OpenAI, Lakera AI keys
│   ├── checkpoint-te-key.enc     # Encrypted: Check Point TE API key
│   ├── verification-pin.hash      # Hashed: PIN for key deletion
│   └── system-logs.json          # System logs (non-sensitive)
```

## Git Exclusion

### ✅ Verified: Keys are NOT in Git

The `.secure-storage/` directory is **explicitly excluded** in `.gitignore`:

```gitignore
# Secure storage (encrypted files, PIN hashes, system logs)
.secure-storage/
```

### Verification Commands

Run these commands to verify keys are not in git:

```bash
# Check if .secure-storage/ is ignored
git check-ignore .secure-storage/

# Verify no secure files are tracked
git ls-files | grep -E "\.secure-storage|api-keys|checkpoint-te-key|\.enc"

# Run automated security check
./scripts/verify-key-security.sh
```

## Key Persistence Across Restarts

### How Keys Persist

1. **File System Storage**: Keys are written to encrypted files in `.secure-storage/`
2. **Automatic Loading**: Keys are loaded from disk on server startup
3. **In-Memory Cache**: Keys are cached in memory for performance
4. **Fallback Mechanism**: If cache is empty, keys are reloaded from disk

### Storage Implementation

**Check Point TE Key** (`lib/checkpoint-te.ts`):
- Saves to: `.secure-storage/checkpoint-te-key.enc`
- Loads on: Module initialization and API calls
- Persists: Across all restarts and upgrades

**API Keys** (`lib/api-keys-storage.ts`):
- Saves to: `.secure-storage/api-keys.enc`
- Loads on: Module initialization and API calls
- Persists: Across all restarts and upgrades

### Upgrade Script Protection

The production upgrade script (`scripts/upgrade-production.sh`) explicitly preserves `.secure-storage/`:

```bash
# Backup .secure-storage before upgrade
tar -czf backup.tar.gz .secure-storage .next package.json

# Ensure .secure-storage exists after upgrade
if [ ! -d ".secure-storage" ]; then
    mkdir -p .secure-storage
    chmod 700 .secure-storage
fi

# Verify keys preserved
if [ -d ".secure-storage" ]; then
    KEY_COUNT=$(find .secure-storage -type f -name "*.enc" | wc -l)
    echo "✅ API keys preserved: Found $KEY_COUNT encrypted file(s)"
fi
```

## Encryption

### Encryption Method

- **Algorithm**: AES-256-CBC
- **Key Derivation**: SHA-256 hash of environment variable or default secret
- **IV**: Random 16-byte IV prepended to encrypted data
- **Format**: `iv:encrypted_data` (hex encoded)

### Encryption Key Sources (Priority Order)

1. **Environment Variable** (Recommended for production):
   ```bash
   export CHECKPOINT_TE_ENCRYPTION_KEY="your-secure-32-byte-key"
   export API_KEYS_ENCRYPTION_KEY="your-secure-32-byte-key"
   ```

2. **Default Secret** (Fallback - less secure):
   - Used if environment variable not set
   - Should be replaced with environment variable in production

## File Permissions

### Directory Permissions

```bash
# .secure-storage/ directory
chmod 700 .secure-storage/  # Owner read/write/execute only
```

### File Permissions

```bash
# Encrypted key files
chmod 600 .secure-storage/*.enc  # Owner read/write only
chmod 600 .secure-storage/*.hash # Owner read/write only
```

### Automatic Permission Setting

The storage code automatically sets correct permissions:

```typescript
// Directory creation
await fs.mkdir(STORAGE_DIR, { recursive: true, mode: 0o700 })

// File writing
await fs.writeFile(KEY_FILE_PATH, encryptedKey, { mode: 0o600 })
```

## Production Deployment Checklist

### Before Deployment

- [ ] Verify `.secure-storage/` is in `.gitignore`
- [ ] Run `./scripts/verify-key-security.sh` to check for issues
- [ ] Ensure no keys are hardcoded in source code
- [ ] Set encryption keys as environment variables

### During Deployment

- [ ] Backup existing `.secure-storage/` directory
- [ ] Preserve `.secure-storage/` during code updates
- [ ] Verify file permissions after deployment
- [ ] Test key loading after restart

### After Deployment

- [ ] Verify keys are accessible via API endpoints
- [ ] Check that keys persist after server restart
- [ ] Monitor for any security warnings
- [ ] Document encryption key location (if using env vars)

## Restart & Upgrade Safety

### Server Restart

Keys automatically reload from disk:
1. Server stops → Keys remain in `.secure-storage/`
2. Server starts → Keys load from `.secure-storage/`
3. API calls work → Keys available immediately

### Version Upgrade

Keys are preserved during upgrades:
1. **Backup**: `.secure-storage/` backed up before upgrade
2. **Preserve**: `.secure-storage/` never deleted during upgrade
3. **Restore**: If missing, directory recreated with correct permissions
4. **Verify**: Upgrade script confirms keys are present

### Upgrade Script Flow

```bash
# 1. Backup
tar -czf backup.tar.gz .secure-storage .next package.json

# 2. Upgrade code
git pull
npm ci

# 3. Preserve keys
if [ ! -d ".secure-storage" ]; then
    mkdir -p .secure-storage
    chmod 700 .secure-storage
fi

# 4. Verify
KEY_COUNT=$(find .secure-storage -type f -name "*.enc" | wc -l)
echo "✅ Found $KEY_COUNT encrypted file(s)"
```

## Security Best Practices

### ✅ DO

- Use environment variables for encryption keys in production
- Regularly backup `.secure-storage/` directory
- Monitor file permissions
- Run security verification script before commits
- Use strong encryption keys (32+ bytes)

### ❌ DON'T

- Commit `.secure-storage/` to git
- Hardcode API keys in source code
- Share encryption keys in documentation
- Use default encryption keys in production
- Store keys in environment variables that are logged

## Troubleshooting

### Keys Not Persisting After Restart

1. **Check file exists**:
   ```bash
   ls -la .secure-storage/*.enc
   ```

2. **Check permissions**:
   ```bash
   stat -c "%a %n" .secure-storage/
   stat -c "%a %n" .secure-storage/*.enc
   ```

3. **Check file content**:
   ```bash
   # Should show encrypted data (not plaintext)
   head -1 .secure-storage/checkpoint-te-key.enc
   ```

4. **Check server logs** for loading errors

### Keys Missing After Upgrade

1. **Restore from backup**:
   ```bash
   tar -xzf .backups/backup-*.tar.gz .secure-storage/
   chmod 700 .secure-storage/
   chmod 600 .secure-storage/*.enc
   ```

2. **Recreate if needed**:
   ```bash
   mkdir -p .secure-storage
   chmod 700 .secure-storage
   # Re-enter keys via Settings page
   ```

## Verification Script

Run the automated security check:

```bash
./scripts/verify-key-security.sh
```

This script checks:
- ✅ `.secure-storage/` in `.gitignore`
- ✅ No secure files in git
- ✅ No hardcoded API keys
- ✅ Correct file permissions
- ✅ Storage persistence mechanism

## Summary

**Keys are safe because:**
1. ✅ Excluded from git (`.gitignore`)
2. ✅ Encrypted at rest (AES-256-CBC)
3. ✅ Proper file permissions (700/600)
4. ✅ Persist across restarts (file system)
5. ✅ Preserved during upgrades (backup/restore)
6. ✅ Server-side only (never exposed to client)

**Your keys will:**
- ✅ Never be committed to GitHub
- ✅ Survive server restarts
- ✅ Persist through version upgrades
- ✅ Remain encrypted and secure
