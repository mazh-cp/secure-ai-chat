# Local Installation Validation Guide

This guide provides step-by-step instructions for performing a local installation and validating all services and stability.

## Prerequisites

- Ubuntu 20.04+ or Debian 11+ (VM, container, or physical machine)
- Internet connection
- Sudo/root access
- At least 2GB RAM and 5GB disk space

## Pre-Installation Validation

### Step 1: Dry-Run Test

Before installing, validate the script:

```bash
cd secure-ai-chat
bash scripts/test-install-dry-run.sh
```

This will check:
- Script syntax
- Required functions
- Installation steps
- Error handling
- Clean install support
- Secure storage setup
- Systemd service setup
- Firewall configuration

### Step 2: Review Script

```bash
# Review the installation script
cat scripts/install-ubuntu-v1.0.11.sh | less

# Check for any customizations needed
grep -n "INSTALL_DIR\|TAG\|NODE_VERSION" scripts/install-ubuntu-v1.0.11.sh
```

## Installation Process

### Option 1: Standard Installation

```bash
# Clone repository first (for testing)
cd ~
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat
git checkout v1.0.11

# Run installation
bash scripts/install-ubuntu-v1.0.11.sh
```

### Option 2: Clean Installation

```bash
# Remove existing installation and start fresh
CLEAN_INSTALL=true bash scripts/install-ubuntu-v1.0.11.sh
```

### Option 3: Custom Directory

```bash
# Install to custom directory
INSTALL_DIR=/opt bash scripts/install-ubuntu-v1.0.11.sh
```

## Installation Validation Checklist

### During Installation

Monitor the installation process and verify:

- [ ] System packages installed successfully
- [ ] Node.js v25.2.1 installed via nvm
- [ ] Repository cloned/updated correctly
- [ ] npm dependencies installed
- [ ] `.env.local` file created
- [ ] `.secure-storage` directory created with 700 permissions
- [ ] Application built successfully (`.next` directory exists)
- [ ] Systemd service created and enabled
- [ ] UFW firewall configured
- [ ] Service started successfully

### Post-Installation Validation

Run the comprehensive validation script:

```bash
cd ~/secure-ai-chat
bash scripts/validate-fresh-install.sh
```

Expected output:
```
✅ All checks passed! Installation is complete and ready.
```

## Service Validation

### 1. Systemd Service Status

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Expected: Active (running)
```

### 2. Service Logs

```bash
# View recent logs
sudo journalctl -u secure-ai-chat -n 50

# Follow logs in real-time
sudo journalctl -u secure-ai-chat -f
```

Look for:
- ✅ "Ready on http://0.0.0.0:3000"
- ✅ No error messages
- ✅ Application started successfully

### 3. Port Listening

```bash
# Check if port 3000 is listening
sudo ss -tlnp | grep :3000

# Expected: 0.0.0.0:3000 (NOT 127.0.0.1:3000)
```

### 4. Health Endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# Expected: {"status":"ok"}

# Version check
curl http://localhost:3000/api/version

# Expected: {"version":"1.0.11"}

# Keys status
curl http://localhost:3000/api/keys

# Expected: {"configured":{...},"source":{...}}
```

### 5. Web Interface

```bash
# Open in browser
# Local: http://localhost:3000
# Network: http://your-server-ip:3000
```

Verify:
- ✅ Home page loads
- ✅ Settings page accessible
- ✅ Chat page accessible
- ✅ No console errors in browser

## Functional Validation

### 1. API Keys Configuration

1. Go to Settings page: `http://localhost:3000/settings`
2. Enter test API keys (or real keys)
3. Click "Save Settings"
4. Verify:
   - ✅ Success message appears
   - ✅ Keys are saved (check `.secure-storage/api-keys.enc`)
   - ✅ Status indicators show configured

### 2. Provider Selection

1. Go to Chat page: `http://localhost:3000`
2. Check provider selector:
   - ✅ Shows "OpenAI" and "Azure OpenAI" options
   - ✅ Configured providers are enabled
   - ✅ Unconfigured providers show "(Not configured)"

### 3. Model Selection

1. Select a provider (e.g., OpenAI)
2. Check model selector:
   - ✅ Shows available models
   - ✅ Can select different models
   - ✅ Model persists in localStorage

### 4. Chat Functionality

1. Enter a test message
2. Send message
3. Verify:
   - ✅ Message appears in chat
   - ✅ Response is received (if API keys are valid)
   - ✅ No errors in console
   - ✅ Loading states work correctly

### 5. File Upload (RAG)

1. Go to Files page: `http://localhost:3000/files`
2. Upload a test file
3. Verify:
   - ✅ File appears in list
   - ✅ File metadata is displayed
   - ✅ Can delete files
   - ✅ "Clear All Files" works

### 6. Azure OpenAI Integration

1. Configure Azure OpenAI keys in Settings
2. Validate credentials using "Validate" button
3. Switch to Azure OpenAI provider in Chat
4. Verify:
   - ✅ Provider switches successfully
   - ✅ Model selector shows Azure-compatible models
   - ✅ Can send messages (if keys are valid)

## Stability Testing

### 1. Service Restart

