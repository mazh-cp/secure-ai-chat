# Troubleshooting Connection Issues

## Error: "Failed to connect to localhost port 3000"

This error means the application is not running or not accessible on port 3000.

---

## 🔍 Quick Diagnosis

### Step 1: Check if Service is Running

```bash
# Check systemd service status
sudo systemctl status secure-ai-chat

# Expected output should show: "Active: active (running)"
```

### Step 2: Check if Port 3000 is Listening

```bash
# Check what's listening on port 3000
sudo ss -tlnp | grep :3000
# OR
sudo netstat -tlnp | grep :3000
# OR
sudo lsof -i :3000
```

**Expected output:**
```
LISTEN 0 511 0.0.0.0:3000
```

If nothing shows, the application is not running.

### Step 3: Check Service Logs

```bash
# View recent logs
sudo journalctl -u secure-ai-chat -n 50

# Follow logs in real-time
sudo journalctl -u secure-ai-chat -f
```

Look for:
- Startup errors
- Port binding issues
- Node.js errors
- Configuration problems

---

## 🛠️ Solutions

### Solution 1: Start the Service

If the service is not running:

```bash
# Start the service
sudo systemctl start secure-ai-chat

# Check status
sudo systemctl status secure-ai-chat

# Enable to start on boot
sudo systemctl enable secure-ai-chat
```

### Solution 2: Check Service Configuration

Verify the service file is correct:

```bash
# View service file
sudo cat /etc/systemd/system/secure-ai-chat.service

# Check ExecStart path
sudo systemctl show secure-ai-chat --property=ExecStart
```

**Common issues:**
- Wrong Node.js path
- Wrong working directory
- Missing environment variables

### Solution 3: Manual Start (For Testing)

If systemd service has issues, start manually:

```bash
# Navigate to application directory
cd ~/secure-ai-chat
# OR
cd /opt/secure-ai-chat

# Load Node.js (if using nvm)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 25.2.1

# Start application
npm start
# OR
HOSTNAME=0.0.0.0 PORT=3000 npm start
```

### Solution 4: Check Port Availability

```bash
# Check if port 3000 is in use by another process
sudo lsof -i :3000

# If another process is using it, either:
# 1. Kill the process: sudo kill -9 <PID>
# 2. Change PORT in .env.local to a different port (e.g., 3001)
```

### Solution 5: Check Firewall

```bash
# Check UFW status
sudo ufw status

# Allow port 3000 if needed
sudo ufw allow 3000/tcp
sudo ufw reload
```

### Solution 6: Check Application Configuration

```bash
# Check .env.local file
cat ~/secure-ai-chat/.env.local
# OR
cat /opt/secure-ai-chat/.env.local

# Verify HOSTNAME and PORT are set correctly
# Should have:
# HOSTNAME=0.0.0.0
# PORT=3000
```

---

## 🔍 Detailed Troubleshooting

### Check if Application is Built

```bash
cd ~/secure-ai-chat
# OR
cd /opt/secure-ai-chat

# Check if .next directory exists
ls -la .next

# If missing, build the application
npm run build
```

### Check Node.js Version

```bash
# Check Node.js version
node -v
# Should show: v25.2.1

# If wrong version, switch
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 25.2.1
```

### Check Service User Permissions

```bash
# Check who owns the application directory
ls -la ~/secure-ai-chat
# OR
ls -la /opt/secure-ai-chat

# Service should run as the user who owns the directory
# Check service file user matches directory owner
```

### Test Application Directly

```bash
# Navigate to app directory
cd ~/secure-ai-chat

# Load Node.js
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 25.2.1

# Test if app can start
npm start

# In another terminal, test connection
curl http://localhost:3000/api/health
```

---

## 📋 Common Issues and Fixes

### Issue: Service shows "failed" status

**Fix:**
```bash
# Check logs for errors
sudo journalctl -u secure-ai-chat -n 100

# Common causes:
# - Node.js path incorrect
# - Working directory doesn't exist
# - Missing dependencies
# - Port already in use
```

### Issue: Service shows "active" but port not listening

**Fix:**
```bash
# Check if app is binding to correct interface
sudo ss -tlnp | grep :3000

# Should show: 0.0.0.0:3000 (not 127.0.0.1:3000)

# If binding to 127.0.0.1, check HOSTNAME in .env.local
# Should be: HOSTNAME=0.0.0.0
```

### Issue: Permission denied errors

**Fix:**
```bash
# Fix ownership
sudo chown -R $USER:$USER ~/secure-ai-chat
# OR
sudo chown -R $USER:$USER /opt/secure-ai-chat

# Fix permissions
chmod -R u+w ~/secure-ai-chat
```

### Issue: Port 3000 already in use

**Fix:**
```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>

# Or change port in .env.local
# PORT=3001
```

---

## ✅ Verification Steps

After fixing, verify:

```bash
# 1. Service is running
sudo systemctl status secure-ai-chat

# 2. Port is listening
sudo ss -tlnp | grep :3000

# 3. Health endpoint responds
curl http://localhost:3000/api/health

# 4. Version endpoint works
curl http://localhost:3000/api/version
```

---

## 🚀 Quick Fix Script

Run this to diagnose and fix common issues:

```bash
#!/bin/bash
echo "=== Diagnosing Connection Issue ==="

# Check service status
echo "1. Checking service status..."
sudo systemctl status secure-ai-chat --no-pager | head -10

# Check port
echo ""
echo "2. Checking port 3000..."
sudo ss -tlnp | grep :3000 || echo "Port 3000 not listening"

# Check logs
echo ""
echo "3. Recent service logs..."
sudo journalctl -u secure-ai-chat -n 20 --no-pager

# Check if app directory exists
echo ""
echo "4. Checking application directory..."
if [ -d ~/secure-ai-chat ]; then
    echo "Found: ~/secure-ai-chat"
    ls -la ~/secure-ai-chat/.next 2>/dev/null || echo ".next directory missing - need to build"
elif [ -d /opt/secure-ai-chat ]; then
    echo "Found: /opt/secure-ai-chat"
    ls -la /opt/secure-ai-chat/.next 2>/dev/null || echo ".next directory missing - need to build"
else
    echo "Application directory not found"
fi

echo ""
echo "=== Diagnosis Complete ==="
```

---

## 📞 Next Steps

If none of these solutions work:

1. **Check installation**: Verify the application was installed correctly
2. **Review logs**: Check all logs for error messages
3. **Test manually**: Try starting the app manually to see errors
4. **Reinstall**: Consider reinstalling if configuration is corrupted

---

**Last Updated**: January 16, 2026
