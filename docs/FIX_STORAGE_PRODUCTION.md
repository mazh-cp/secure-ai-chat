# Fix Storage Permissions - Production Scripts

## Quick Fix - Standalone Script

Fix storage permissions without a full upgrade:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fix-storage-permissions.sh | bash
```

### With Custom App Directory

```bash
APP_DIR=/opt/secure-ai-chat curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fix-storage-permissions.sh | bash
```

### Manual Download

```bash
# Download script
curl -o fix-storage-permissions.sh https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fix-storage-permissions.sh
chmod +x fix-storage-permissions.sh

# Run it
cd /opt/secure-ai-chat  # Or your app directory
bash fix-storage-permissions.sh
```

## Full Upgrade - Production Script

Upgrade with all fixes including storage permissions:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-production.sh | bash
```

### With Custom App Directory

```bash
APP_DIR=/opt/secure-ai-chat curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-production.sh | bash
```

### With Custom Version

```bash
GIT_REF=v1.0.11 APP_DIR=/opt/secure-ai-chat curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-production.sh | bash
```

## What Gets Fixed

### Storage Permissions
- ✅ `.storage/` directory: Fixed to `0o755` (was `0o700`)
- ✅ `.storage/files/` directory: Fixed to `0o755` (was `0o700`)
- ✅ Existing files: Fixed to `0o644` for persistence
- ✅ Metadata file: Fixed to `0o644`

### File Limit
- ✅ Maximum files: Increased from 5 to 10

### Application Code
- ✅ `lib/persistent-storage.ts`: Fixed directory and file permissions
- ✅ `components/FileUploader.tsx`: Updated MAX_FILES to 10

## Quick Fix Commands (If Script Not Available)

If the script is not available, run these commands directly:

```bash
cd /opt/secure-ai-chat  # Or your app directory

# Fix .storage directory
[ -d ".storage" ] || mkdir -p .storage
chmod 755 .storage
sudo chown $(whoami):$(whoami) .storage 2>/dev/null || true

# Fix .storage/files directory
[ -d ".storage/files" ] || mkdir -p .storage/files
chmod 755 .storage/files
sudo chown $(whoami):$(whoami) .storage/files 2>/dev/null || true

# Fix existing file permissions
find .storage/files -name "*.dat" -type f -exec chmod 644 {} \; 2>/dev/null || true
[ -f ".storage/files-metadata.json" ] && chmod 644 .storage/files-metadata.json 2>/dev/null || true

# Verify
ls -ld .storage .storage/files
echo "✅ Storage permissions fixed"
```

## Verification

After running the fix, verify permissions:

```bash
# Check directory permissions
ls -ld .storage .storage/files

# Expected output:
# drwxr-xr-x (755) for .storage
# drwxr-xr-x (755) for .storage/files

# Check file permissions
ls -la .storage/files/*.dat 2>/dev/null | head -5

# Expected output:
# -rw-r--r-- (644) for files
```

## Troubleshooting

### Error: "App directory does not exist"

Find your installation first:

```bash
# Find installation
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/find-installation.sh | bash

# Then use the path found:
APP_DIR=/path/to/installation curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fix-storage-permissions.sh | bash
```

### Error: "Permission denied"

Use sudo if needed:

```bash
sudo bash -c 'cd /opt/secure-ai-chat && bash <(curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fix-storage-permissions.sh)'
```

### Files Still Not Persisting

Check service user and ownership:

```bash
# Check service user
sudo cat /etc/systemd/system/secure-ai-chat.service | grep "^User="

# Check ownership
ls -ld .storage .storage/files

# Fix ownership if needed
sudo chown -R $(sudo cat /etc/systemd/system/secure-ai-chat.service | grep "^User=" | cut -d'=' -f2 | tr -d ' '):$(sudo cat /etc/systemd/system/secure-ai-chat.service | grep "^User=" | cut -d'=' -f2 | tr -d ' ') .storage
```

## Expected Behavior After Fix

### Before Fix
- ❌ Files lost after service restart
- ❌ Directories have 0o700 permissions (too restrictive)
- ❌ Files have restrictive permissions

### After Fix
- ✅ Files persist across restarts
- ✅ Directories have 0o755 permissions (persistent)
- ✅ Files have 0o644 permissions (accessible)
- ✅ Up to 10 files can be uploaded

## Post-Fix Testing

1. **Upload Test Files**:
   - Go to Files page
   - Upload 1-2 test files
   - Verify they appear in the list

2. **Restart Test**:
   ```bash
   sudo systemctl restart secure-ai-chat
   # Wait 10 seconds
   # Check Files page - files should still be there
   ```

3. **Upload Limit Test**:
   - Go to Files page
   - Try uploading 10 files
   - Should accept up to 10 files

## Support

If issues persist:

1. Check service logs: `sudo journalctl -u secure-ai-chat -n 100`
2. Verify permissions: `ls -ld .storage .storage/files`
3. Check ownership: `ls -ld .storage`
4. Review documentation: `docs/PRODUCTION_UPGRADE_SAFE.md`

---

**Last Updated**: Based on latest hotfix  
**Status**: ✅ Ready for production deployment
