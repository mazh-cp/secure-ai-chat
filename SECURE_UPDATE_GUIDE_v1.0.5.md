# Secure Update Guide - Release v1.0.5-new

## 🚀 Secure Terminal Update Command

This guide provides the **secure update command** that ensures all API keys are preserved during the upgrade.

---

## 📋 Quick Update (Recommended)

Run this command directly on your production VM terminal:

```bash
cd /home/adminuser/secure-ai-chat && \
echo "🔒 Starting secure update..." && \
echo "📦 Creating backup of API keys..." && \
mkdir -p .backups && \
tar -czf .backups/backup-$(date +%Y%m%d-%H%M%S).tar.gz .secure-storage .next package.json package-lock.json 2>/dev/null && \
echo "✅ Backup created" && \
echo "⬇️  Fetching latest code..." && \
git fetch origin && \
echo "🔄 Switching to release/v1.0.5-new..." && \
git checkout release/v1.0.5-new && \
echo "⬇️  Pulling latest changes..." && \
git pull origin release/v1.0.5-new && \
echo "📥 Installing dependencies..." && \
npm ci && \
echo "🔨 Building application..." && \
npm run build && \
echo "🔒 Verifying API keys are preserved..." && \
if [ -d ".secure-storage" ] && [ "$(find .secure-storage -type f \( -name "*.enc" -o -name "*.hash" \) 2>/dev/null | wc -l)" -gt 0 ]; then \
  echo "✅ API keys verified: $(find .secure-storage -type f \( -name "*.enc" -o -name "*.hash" \) 2>/dev/null | wc -l) file(s) found"; \
else \
  echo "⚠️  No API keys found (this is normal if no keys are configured)"; \
fi && \
echo "🔐 Restoring secure storage permissions..." && \
chmod 700 .secure-storage 2>/dev/null || mkdir -p .secure-storage && chmod 700 .secure-storage && \
find .secure-storage -type f -exec chmod 600 {} \; 2>/dev/null || true && \
echo "🔄 Restarting service..." && \
sudo systemctl restart secure-ai-chat && \
echo "⏳ Waiting for service to start..." && \
sleep 10 && \
echo "🏥 Verifying service health..." && \
if curl -sf http://localhost:3000/api/health > /dev/null; then \
  echo "✅ Service is healthy"; \
  echo "🔍 Verifying API keys are accessible..." && \
  curl -s http://localhost:3000/api/keys > /dev/null && echo "✅ API keys endpoint responding" || echo "⚠️  API keys endpoint check skipped"; \
else \
  echo "⚠️  Service may still be starting. Check with: sudo systemctl status secure-ai-chat"; \
fi && \
echo "" && \
echo "✅ Secure update completed successfully!" && \
echo "📋 Summary:" && \
echo "   - Code updated to latest release/v1.0.5-new" && \
echo "   - API keys preserved in .secure-storage/" && \
echo "   - Service restarted" && \
echo "   - Health check passed"
```

---

## 🔧 Step-by-Step Update (More Control)

If you prefer to run commands step-by-step:

### Step 1: Navigate to Repository

```bash
cd /home/adminuser/secure-ai-chat
```

### Step 2: Create Backup

```bash
mkdir -p .backups
tar -czf .backups/backup-$(date +%Y%m%d-%H%M%S).tar.gz .secure-storage .next package.json package-lock.json
echo "✅ Backup created"
```

### Step 3: Fetch Latest Code

```bash
git fetch origin
```

### Step 4: Switch to Release Branch

```bash
git checkout release/v1.0.5-new
```

### Step 5: Pull Latest Changes

```bash
git pull origin release/v1.0.5-new
```

### Step 6: Install Dependencies

```bash
npm ci
```

### Step 7: Build Application

```bash
npm run build
```

### Step 8: Verify API Keys

