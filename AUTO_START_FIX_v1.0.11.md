# Automatic Startup Fix for v1.0.11

**Version**: 1.0.11  
**Date**: January 16, 2026  
**Issue**: Application doesn't start automatically on remote Ubuntu VM

---

## 🔍 Problem Summary

After installation, the application required:
1. Manual API key configuration
2. Manual `npm start` command to start the server

Users expected automatic startup after installation.

---

## ✅ Fix Applied

### Automatic systemd Service Setup

The installation script now automatically:
1. **Creates systemd service file** at `/etc/systemd/system/secure-ai-chat.service`
2. **Enables service** to start on boot
3. **Starts service immediately** after installation
4. **Configures proper paths** for Node.js and npm from nvm

### Service Configuration

The systemd service includes:
- **Automatic restart** on failure (RestartSec=5)
- **Proper environment variables** (HOSTNAME=0.0.0.0, PORT=3000)
- **Security settings** (NoNewPrivileges, PrivateTmp)
- **Logging** to systemd journal

---

## 🚀 How It Works

### During Installation

The installation script now:
1. Finds npm path (from nvm or system)
2. Creates systemd service file with correct paths
3. Reloads systemd daemon
4. Enables service (starts on boot)
5. Starts service immediately

### Service Management

After installation, you can manage the service:

```bash
# Check status
sudo systemctl status secure-ai-chat

# View logs
sudo journalctl -u secure-ai-chat -f

# Restart service
sudo systemctl restart secure-ai-chat

# Stop service
sudo systemctl stop secure-ai-chat

# Disable auto-start on boot
sudo systemctl disable secure-ai-chat
```

---

## 📋 Service Details

### Service File Location
`/etc/systemd/system/secure-ai-chat.service`

### Key Settings
- **User**: Current user (who ran installation)
- **Working Directory**: Installation directory (default: `~/secure-ai-chat`)
- **Port**: 3000 (or value from PORT environment variable)
- **Hostname**: 0.0.0.0 (allows public access)
- **Restart**: Always (automatic restart on failure)

### Logs
Service logs are available via:
```bash
# Real-time logs
sudo journalctl -u secure-ai-chat -f

# Last 50 lines
sudo journalctl -u secure-ai-chat -n 50

# Since boot
sudo journalctl -u secure-ai-chat -b
```

---

## ✅ Verification

After installation, verify the service is running:

```bash
# 1. Check service status
sudo systemctl status secure-ai-chat

# Expected output:
# ● secure-ai-chat.service - Secure AI Chat Application
#    Loaded: loaded (/etc/systemd/system/secure-ai-chat.service; enabled)
#    Active: active (running) since ...

# 2. Check if app is listening
sudo ss -tlnp | grep :3000
# Should show: LISTEN 0 511 0.0.0.0:3000

# 3. Test health endpoint
curl http://localhost:3000/api/health
# Expected: {"status":"ok",...}

# 4. Check version
curl http://localhost:3000/api/version
# Expected: {"version":"1.0.11"}
```

---

## 🔧 Troubleshooting

### Issue: Service Not Starting

**Check logs:**
```bash
sudo journalctl -u secure-ai-chat -n 50
```

**Common causes:**
1. **Node.js path incorrect**: Service file has wrong npm path
   - Fix: Update `ExecStart` in service file with correct path
   - Find path: `which npm` (after `nvm use 25.2.1`)
   - Edit: `sudo nano /etc/systemd/system/secure-ai-chat.service`
   - Reload: `sudo systemctl daemon-reload && sudo systemctl restart secure-ai-chat`

2. **Port already in use**: Another process using port 3000
   - Fix: Kill process or change PORT in service file
   - Find process: `sudo lsof -i :3000`
   - Kill: `sudo kill -9 <PID>`

3. **Permissions issue**: Service user doesn't have access
   - Fix: Ensure user owns installation directory
   - Fix: `sudo chown -R $USER:$USER ~/secure-ai-chat`

### Issue: Service Starts But App Not Accessible

**Check:**
1. Firewall blocking port: `sudo ufw status`
2. App binding correctly: Check logs for "0.0.0.0:3000"
3. Network interface: `ip addr show`

**Fix firewall:**
```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

### Issue: Service Not Enabled on Boot

**Enable manually:**
```bash
sudo systemctl enable secure-ai-chat
sudo systemctl start secure-ai-chat
```

---

## 📝 Manual Service Creation (If Needed)

If automatic setup fails, create service manually:

```bash
# 1. Find npm path
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
which npm
# Example output: /home/ubuntu/.nvm/versions/node/v25.2.1/bin/npm

# 2. Create service file
sudo nano /etc/systemd/system/secure-ai-chat.service

# 3. Paste (update paths):
[Unit]
Description=Secure AI Chat Application
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
Group=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/secure-ai-chat
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="HOSTNAME=0.0.0.0"
ExecStart=/home/YOUR_USERNAME/.nvm/versions/node/v25.2.1/bin/npm start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=secure-ai-chat

[Install]
WantedBy=multi-user.target

# 4. Enable and start
sudo systemctl daemon-reload
sudo systemctl enable secure-ai-chat
sudo systemctl start secure-ai-chat
```

---

## 🎯 Benefits

✅ **Automatic startup** - App starts on boot  
✅ **Auto-restart** - Restarts on failure  
✅ **Easy management** - Standard systemd commands  
✅ **Logging** - Centralized logs via journalctl  
✅ **No manual steps** - Works immediately after installation  

---

## 📞 Support

If service still doesn't start automatically:

1. Check installation logs for errors
2. Verify systemd service file exists: `ls -la /etc/systemd/system/secure-ai-chat.service`
3. Check service status: `sudo systemctl status secure-ai-chat`
4. Review logs: `sudo journalctl -u secure-ai-chat -n 100`

---

**Fix Version**: 1.0.11  
**Last Updated**: January 16, 2026
