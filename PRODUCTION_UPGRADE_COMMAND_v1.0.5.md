# Production VM Upgrade Command - Version 1.0.5

## 🚀 Single-Step Remote VM Upgrade Command

Update your remote production VM with a seamless upgrade and reboot using this single command:

```bash
ssh adminuser@YOUR_VM_IP "cd /home/adminuser/secure-ai-chat && \
  git fetch origin && \
  git checkout release/v1.0.5-new && \
  git pull origin release/v1.0.5-new && \
  npm ci && \
  npm run build && \
  sudo systemctl restart secure-ai-chat && \
  sleep 10 && \
  curl -sf http://localhost:3000/api/health > /dev/null && \
  echo '✅ Upgrade successful' || echo '⚠️  Upgrade completed, verify manually' && \
  sudo reboot"
```

---

## 📋 Command Breakdown

This command performs the following steps:

1. **SSH Connection**: Connects to the remote VM as `adminuser`
2. **Navigate to Repository**: Changes to `/home/adminuser/secure-ai-chat`
3. **Fetch Latest**: Gets latest changes from GitHub
4. **Checkout Branch**: Switches to `release/v1.0.5-new`
5. **Pull Updates**: Pulls latest code from the branch
6. **Clean Install**: Runs `npm ci` for clean dependency installation
7. **Build Application**: Builds the Next.js application
8. **Restart Service**: Restarts the systemd service
9. **Health Check**: Verifies the service is running
10. **Reboot VM**: Reboots the VM for a clean restart

---

## 🔧 Customization Options

### Without Reboot (if you prefer manual reboot)

```bash
ssh adminuser@YOUR_VM_IP "cd /home/adminuser/secure-ai-chat && \
  git fetch origin && \
  git checkout release/v1.0.5-new && \
  git pull origin release/v1.0.5-new && \
  npm ci && \
  npm run build && \
  sudo systemctl restart secure-ai-chat && \
  sleep 10 && \
  curl -sf http://localhost:3000/api/health && \
  echo '✅ Upgrade successful'"
```

### With Backup Before Upgrade

```bash
ssh adminuser@YOUR_VM_IP "cd /home/adminuser/secure-ai-chat && \
  mkdir -p .backups && \
  tar -czf .backups/backup-\$(date +%Y%m%d-%H%M%S).tar.gz .next .secure-storage package.json package-lock.json 2>/dev/null && \
  git fetch origin && \
  git checkout release/v1.0.5-new && \
  git pull origin release/v1.0.5-new && \
  npm ci && \
  npm run build && \
  sudo systemctl restart secure-ai-chat && \
  sleep 10 && \
  curl -sf http://localhost:3000/api/health > /dev/null && \
  echo '✅ Upgrade successful' || echo '⚠️  Upgrade completed, verify manually' && \
  sudo reboot"
```

### Using the Upgrade Script (Recommended)

```bash
ssh adminuser@YOUR_VM_IP "cd /home/adminuser/secure-ai-chat && \
  git fetch origin && \
  git checkout release/v1.0.5-new && \
  git pull origin release/v1.0.5-new && \
  bash scripts/upgrade-production.sh && \
  sudo reboot"
```

---

## 🔐 SSH Key Setup (One-Time)

If you haven't set up SSH keys, you'll need to enter the password. For passwordless access:

```bash
# On your local machine
ssh-copy-id adminuser@YOUR_VM_IP

# Then use the command above without password prompts
```

---

## ✅ Verification After Upgrade

After the VM reboots, verify the upgrade:

```bash
# Wait for VM to come back online (usually 1-2 minutes)
sleep 120

# Check service status
ssh adminuser@YOUR_VM_IP "sudo systemctl status secure-ai-chat"

# Check health endpoint
ssh adminuser@YOUR_VM_IP "curl http://localhost:3000/api/health"

# Check version
ssh adminuser@YOUR_VM_IP "cd /home/adminuser/secure-ai-chat && node -p \"require('./package.json').version\""
```

---

## 🛠️ Troubleshooting

### If Upgrade Fails

1. **Check Git Status**:
   ```bash
   ssh adminuser@YOUR_VM_IP "cd /home/adminuser/secure-ai-chat && git status"
   ```

2. **Check Service Logs**:
   ```bash
   ssh adminuser@YOUR_VM_IP "sudo journalctl -u secure-ai-chat -n 50"
   ```

3. **Manual Rollback** (if needed):
   ```bash
   ssh adminuser@YOUR_VM_IP "cd /home/adminuser/secure-ai-chat && \
     git checkout release/v1.0.5 && \
     npm ci && \
     npm run build && \
     sudo systemctl restart secure-ai-chat"
   ```

---

## 📝 Notes

- **Repository Path**: `/home/adminuser/secure-ai-chat`
- **Branch**: `release/v1.0.5-new`
- **Service Name**: `secure-ai-chat` (systemd)
- **Port**: `3000` (default)
- **Reboot**: VM will reboot automatically after upgrade

---

## 🎯 Quick Reference

**Replace `YOUR_VM_IP` with your actual VM IP address:**

```bash
ssh adminuser@YOUR_VM_IP "cd /home/adminuser/secure-ai-chat && git fetch origin && git checkout release/v1.0.5-new && git pull origin release/v1.0.5-new && npm ci && npm run build && sudo systemctl restart secure-ai-chat && sleep 10 && curl -sf http://localhost:3000/api/health > /dev/null && echo '✅ Upgrade successful' || echo '⚠️  Upgrade completed, verify manually' && sudo reboot"
```

---

**Version**: 1.0.5  
**Last Updated**: January 2026
