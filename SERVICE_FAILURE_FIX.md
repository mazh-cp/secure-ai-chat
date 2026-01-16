# Service Failure Fix - v1.0.11

**Issue**: Service shows "activating (auto-restart)" with exit code 1

---

## 🔍 Diagnosis Steps

### Step 1: Check Detailed Logs

```bash
# View full error logs
sudo journalctl -u secure-ai-chat -n 100 --no-pager

# Follow logs in real-time
sudo journalctl -u secure-ai-chat -f
```

### Step 2: Check Service File

```bash
# View service file
sudo cat /etc/systemd/system/secure-ai-chat.service

# Check ExecStart command
sudo systemctl show secure-ai-chat --property=ExecStart
```

---

## 🛠️ Common Fixes

### Fix 1: Check Node.js Path

The service uses nvm, verify it's accessible:

```bash
# Test nvm path
source /home/adminuser/.nvm/nvm.sh
nvm use 25.2.1
which node
which npm

# Verify paths match service file
```

### Fix 2: Check Working Directory

```bash
# Verify directory exists
ls -la /opt/secure-ai-chat

# Check permissions
sudo ls -la /opt/secure-ai-chat | head -5

# Fix ownership if needed
sudo chown -R adminuser:adminuser /opt/secure-ai-chat
```

### Fix 3: Check Application Build

```bash
cd /opt/secure-ai-chat

# Check if built
ls -la .next

# If missing, build
source /home/adminuser/.nvm/nvm.sh
nvm use 25.2.1
npm run build
```

### Fix 4: Test Manual Start

```bash
cd /opt/secure-ai-chat
source /home/adminuser/.nvm/nvm.sh
nvm use 25.2.1
npm start
```

This will show the actual error message.

---

## 🔧 Service File Fix

If the service file has issues, update it:

```bash
sudo nano /etc/systemd/system/secure-ai-chat.service
```

**Correct service file format:**

```ini
[Unit]
Description=Secure AI Chat (Next.js) - v1.0.11
After=network.target

[Service]
Type=simple
User=adminuser
Group=adminuser
WorkingDirectory=/opt/secure-ai-chat
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="HOSTNAME=0.0.0.0"

# Use bash to source nvm and run npm
ExecStart=/usr/bin/env bash -lc 'source "/home/adminuser/.nvm/nvm.sh" && cd "/opt/secure-ai-chat" && nvm use 25.2.1 && npm start'

Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=secure-ai-chat

# Security
NoNewPrivileges=true
PrivateTmp=true
ReadWritePaths=/opt/secure-ai-chat/.secure-storage /opt/secure-ai-chat/.next /opt/secure-ai-chat/.storage

[Install]
WantedBy=multi-user.target
```

**After updating:**

```bash
# Reload systemd
sudo systemctl daemon-reload

# Restart service
sudo systemctl restart secure-ai-chat

# Check status
sudo systemctl status secure-ai-chat
```

---

## 📋 Alternative Service File (Direct Node Path)

If nvm sourcing doesn't work, use direct Node.js path:

```bash
# Find Node.js path
source /home/adminuser/.nvm/nvm.sh
nvm use 25.2.1
which node
# Example output: /home/adminuser/.nvm/versions/node/v25.2.1/bin/node

which npm
# Example output: /home/adminuser/.nvm/versions/node/v25.2.1/bin/npm
```

Then update service file:

```ini
[Unit]
Description=Secure AI Chat (Next.js) - v1.0.11
After=network.target

[Service]
Type=simple
User=adminuser
Group=adminuser
WorkingDirectory=/opt/secure-ai-chat
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="HOSTNAME=0.0.0.0"

# Use direct Node.js path (replace with your actual path)
ExecStart=/home/adminuser/.nvm/versions/node/v25.2.1/bin/npm start

Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=secure-ai-chat

[Install]
WantedBy=multi-user.target
```

---

## 🔍 Debugging Commands

```bash
# 1. Check what the service is trying to run
sudo systemctl cat secure-ai-chat

# 2. Test the ExecStart command manually
cd /opt/secure-ai-chat
source /home/adminuser/.nvm/nvm.sh
nvm use 25.2.1
npm start

# 3. Check environment
cd /opt/secure-ai-chat
source /home/adminuser/.nvm/nvm.sh
nvm use 25.2.1
echo $NODE_ENV
echo $PORT
echo $HOSTNAME
node -v
npm -v

# 4. Check file permissions
ls -la /opt/secure-ai-chat/package.json
ls -la /opt/secure-ai-chat/node_modules/.bin/next
```

---

## ✅ Verification

After fixing:

```bash
# 1. Service should be active
sudo systemctl status secure-ai-chat
# Should show: Active: active (running)

# 2. Port should be listening
sudo ss -tlnp | grep :3000
# Should show: LISTEN 0 511 0.0.0.0:3000

# 3. Health endpoint should work
curl http://localhost:3000/api/health
# Should return: {"status":"ok",...}
```

---

**Last Updated**: January 16, 2026