```bash
# Restart service
sudo systemctl restart secure-ai-chat

# Wait 10 seconds
sleep 10

# Check status
sudo systemctl status secure-ai-chat

# Verify health endpoint
curl http://localhost:3000/api/health
```

Expected: Service restarts successfully and health endpoint responds.

### 2. Service Stop/Start

```bash
# Stop service
sudo systemctl stop secure-ai-chat

# Verify stopped
sudo systemctl status secure-ai-chat

# Start service
sudo systemctl start secure-ai-chat

# Wait and verify
sleep 10
curl http://localhost:3000/api/health
```

Expected: Service stops and starts correctly.

### 3. System Reboot

```bash
# Reboot system
sudo reboot

# After reboot, verify:
sudo systemctl status secure-ai-chat
curl http://localhost:3000/api/health
```

Expected: Service starts automatically on boot.

### 4. Log Rotation

```bash
# Check log size
sudo journalctl -u secure-ai-chat --no-pager | wc -l

# Service should handle log rotation automatically
```

### 5. Error Recovery

```bash
# Simulate error by stopping service
sudo systemctl stop secure-ai-chat

# Service should have Restart=always, so it should restart
sleep 15
sudo systemctl status secure-ai-chat
```

Expected: Service automatically restarts after failure.

## Performance Testing

### 1. Response Times

```bash
# Test health endpoint response time
time curl -s http://localhost:3000/api/health

# Test version endpoint
time curl -s http://localhost:3000/api/version

# Expected: < 100ms for local requests
```

### 2. Memory Usage

```bash
# Check memory usage
ps aux | grep node | grep secure-ai-chat

# Or using systemd
systemctl status secure-ai-chat | grep Memory
```

### 3. CPU Usage

```bash
# Monitor CPU usage
top -p $(pgrep -f "secure-ai-chat")

# Or
htop -p $(pgrep -f "secure-ai-chat")
```

## Security Validation

### 1. File Permissions

```bash
# Check secure storage permissions
ls -la ~/secure-ai-chat/.secure-storage/

# Expected: drwx------ (700)
```

### 2. Encrypted Storage

```bash
# Verify keys are encrypted
file ~/secure-ai-chat/.secure-storage/api-keys.enc

# Should not be readable plaintext
cat ~/secure-ai-chat/.secure-storage/api-keys.enc
# Should show encrypted data (not plain API keys)
```

### 3. Firewall Rules

```bash
# Check UFW rules
sudo ufw status numbered

# Verify port 3000 is allowed
sudo ufw status | grep 3000
```

### 4. Network Security

```bash
# Verify listening on 0.0.0.0 (not just localhost)
sudo ss -tlnp | grep :3000

# Should show: 0.0.0.0:3000 (allows external access)
# NOT: 127.0.0.1:3000 (localhost only)
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
sudo journalctl -u secure-ai-chat -n 100

# Common issues:
# - Port already in use
# - Missing dependencies
# - Permission errors
# - Build not completed
```

### Health Endpoint Not Responding

```bash
# Check if service is running
sudo systemctl status secure-ai-chat

# Check if port is listening
sudo ss -tlnp | grep :3000

# Check firewall
sudo ufw status

# Check application logs
sudo journalctl -u secure-ai-chat -f
```

### API Keys Not Saving

```bash
# Check secure storage directory
ls -la ~/secure-ai-chat/.secure-storage/

# Check permissions
stat ~/secure-ai-chat/.secure-storage/

# Check logs
sudo journalctl -u secure-ai-chat | grep -i "keys saved"
```

## Validation Report Template

After completing validation, document results:

```markdown
# Installation Validation Report

**Date:** [Date]
**Version:** 1.0.11
**Environment:** [Ubuntu/Debian version]

## Installation
- [ ] Installation completed successfully
- [ ] All steps completed without errors
- [ ] Validation script passed

## Services
- [ ] Systemd service running
- [ ] Service starts on boot
- [ ] Service restarts on failure
- [ ] Logs are accessible

## Functionality
- [ ] Health endpoints responding
- [ ] Web interface accessible
- [ ] API keys can be saved
- [ ] Providers can be selected
- [ ] Chat functionality works
- [ ] File upload works

## Stability
- [ ] Service survives restart
- [ ] Service survives reboot
- [ ] No memory leaks observed
- [ ] Performance acceptable

## Security
- [ ] Secure storage permissions correct
- [ ] Keys are encrypted
- [ ] Firewall configured
- [ ] Network access controlled

## Issues Found
[List any issues]

## Recommendations
[List recommendations]
```

## Next Steps

After successful validation:

1. ✅ Document any issues found
2. ✅ Update configuration if needed
3. ✅ Configure production API keys
4. ✅ Set up monitoring/alerting
5. ✅ Create backup procedures
6. ✅ Document deployment process

## Related Documentation

- [Fresh Install Validation Guide](./FRESH_INSTALL_VALIDATION.md)
- [Installation Fix Guide](./INSTALLATION_FIX_v1.0.11.md)
- [API Keys Save Fix](./API_KEYS_SAVE_FIX.md)
- [User Guide](./USER_GUIDE.md)
