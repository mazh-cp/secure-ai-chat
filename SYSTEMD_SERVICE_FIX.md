# Systemd Service Fix Guide

**Issue:** `Unit secure-ai-chat.service not found` - Service file doesn't exist

## 🐛 Problem

The systemd service file was not created during installation, or was removed. This prevents the application from running as a service.

## ✅ Quick Fix

### Option 1: Run Service Creation Script (Recommended)

```bash
# Download and run
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/create-systemd-service.sh | sudo bash

# Or if you have the repository
cd /home/adminuser/secure-ai-chat
sudo bash scripts/create-systemd-service.sh
```

### Option 2: Manual Creation

```bash
# 1. Create service file
sudo nano /etc/systemd/system/secure-ai-chat.service

# 2. Paste the following content:
```

```ini
[Unit]
Description=Secure AI Chat Application
After=network.target

[Service]
Type=simple
User=adminuser
Group=adminuser
WorkingDirectory=/home/adminuser/secure-ai-chat
Environment=NODE_ENV=production
Environment=HOSTNAME=0.0.0.0
Environment=PORT=3000
Environment=PATH=/home/adminuser/.nvm/versions/node/v25.2.1/bin:/usr/local/bin:/usr/bin:/bin
EnvironmentFile=/home/adminuser/secure-ai-chat/.env
ExecStart=/home/adminuser/.nvm/versions/node/v25.2.1/bin/npm start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=secure-ai-chat

# Security
NoNewPrivileges=true
PrivateTmp=true
ReadWritePaths=/home/adminuser/secure-ai-chat/.secure-storage /home/adminuser/secure-ai-chat/.next /home/adminuser/secure-ai-chat/.storage

[Install]
WantedBy=multi-user.target
```

**Important:** Update the paths in the service file:
- `WorkingDirectory`: Path to your repository
- `User`/`Group`: Your service user (usually `adminuser`)
- `ExecStart`: Path to npm (find with `which npm` after `nvm use 25.2.1`)
- `Environment=PATH`: Path to node/npm directory

```bash
# 3. Find correct Node.js paths
cd /home/adminuser/secure-ai-chat
source ~/.nvm/nvm.sh
nvm use 25.2.1
which node
which npm

# 4. Update service file with correct paths
sudo systemctl edit --full secure-ai-chat

# 5. Reload and enable
sudo systemctl daemon-reload
sudo systemctl enable secure-ai-chat
sudo systemctl start secure-ai-chat

# 6. Verify
sudo systemctl status secure-ai-chat
```

## 🔍 Verification

After creating the service:

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check if it's enabled
sudo systemctl is-enabled secure-ai-chat

# Check if it's running
sudo systemctl is-active secure-ai-chat

# Check network binding
sudo ss -tlnp | grep :3000

# Test health endpoint
curl http://localhost:3000/api/health
```

## 📋 Service File Requirements

The service file must include:

1. **Correct paths:**
   - `WorkingDirectory`: Repository directory
   - `ExecStart`: Full path to npm
   - `Environment=PATH`: Node.js bin directory

2. **Environment variables:**
   - `HOSTNAME=0.0.0.0` (for public access)
   - `PORT=3000`
   - `NODE_ENV=production`

3. **User/Group:**
   - Must match the user who owns the repository
   - Usually `adminuser:adminuser`

4. **Permissions:**
   - Service user must have read/write access to:
     - `.secure-storage/`
     - `.next/`
     - `.storage/`

## 🚨 Troubleshooting

### Issue: Service fails to start

**Check logs:**
```bash
sudo journalctl -u secure-ai-chat -n 50 --no-pager
```

**Common causes:**
1. **Node.js path incorrect:**
   ```bash
   # Find correct path
   source ~/.nvm/nvm.sh
   nvm use 25.2.1
   which node
   which npm
   
   # Update service file
   sudo systemctl edit --full secure-ai-chat
   ```

2. **Build missing:**
   ```bash
   cd /home/adminuser/secure-ai-chat
   sudo -u adminuser npm run build
   ```

3. **Permissions:**
   ```bash
   sudo chown -R adminuser:adminuser /home/adminuser/secure-ai-chat
   ```

### Issue: Service starts but stops immediately

**Check:**
```bash
# View logs
sudo journalctl -u secure-ai-chat -f

# Check if build exists
ls -la /home/adminuser/secure-ai-chat/.next

# Rebuild if needed
cd /home/adminuser/secure-ai-chat
sudo -u adminuser npm run build
sudo systemctl restart secure-ai-chat
```

### Issue: Service exists but won't start

**Try:**
```bash
# Reload systemd
sudo systemctl daemon-reload

# Restart service
sudo systemctl restart secure-ai-chat

# Check status
sudo systemctl status secure-ai-chat
```

## 🔧 Complete Fix Procedure

If the service doesn't exist:

```bash
# 1. Run service creation script
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/create-systemd-service.sh | sudo bash

# 2. Verify service
sudo systemctl status secure-ai-chat

# 3. Check network binding
sudo ss -tlnp | grep :3000

# 4. Test health endpoint
curl http://localhost:3000/api/health
```

## 📚 Related Scripts

- `scripts/create-systemd-service.sh` - Automated service creation
- `scripts/fix-public-access.sh` - Includes service creation check
- `deploy-ubuntu-vm.sh` - Full installation (includes service creation)

---

**Last Updated:** January 12, 2026  
**Status:** ✅ Fixed with automated script
