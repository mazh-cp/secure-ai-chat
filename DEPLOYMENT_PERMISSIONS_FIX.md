# Git Permissions Error - Fix Guide

## Error Description

When running `deploy-ubuntu-vm.sh` on a server where the repository already exists, you may encounter:

```
error: insufficient permission for adding an object to repository database .git/objects
fatal: failed to write object
fatal: unpack-objects failed
```

This occurs when the repository was cloned with a different user or has incorrect permissions.

---

## Quick Fix (Manual)

If you encounter this error, run these commands **before** re-running the deployment script:

```bash
# Fix ownership
sudo chown -R adminuser:adminuser /home/adminuser/secure-ai-chat

# Fix .git directory permissions
sudo chmod -R u+w /home/adminuser/secure-ai-chat/.git

# Fix general repository permissions
sudo chmod -R 755 /home/adminuser/secure-ai-chat
```

Then re-run the deployment script:

```bash
cd /home/adminuser
bash deploy-ubuntu-vm.sh
```

---

## Automatic Fix (Updated Script)

The deployment script has been updated (v1.0.2) to automatically fix permissions. It will:

1. **Check ownership** before git operations
2. **Fix ownership** if the repository is owned by a different user
3. **Ensure write permissions** on `.git` directory
4. **Stash local changes** before updating
5. **Reset to origin** if pull fails

### Updated Deployment Script Features

- ✅ Automatic ownership fixing
- ✅ Permission correction for `.git` directory
- ✅ Safe git operations with fallbacks
- ✅ Service user detection
- ✅ Stash/reset fallback for conflicts

---

## Root Cause

The error happens when:

1. **Repository cloned with different user** (e.g., with `sudo` or as root)
2. **Permissions changed** after initial clone
3. **Service user mismatch** (script expects `adminuser` but repo owned by another user)

---

## Prevention

To avoid this error in the future:

1. **Always run deployment as the service user** when possible:
   ```bash
   sudo -u adminuser bash deploy-ubuntu-vm.sh
   ```

2. **Clone repository as the service user**:
   ```bash
   sudo -u adminuser git clone -b release/v1.0.2 \
     https://github.com/mazh-cp/secure-ai-chat.git \
     /home/adminuser/secure-ai-chat
   ```

3. **Check ownership before operations**:
   ```bash
   ls -la /home/adminuser/secure-ai-chat/.git/objects
   # Should show: adminuser adminuser
   ```

---

## Verification

After fixing permissions, verify:

```bash
# Check ownership
ls -ld /home/adminuser/secure-ai-chat
# Should show: adminuser adminuser

# Check .git permissions
ls -ld /home/adminuser/secure-ai-chat/.git
# Should show write permissions (rwx)

# Test git operations
cd /home/adminuser/secure-ai-chat
git fetch origin
# Should work without errors
```

---

## Upgrade Script

The `upgrade.sh` script has also been updated with similar permission fixes:

```bash
cd /home/adminuser/secure-ai-chat
sudo bash upgrade.sh
```

It will automatically:
- Fix ownership before operations
- Ensure .git write permissions
- Handle git pull failures gracefully

---

## Support

If the error persists after following these steps:

1. Check the deployment script version:
   ```bash
   grep "REPO_DIR=" deploy-ubuntu-vm.sh | head -1
   # Should show: /home/adminuser/secure-ai-chat
   ```

2. Verify git is installed:
   ```bash
   which git
   git --version
   ```

3. Check disk space:
   ```bash
   df -h /home/adminuser
   ```

4. Check repository integrity:
   ```bash
   cd /home/adminuser/secure-ai-chat
   git fsck
   ```

---

**Last Updated**: 2026-01-XX  
**Version**: 1.0.2
