# Public Access Fix Guide

**Issue:** Application completes installation but isn't accessible on public IP address

## 🐛 Common Causes

1. **Application binding to localhost (127.0.0.1) instead of 0.0.0.0**
2. **Firewall blocking port 3000**
3. **Cloud provider firewall rules not configured**
4. **HOSTNAME environment variable not set correctly**

## ✅ Quick Fix

### Option 1: Run Diagnostic & Fix Script

```bash
# Download and run
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fix-public-access.sh | sudo bash

# Or if you have the repository
cd /home/adminuser/secure-ai-chat
sudo bash scripts/fix-public-access.sh
```

### Option 2: Manual Fix

#### Step 1: Check Current Binding

```bash
# Check what the application is listening on
sudo ss -tlnp | grep :3000

# Should show: 0.0.0.0:3000 (NOT 127.0.0.1:3000)
```

#### Step 2: Fix Systemd Service

```bash
# Edit service file
sudo systemctl edit --full secure-ai-chat

# Ensure these lines exist:
# Environment=HOSTNAME=0.0.0.0
# Environment=PORT=3000

# Or use sed to add it:
sudo sed -i '/^\[Service\]/a Environment=HOSTNAME=0.0.0.0' /etc/systemd/system/secure-ai-chat.service
sudo systemctl daemon-reload
sudo systemctl restart secure-ai-chat
```

#### Step 3: Fix .env File

```bash
cd /home/adminuser/secure-ai-chat

# Add or update HOSTNAME
echo "HOSTNAME=0.0.0.0" | sudo tee -a .env
sudo chown adminuser:adminuser .env
sudo chmod 600 .env

# Restart service
sudo systemctl restart secure-ai-chat
```

#### Step 4: Configure Firewall

```bash
# UFW (Ubuntu Firewall)
sudo ufw allow 3000/tcp
sudo ufw reload

# Check status
sudo ufw status
```

#### Step 5: Verify

```bash
# Check binding
sudo ss -tlnp | grep :3000

# Should show: 0.0.0.0:3000

# Test locally
curl http://localhost:3000/api/health

# Get public IP
hostname -I

# Test from another machine
curl http://YOUR_PUBLIC_IP:3000/api/health
```

## 🔍 Diagnostic Steps

### 1. Check Service Status

```bash
sudo systemctl status secure-ai-chat
```

### 2. Check Network Binding

```bash
# Modern systems (preferred)
sudo ss -tlnp | grep :3000

# Legacy systems
sudo netstat -tlnp | grep :3000
```

**Expected Output:**
```
LISTEN 0 511 0.0.0.0:3000 0.0.0.0:* users:(("node",pid=1234,fd=20))
```

**If you see 127.0.0.1:3000 instead:**
- Application is only accessible locally
- Fix: Set HOSTNAME=0.0.0.0 in systemd service and .env

### 3. Check Systemd Service Configuration

```bash
# View service file
sudo systemctl cat secure-ai-chat

# Check for HOSTNAME
sudo systemctl cat secure-ai-chat | grep HOSTNAME
```

**Should show:**
```
Environment=HOSTNAME=0.0.0.0
```

### 4. Check Environment File

```bash
cd /home/adminuser/secure-ai-chat
cat .env | grep HOSTNAME
```

**Should show:**
```
HOSTNAME=0.0.0.0
```

### 5. Check Firewall

```bash
# UFW status
sudo ufw status verbose

# Should show port 3000 allowed
```

### 6. Check Service Logs

```bash
# View recent logs
sudo journalctl -u secure-ai-chat -n 50 --no-pager

# Follow logs
sudo journalctl -u secure-ai-chat -f
```

## 🌐 Cloud Provider Firewall Configuration

### AWS EC2

1. Go to **EC2 Dashboard** → **Security Groups**
2. Select your instance's security group
3. **Inbound Rules** → **Edit Inbound Rules**
4. Add rule:
   - **Type:** Custom TCP
   - **Port:** 3000
   - **Source:** 0.0.0.0/0 (or specific IP)
   - **Description:** Secure AI Chat

### Google Cloud Platform (GCP)