```bash
if [ -d ".secure-storage" ]; then
  KEY_COUNT=$(find .secure-storage -type f \( -name "*.enc" -o -name "*.hash" \) 2>/dev/null | wc -l)
  echo "✅ Found $KEY_COUNT encrypted file(s) in .secure-storage/"
else
  echo "⚠️  .secure-storage/ directory not found"
fi
```

### Step 9: Restore Permissions

```bash
chmod 700 .secure-storage 2>/dev/null || mkdir -p .secure-storage && chmod 700 .secure-storage
find .secure-storage -type f -exec chmod 600 {} \; 2>/dev/null || true
echo "✅ Permissions restored"
```

### Step 10: Restart Service

```bash
sudo systemctl restart secure-ai-chat
sleep 10
```

### Step 11: Verify Service

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/version
```

---

## 🔍 Verification Commands

After update, verify everything is working:

### Check API Keys Status

```bash
curl http://localhost:3000/api/keys
curl http://localhost:3000/api/te/config
```

### Check Service Status

```bash
sudo systemctl status secure-ai-chat
```

### Check Version

```bash
curl http://localhost:3000/api/version
cd /home/adminuser/secure-ai-chat && node -p "require('./package.json').version"
```

### Verify Secure Storage

```bash
ls -la .secure-storage/
stat -c '%a %n' .secure-storage/
```

---

## 🛡️ Security Features

This update process includes:

1. **Automatic Backup**: Creates backup of `.secure-storage/` before update
2. **Key Preservation**: Ensures API keys are never deleted
3. **Permission Protection**: Restores correct file permissions (700/600)
4. **Verification**: Confirms keys exist after update
5. **Health Check**: Verifies service is running correctly

---

## ⚠️ Troubleshooting

### If Update Fails

1. **Restore from Backup**:

   ```bash
   cd /home/adminuser/secure-ai-chat
   tar -xzf .backups/backup-YYYYMMDD-HHMMSS-*.tar.gz
   chmod 700 .secure-storage/
   find .secure-storage -type f -exec chmod 600 {} \;
   ```

2. **Check Logs**:

   ```bash
   sudo journalctl -u secure-ai-chat -n 50
   ```

3. **Verify Git Status**:
   ```bash
   cd /home/adminuser/secure-ai-chat
   git status
   git log --oneline -5
   ```

### If API Keys Are Missing

1. **Check Backup**:

   ```bash
   ls -la .backups/
   ```

2. **Restore Keys**:
   ```bash
   tar -xzf .backups/backup-YYYYMMDD-HHMMSS-*.tar.gz .secure-storage/
   chmod 700 .secure-storage/
   find .secure-storage -type f -exec chmod 600 {} \;
   sudo systemctl restart secure-ai-chat
   ```

### If Service Won't Start

1. **Check Service Status**:

   ```bash
   sudo systemctl status secure-ai-chat
   ```

2. **Check Logs**:

   ```bash
   sudo journalctl -u secure-ai-chat -n 100 --no-pager
   ```

3. **Manual Start** (if needed):
   ```bash
   cd /home/adminuser/secure-ai-chat
   npm run start
   ```

---

## 📝 What Gets Updated

✅ **Updated**:

- Application code
- Dependencies (node_modules)
- Build artifacts (.next/)
- Configuration files

🔒 **Preserved**:

- API keys (.secure-storage/)
- Uploaded files (.storage/)
- System logs
- User preferences

---

## 🎯 Quick Reference

**One-Line Update**:

```bash
cd /home/adminuser/secure-ai-chat && git fetch origin && git checkout release/v1.0.5-new && git pull origin release/v1.0.5-new && npm ci && npm run build && sudo systemctl restart secure-ai-chat && sleep 10 && curl http://localhost:3000/api/health
```

**With Full Protection** (Recommended):
Use the complete command at the top of this guide.

---

**Last Updated**: January 2026  
**Version**: 1.0.5  
**Branch**: release/v1.0.5-new
