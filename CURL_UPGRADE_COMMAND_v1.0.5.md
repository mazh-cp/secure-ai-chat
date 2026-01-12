# CURL-Based Production VM Upgrade - Version 1.0.5

## 🚀 Single CURL Command Sequence (Run on Remote VM Terminal)

Execute these commands directly on your remote VM terminal:

### Option 1: One-Liner (Recommended - Includes Version Fix)

```bash
cd /home/adminuser/secure-ai-chat && \
git fetch origin && \
git checkout release/v1.0.5-new && \
git pull origin release/v1.0.5-new && \
npm ci && \
npm run build && \
sudo systemctl restart secure-ai-chat && \
sleep 10 && \
curl -sf http://localhost:3000/api/health > /dev/null && echo "✅ Upgrade successful" || echo "⚠️  Verify manually" && \
sudo reboot
```

### Option 1b: Using Upgrade Script (Alternative)

```bash
cd /home/adminuser/secure-ai-chat && \
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/v1.0.5-new/scripts/upgrade-production.sh | bash && \
sudo reboot
```

---

### Option 2: Step-by-Step (More Control)

```bash
# Step 1: Navigate to repository
cd /home/adminuser/secure-ai-chat

# Step 2: Fetch and execute upgrade script
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/v1.0.5-new/scripts/upgrade-production.sh | bash

# Step 3: Reboot VM (optional, but recommended)
sudo reboot
```

---

### Option 3: Manual Git Pull + Build (No Script)

```bash
# Navigate to repository
cd /home/adminuser/secure-ai-chat

# Fetch latest changes
git fetch origin

# Checkout and pull release branch
git checkout release/v1.0.5-new
git pull origin release/v1.0.5-new

# Install dependencies
npm ci

# Build application
npm run build

# Restart service
sudo systemctl restart secure-ai-chat

# Wait and verify
sleep 10
curl -sf http://localhost:3000/api/health && echo "✅ Service is healthy" || echo "⚠️  Service may need attention"

# Reboot VM
sudo reboot
```

---

### Option 4: Download Script First, Then Execute

```bash
# Download upgrade script
cd /home/adminuser/secure-ai-chat
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/v1.0.5-new/scripts/upgrade-production.sh -o /tmp/upgrade.sh

# Make executable
chmod +x /tmp/upgrade.sh

# Review script (optional)
cat /tmp/upgrade.sh

# Execute
bash /tmp/upgrade.sh

# Reboot
sudo reboot
```

---

## 📋 Complete CURL Command Sequence (Copy-Paste Ready)

### Full Upgrade with Backup and Reboot

```bash
cd /home/adminuser/secure-ai-chat && \
echo "📦 Creating backup..." && \
mkdir -p .backups && \
tar -czf .backups/backup-$(date +%Y%m%d-%H%M%S).tar.gz .next .secure-storage package.json package-lock.json 2>/dev/null && \
echo "⬇️  Fetching latest code..." && \
git fetch origin && \
git checkout release/v1.0.5-new && \
git pull origin release/v1.0.5-new && \
echo "📥 Installing dependencies..." && \
npm ci && \
echo "🔨 Building application..." && \
npm run build && \
echo "🔄 Restarting service..." && \
sudo systemctl restart secure-ai-chat && \
echo "⏳ Waiting for service..." && \
sleep 10 && \
echo "🏥 Verifying health..." && \
curl -sf http://localhost:3000/api/health && echo " ✅ Service is healthy" || echo " ⚠️  Service may need attention" && \
echo "🔄 Rebooting VM..." && \
sudo reboot
```

---

## 🔧 CURL Commands for Verification

### Check Current Version

```bash
curl -s https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/v1.0.5-new/package.json | grep -o '"version": "[^"]*"' | head -1
```

### Check Health After Upgrade

```bash
curl -s http://localhost:3000/api/health | jq . || curl -s http://localhost:3000/api/health
```

### Check Service Status

```bash
curl -s http://localhost:3000/api/health && systemctl status secure-ai-chat --no-pager | head -15
```

---

## 🛠️ Troubleshooting CURL Commands

### If GitHub Raw URL Fails

```bash
# Try alternative: Download from main branch
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-production.sh | bash
```

### Check Network Connectivity

```bash
curl -I https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/v1.0.5-new/scripts/upgrade-production.sh
```

### Verify Git Remote

```bash
cd /home/adminuser/secure-ai-chat && git remote -v
```

---

## 📝 Quick Reference

**One-Liner (Recommended):**
```bash
cd /home/adminuser/secure-ai-chat && curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/v1.0.5-new/scripts/upgrade-production.sh | bash && sudo reboot
```

**Manual Git Pull:**
```bash
cd /home/adminuser/secure-ai-chat && git fetch origin && git checkout release/v1.0.5-new && git pull origin release/v1.0.5-new && npm ci && npm run build && sudo systemctl restart secure-ai-chat && sleep 10 && curl -sf http://localhost:3000/api/health && sudo reboot
```

---

## ✅ Post-Upgrade Verification

After VM reboots (wait 1-2 minutes):

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check health endpoint
curl http://localhost:3000/api/health

# Check version
cd /home/adminuser/secure-ai-chat && node -p "require('./package.json').version"
```

---

**Version**: 1.0.5  
**Branch**: release/v1.0.5-new  
**Last Updated**: January 2026
