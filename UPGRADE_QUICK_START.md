# Quick Start - Production Upgrade

## ⚠️ Important Note

The upgrade script needs to be pushed to GitHub first, or you can use one of these alternatives:

---

## Option 1: Use Existing Script (Recommended if repo exists)

If you already have the repository cloned on your production server:

```bash
cd /home/adminuser/secure-ai-chat
git pull origin release/unifi-theme-safe-final
bash scripts/upgrade-production.sh
```

---

## Option 2: Manual One-Line Command

Run these commands directly on your production server:

```bash
cd /home/adminuser/secure-ai-chat && \
git fetch origin && \
git checkout release/unifi-theme-safe-final && \
git pull origin release/unifi-theme-safe-final && \
npm ci && \
npm run build && \
sudo systemctl restart secure-ai-chat && \
sleep 5 && \
curl http://localhost:3000/api/health && \
echo "✅ Upgrade complete!"
```

---

## Option 3: Use Alternative Update Script

If you have an older version, you can use the existing update script:

```bash
cd /home/adminuser/secure-ai-chat
bash update-production.sh
```

Or download it:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/update-production.sh | bash
```

---

## Option 4: Download Script Locally First

1. **On your local machine**, download the script:

```bash
cd /Users/mhamayun/Downloads/Cursor\ Workbooks/Secure-Ai-Chat-V1.0.1/secure-ai-chat
scp scripts/upgrade-production.sh adminuser@YOUR_SERVER:/tmp/upgrade.sh
```

2. **On your production server**, run it:

```bash
chmod +x /tmp/upgrade.sh
/tmp/upgrade.sh
```

---

## Option 5: Push to GitHub First (If you have access)

If you have GitHub access, push the branch first:

```bash
cd /Users/mhamayun/Downloads/Cursor\ Workbooks/Secure-Ai-Chat-V1.0.1/secure-ai-chat
git add scripts/upgrade-production.sh PRODUCTION_UPGRADE.md UPGRADE_COMMANDS.md
git commit -m "Add production upgrade script and documentation"
git push origin release/unifi-theme-safe-final
```

Then use the curl command:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/unifi-theme-safe-final/scripts/upgrade-production.sh | bash
```

---

## Quick Manual Upgrade Steps

If none of the above work, here's the manual process:

```bash
# 1. SSH into production server
ssh adminuser@YOUR_SERVER

# 2. Navigate to repository
cd /home/adminuser/secure-ai-chat

# 3. Backup current state
cp -r .next .next.backup.$(date +%Y%m%d-%H%M%S)

# 4. Pull latest code
git fetch origin
git checkout release/unifi-theme-safe-final
git pull origin release/unifi-theme-safe-final

# 5. Install dependencies
npm ci

# 6. Build application
npm run build

# 7. Restart service
sudo systemctl restart secure-ai-chat

# 8. Wait for service to start
sleep 5

# 9. Verify deployment
curl http://localhost:3000/api/health
sudo systemctl status secure-ai-chat

echo "✅ Upgrade complete!"
```

---

## Troubleshooting

### If git pull fails:
```bash
git fetch origin
git reset --hard origin/release/unifi-theme-safe-final
```

### If build fails:
```bash
rm -rf .next node_modules
npm ci
npm run build
```

### If service won't start:
```bash
sudo journalctl -u secure-ai-chat -n 50
sudo systemctl restart secure-ai-chat
```

---

**For detailed documentation**, see `PRODUCTION_UPGRADE.md` or `UPGRADE_COMMANDS.md`
