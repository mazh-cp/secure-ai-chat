# Quick Local Installation Test Guide

## Pre-Installation Test (Dry-Run)

```bash
cd secure-ai-chat
bash scripts/test-install-dry-run.sh
```

This validates the script without installing anything.

## Installation Steps

### 1. Prepare Environment

```bash
# On Ubuntu/Debian VM or container
cd ~
```

### 2. Run Installation

```bash
# Option A: Direct from GitHub
TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh | bash

# Option B: Clone and run
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat
git checkout v1.0.11
bash scripts/install-ubuntu-v1.0.11.sh
```

### 3. Validate Installation

```bash
cd ~/secure-ai-chat
bash scripts/validate-fresh-install.sh
```

## Quick Service Checks

```bash
# 1. Service status
sudo systemctl status secure-ai-chat

# 2. Health check
curl http://localhost:3000/api/health

# 3. Version check
curl http://localhost:3000/api/version

# 4. Port listening
sudo ss -tlnp | grep :3000

# 5. View logs
sudo journalctl -u secure-ai-chat -n 50
```

## Quick Functional Tests

1. **Web Interface**: Open `http://localhost:3000`
2. **Settings**: Go to `/settings` and save API keys
3. **Chat**: Go to `/` and test chat functionality
4. **Files**: Go to `/files` and test file upload

## Expected Results

✅ Service running
✅ Health endpoint: `{"status":"ok"}`
✅ Version endpoint: `{"version":"1.0.11"}`
✅ Port 3000 listening on 0.0.0.0
✅ Web interface accessible
✅ All validation checks pass

## Troubleshooting

If service won't start:
```bash
sudo journalctl -u secure-ai-chat -n 100
```

If health endpoint fails:
```bash
# Check if running
sudo systemctl status secure-ai-chat

# Restart if needed
sudo systemctl restart secure-ai-chat
```
