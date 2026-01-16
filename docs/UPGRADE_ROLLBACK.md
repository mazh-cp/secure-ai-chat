# Upgrade Rollback Procedures

## Automatic Rollback

The upgrade script automatically rolls back if:
- Release gate fails with **critical security violations**
- Build fails
- Service restart fails after build

### What Gets Rolled Back

1. **Git state**: Restored to previous commit
2. **Build output**: `.next` directory restored from backup
3. **Service**: Restarted with previous version

### Backup Location

Backups are stored in: `{APP_DIR}/.backups/upgrade-{TIMESTAMP}/`

Each backup contains:
- `.next/` - Previous build output
- `.secure-storage/` - API keys (backup only, not restored)
- `.env.local` - Environment variables (if exists)
- `.git-ref` - Previous git commit hash

## Manual Rollback

If automatic rollback doesn't work, use these steps:

### Step 1: Find Backup

```bash
cd /opt/secure-ai-chat  # Or your app directory
ls -la .backups/
```

### Step 2: Restore Previous Version

```bash
# Find the backup directory (most recent)
BACKUP_DIR=$(ls -td .backups/upgrade-* | head -1)

# Check what's in the backup
cat "$BACKUP_DIR/.git-ref"

# Restore git state
git checkout $(cat "$BACKUP_DIR/.git-ref")

# Restore build
rm -rf .next
cp -r "$BACKUP_DIR/.next" .next

# Restart service
sudo systemctl restart secure-ai-chat
```

### Step 3: Verify Service

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check health endpoint
curl http://localhost:3000/api/health

# Check logs
sudo journalctl -u secure-ai-chat -n 50 --no-pager
```

## Release Gate Failures

### Critical Failures (Automatic Rollback)

These failures trigger automatic rollback:
- Security violations (API key leakage to client)
- ThreatCloud API key in client code
- Server-only modules imported in client components

### Non-Critical Failures (Continue)

These failures allow upgrade to continue:
- TypeScript warnings
- ESLint warnings (non-security)
- Build warnings (non-critical)

## Troubleshooting Failed Upgrades

### Service Won't Start After Upgrade

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check logs
sudo journalctl -u secure-ai-chat -n 100 --no-pager

# Try manual start
cd /opt/secure-ai-chat
npm start
```

### Rollback Failed

If automatic rollback fails:

```bash
# Stop service first
sudo systemctl stop secure-ai-chat

# Manual rollback (see steps above)

# Start service
sudo systemctl start secure-ai-chat
```

### Release Gate Failing But Want to Continue

**WARNING**: Only do this if you understand the risks!

```bash
# Run upgrade with release gate skipped (not recommended)
# This requires modifying the script - not recommended for production
```

Better approach:
1. Fix the release gate issues first
2. Then re-run the upgrade

## Prevention

To avoid upgrade failures:

1. **Test upgrades locally first**
   ```bash
   git pull origin main
   npm ci
   npm run build
   ```

2. **Check release gate locally**
   ```bash
   bash scripts/release-gate.sh
   ```

3. **Verify backups before upgrade**
   ```bash
   ls -la .backups/
   ```

4. **Keep service running during upgrade** (if possible)
   - The upgrade script backs up before changes
   - Service restart happens at the end

## Recovery Commands

### Quick Recovery

```bash
cd /opt/secure-ai-chat

# Find latest backup
LATEST_BACKUP=$(ls -td .backups/upgrade-* | head -1)

# Quick rollback
git checkout $(cat "$LATEST_BACKUP/.git-ref")
rm -rf .next && cp -r "$LATEST_BACKUP/.next" .next
sudo systemctl restart secure-ai-chat
```

### Verify Recovery

```bash
# Check version matches backup
git rev-parse HEAD
cat .backups/upgrade-*/$(ls -td .backups/upgrade-* | head -1)/.git-ref

# Check service
sudo systemctl status secure-ai-chat
curl http://localhost:3000/api/health
```

---

**Last Updated**: Latest upgrade script version  
**Status**: ✅ Automatic rollback enabled by default