1. Go to **VPC Network** → **Firewall**
2. **Create Firewall Rule**
3. Configure:
   - **Name:** allow-secure-ai-chat
   - **Direction:** Ingress
   - **Action:** Allow
   - **Targets:** All instances in the network
   - **Source IP ranges:** 0.0.0.0/0
   - **Protocols and ports:** TCP: 3000

### Microsoft Azure

1. Go to **VM** → **Networking**
2. **Add Inbound Port Rule**
3. Configure:
   - **Name:** secure-ai-chat
   - **Port:** 3000
   - **Protocol:** TCP
   - **Source:** Any
   - **Action:** Allow

### DigitalOcean

1. Go to **Networking** → **Firewalls**
2. **Create Firewall**
3. **Inbound Rules:**
   - **Type:** Custom
   - **Protocol:** TCP
   - **Port Range:** 3000
   - **Sources:** All IPv4, All IPv6

### Linode

1. Go to **Firewalls** → **Create Firewall**
2. **Inbound Rules:**
   - **Label:** secure-ai-chat
   - **Protocol:** TCP
   - **Ports:** 3000
   - **Action:** Accept
   - **Sources:** 0.0.0.0/0

## 🔧 Complete Fix Procedure

If the application isn't accessible after installation:

```bash
# 1. Run diagnostic script
sudo bash scripts/fix-public-access.sh

# 2. If still not working, check logs
sudo journalctl -u secure-ai-chat -n 100 --no-pager

# 3. Verify binding
sudo ss -tlnp | grep :3000

# 4. Test locally
curl http://localhost:3000/api/health

# 5. Get public IP
hostname -I

# 6. Test from external machine
curl http://YOUR_PUBLIC_IP:3000/api/health
```

## 📋 Verification Checklist

After fixing, verify:

- [ ] Service is running (`systemctl status secure-ai-chat`)
- [ ] Application listening on `0.0.0.0:3000` (not `127.0.0.1:3000`)
- [ ] UFW allows port 3000 (if using UFW)
- [ ] Cloud provider firewall allows port 3000
- [ ] Local access works (`curl http://localhost:3000/api/health`)
- [ ] Public access works (`curl http://PUBLIC_IP:3000/api/health`)

## 🚨 Troubleshooting

### Issue: Still binding to 127.0.0.1 after fixes

**Solution:**
```bash
# Check package.json start script
cat package.json | grep '"start"'

# Should be: "start": "next start"
# Next.js reads HOSTNAME from environment

# Verify environment is set
sudo systemctl show secure-ai-chat | grep HOSTNAME

# Restart service
sudo systemctl restart secure-ai-chat

# Wait a few seconds and check again
sleep 5
sudo ss -tlnp | grep :3000
```

### Issue: Firewall configured but still not accessible

**Possible causes:**
1. Cloud provider firewall not configured
2. Multiple firewall layers (UFW + cloud provider)
3. Network ACL blocking traffic
4. Application not actually listening on 0.0.0.0

**Solution:**
```bash
# Check all firewall layers
sudo ufw status
# Check cloud provider firewall (AWS/GCP/Azure console)

# Verify application binding
sudo ss -tlnp | grep :3000

# Test from same machine
curl http://localhost:3000/api/health

# Test from external machine
curl http://PUBLIC_IP:3000/api/health
```

### Issue: Service starts but stops immediately

**Solution:**
```bash
# Check logs for errors
sudo journalctl -u secure-ai-chat -n 100 --no-pager

# Check if build exists
ls -la /home/adminuser/secure-ai-chat/.next

# Rebuild if needed
cd /home/adminuser/secure-ai-chat
sudo -u adminuser npm run build
sudo systemctl restart secure-ai-chat
```

## 📚 Related Scripts

- `scripts/fix-public-access.sh` - Automated diagnostic and fix
- `deploy-ubuntu-vm.sh` - Updated with firewall configuration
- `PRODUCTION_CLEAN_REINSTALL.md` - Complete reinstall guide

---

**Last Updated:** January 12, 2026  
**Status:** ✅ Fixed in deployment script
