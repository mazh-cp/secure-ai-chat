# Fresh VM Installation Guide

**Purpose:** Complete fresh installation on a new Ubuntu VM with public IP access configured

## 🚀 Quick Install

### One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fresh-install-vm.sh | sudo bash
```

### Download and Run

```bash
# Download the script
wget https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fresh-install-vm.sh

# Make it executable
chmod +x fresh-install-vm.sh

# Run it
sudo bash fresh-install-vm.sh
```

## 📋 What the Script Does

### Complete Installation Process

1. **Update OS Packages**
   - Updates package list
   - Upgrades system packages
   - Installs required tools (git, curl, build-essential)

2. **Install Node.js 25.2.1**
   - Installs NVM (Node Version Manager)
   - Installs Node.js v25.2.1
   - Sets as default version

3. **Clone Repository**
   - Clones from GitHub (main branch)
   - Or updates existing repository

4. **Fix Permissions**
   - Sets correct ownership
   - Ensures write permissions

5. **Install Dependencies**
   - Fresh npm install
   - Handles permission errors gracefully

6. **Create Environment File**
   - Creates `.env` with `HOSTNAME=0.0.0.0` for public access
   - Sets `PORT=3000`
   - Configures production mode

7. **Build Application**
   - Clears build cache
   - Runs production build

8. **Set Permissions**
   - Creates storage directories
   - Sets secure permissions

9. **Configure Firewall (UFW)**
   - Allows SSH (port 22)
   - Allows application port (3000)
   - Enables UFW

10. **Create Systemd Service**
    - Creates service file with `HOSTNAME=0.0.0.0`
    - Configures auto-restart
    - Sets correct paths

11. **Start Service**
    - Enables service (starts on boot)
    - Starts application

12. **Verification**
    - Checks service status
    - Verifies network binding (0.0.0.0:3000)
    - Tests health endpoint
    - Displays access URLs

## ✅ Public IP Access Configuration

The script automatically configures:

- ✅ **HOSTNAME=0.0.0.0** in `.env` file
- ✅ **HOSTNAME=0.0.0.0** in systemd service
- ✅ **UFW firewall** allows port 3000
- ✅ **Network binding** verified (0.0.0.0:3000)

## 🌐 Cloud Provider Firewall

**IMPORTANT:** If using a cloud provider (AWS, GCP, Azure, DigitalOcean, etc.), you MUST also configure their firewall:

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

## 🔍 Verification After Installation

### Check Service Status

```bash
sudo systemctl status secure-ai-chat
```

### Check Network Binding

```bash
sudo ss -tlnp | grep :3000
```

**Expected output:**
```
LISTEN 0 511 0.0.0.0:3000 0.0.0.0:* users:(("node",pid=1234,fd=20))
```

**If you see `127.0.0.1:3000` instead:**
- Application is only accessible locally
- Run: `sudo bash scripts/fix-public-access.sh`

### Test Health Endpoint

```bash
# Local test
curl http://localhost:3000/api/health

# Public IP test (replace with your IP)
curl http://YOUR_PUBLIC_IP:3000/api/health
```

### Get Public IP

```bash
hostname -I
```

## 📝 Post-Installation Steps

### 1. Configure API Keys

Go to Settings page and configure:
- OpenAI API key (required for chat)
- Lakera AI key (optional, for security scanning)
- Checkpoint TE key (optional, for file sandboxing)

**Access:** `http://YOUR_PUBLIC_IP:3000/settings`

### 2. Set Up PIN (Optional)

- Go to Settings → PIN Protection
- Set a 4-8 digit PIN
- This protects API key deletion operations

### 3. Test Features

- **Chat:** Test sending messages
- **Model Selector:** Should work automatically
- **File Upload:** Test file scanning
- **Release Notes:** Navigate to `/release-notes`

## 🚨 Troubleshooting

### Issue: Application not accessible from public IP

**Check 1: Network Binding**
```bash
sudo ss -tlnp | grep :3000
# Should show: 0.0.0.0:3000 (NOT 127.0.0.1:3000)
```

**Check 2: Firewall**
```bash
sudo ufw status
# Should show port 3000 allowed
```

**Check 3: Cloud Provider Firewall**
- Verify security group/firewall rules allow port 3000
- Check inbound rules in cloud console

**Fix:**
```bash
# Run diagnostic script
sudo bash scripts/fix-public-access.sh
```

### Issue: Service fails to start

**Check logs:**
```bash
sudo journalctl -u secure-ai-chat -n 50 --no-pager
```

**Common causes:**
1. Build missing - Run: `sudo -u adminuser npm run build`
2. Permissions - Run: `sudo chown -R adminuser:adminuser /home/adminuser/secure-ai-chat`
3. Node.js path incorrect - Run: `sudo bash scripts/create-systemd-service.sh`

### Issue: Permission denied during install

**Fix:**
```bash
cd /home/adminuser/secure-ai-chat
sudo chown -R adminuser:adminuser .
sudo chmod -R u+w .
```

## 📊 Expected Output

When successful, you should see:

```
╔═══════════════════════════════════════════════════════════════╗
║     Installation Complete                                     ║
╚═══════════════════════════════════════════════════════════════╝

✅ Secure AI Chat v1.0.7 installed successfully

Access Information:
   Local:   http://localhost:3000
   Network: http://YOUR_PUBLIC_IP:3000

⚠️  IMPORTANT: Cloud Provider Firewall
   If using AWS/GCP/Azure/DigitalOcean/etc., you MUST also configure
   their firewall to allow inbound traffic on port 3000
```

## 🔗 Related Scripts

- `scripts/fresh-install-vm.sh` - This installation script
- `scripts/fix-public-access.sh` - Fix public access issues
- `scripts/create-systemd-service.sh` - Recreate service if needed
- `deploy-ubuntu-vm.sh` - Alternative deployment script

## ⚠️ Important Notes

1. **Public Access:** Script configures `HOSTNAME=0.0.0.0` automatically
2. **Firewall:** UFW is configured, but cloud provider firewall must be configured separately
3. **Service User:** Default is `adminuser`, ensure this user exists
4. **Node Version:** Requires Node.js 25.2.1 (installed automatically)
5. **Port:** Default is 3000, change `APP_PORT` in script if needed

## 🎯 Quick Reference

```bash
# Install
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fresh-install-vm.sh | sudo bash

# Verify
sudo systemctl status secure-ai-chat
sudo ss -tlnp | grep :3000
curl http://localhost:3000/api/health

# Access
http://YOUR_PUBLIC_IP:3000
```

---

**Last Updated:** January 12, 2026  
**Script:** `scripts/fresh-install-vm.sh`  
**Version:** 1.0.7  
**Status:** ✅ Ready for Production
