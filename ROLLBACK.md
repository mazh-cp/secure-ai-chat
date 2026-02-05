# Rollback — Quick steps

Use this to revert to the previous release after an upgrade (e.g. from v1.0.12 back to v1.0.11).

## 1. Checkout previous tag

```bash
cd /opt/secure-ai-chat   # or your app directory
git fetch origin
git checkout v1.0.11      # replace with the tag you want to roll back to
```

## 2. Install dependencies and rebuild

```bash
npm ci
npm run build
```

## 3. Restart service

**systemd:**

```bash
sudo systemctl restart secure-ai-chat
```

**pm2:**

```bash
pm2 restart secure-ai-chat
```

## 4. Verify

```bash
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/rag/status
```

Check that the health response includes the expected `version` (e.g. `1.0.11`) and `status: ok`.

## If you used the upgrade script backup

The upgrade script may have created a backup under `.backups/upgrade-*`. To restore from it:

```bash
BACKUP_DIR=$(ls -td .backups/upgrade-* 2>/dev/null | head -1)
[ -z "$BACKUP_DIR" ] && echo "No backup found" && exit 1
git checkout $(cat "$BACKUP_DIR/.git-ref")
rm -rf .next && cp -r "$BACKUP_DIR/.next" .next
sudo systemctl restart secure-ai-chat
```

See [docs/UPGRADE_ROLLBACK.md](docs/UPGRADE_ROLLBACK.md) for full rollback and release-gate failure handling.
