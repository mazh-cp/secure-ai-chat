# Fresh Remote VM Installation Script - v1.0.11

**Version**: 1.0.11  
**Date**: January 16, 2026  
**Script**: `scripts/install-ubuntu-v1.0.11.sh`

---

## 🎯 Overview

This installation script combines:
- **Stable v1.0.10** foundation (proven, reliable)
- **All v1.0.11 updates** (Azure OpenAI, WAF, fixes)
- **All bug fixes** discovered during v1.0.11 development
- **Production-ready** configuration

---

## ✨ What's Included

### From v1.0.10 (Stable Base)
- Enhanced RAG system (automatic file indexing)
- Improved file access control
- Better content matching algorithms
- File size limit: 10MB
- File count limit: 5 files (updated to 10 in v1.0.11)

### From v1.0.11 (New Features)
- ✅ **Azure OpenAI Integration**
  - Full provider support
  - APIM gateway endpoint support
  - Real-time validation
  - Server-side secure storage

- ✅ **Check Point WAF Integration**
  - Middleware integration
  - WAF logs API
  - Health check endpoints

- ✅ **Enhanced RAG**
  - Increased to 10 files
  - Structured data extraction
  - Prompt security

- ✅ **Automatic Startup**
  - Systemd service configuration
  - Automatic start on boot
  - Proper directory handling (fixed)

- ✅ **All Bug Fixes**
  - Service directory fix
  - Azure connection error handling
  - Network timeout improvements
  - Better error messages

---

## 🚀 Quick Install

### Option 1: Install v1.0.11 (Recommended)

```bash
TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh | bash
```

### Option 2: Install Latest from Main

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh | bash
```

### Option 3: Local Installation

```bash
# Clone repository first
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat
git checkout v1.0.11

# Run script
bash scripts/install-ubuntu-v1.0.11.sh
```

---

## 📋 What the Script Does

### Step 1: System Dependencies
- Updates package list
- Installs: curl, git, build-essential, ca-certificates, gnupg, lsb-release, iproute2

### Step 2: Node.js Installation
- Installs nvm (Node Version Manager)
- Installs Node.js v25.2.1
- Sets as default version
- Verifies installation

### Step 3: Repository Setup
- Clones repository (or updates if exists)
- Checks out specified tag (default: v1.0.11)
- Handles both standard and APIM gateway endpoints

### Step 4: Dependencies
- Fixes permissions
- Installs npm dependencies (npm ci or npm install)
- Handles package-lock.json sync issues

### Step 5: Environment Configuration
- Creates `.env.local` from `.env.example`
- Includes all v1.0.11 environment variables:
  - OpenAI API key
  - Azure OpenAI API key and endpoint
  - Lakera AI configuration
  - Check Point TE configuration
  - Check Point WAF configuration (optional)
- Sets HOSTNAME=0.0.0.0 for public access

### Step 6: Build Application
- Runs type check
- Builds production bundle
- Verifies build artifacts

### Step 7: Systemd Service Setup
- Creates service file with **fixed directory handling**
- Proper ExecStart command: `cd` before `npm start`
- Enables service for boot startup
- Starts service immediately
- Verifies service is running

### Step 8: Firewall Configuration
- Installs UFW if needed
- Allows SSH (port 22)
- Allows application port (default: 3000)
- Enables UFW

### Step 9: Verification
- Checks Node.js version
- Verifies build artifacts
- Checks service status

---

## 🔧 Key Fixes Included

### 1. Service Directory Fix
**Problem**: Service was running from wrong directory  
**Fix**: ExecStart now includes `cd "$FULL_PATH"` before `npm start`

```ini
ExecStart=/usr/bin/env bash -lc 'source "/home/$USER/.nvm/nvm.sh" && nvm use 25.2.1 && cd "$FULL_PATH" && npm start'
```

### 2. Azure OpenAI Connection
**Problem**: "fetch failed" errors  
**Fix**: Enhanced error handling with 30-second timeout and better diagnostics

### 3. APIM Gateway Support
**Problem**: Only standard Azure OpenAI endpoints supported  
**Fix**: Auto-detection of APIM gateway endpoints (azure-api.net)

### 4. Automatic Startup
**Problem**: Manual start required  
**Fix**: Systemd service automatically created, enabled, and started

---

## 📦 Package Versions

### Dependencies (from package.json)
```json
{
  "next": "^14.0.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "typescript": "^5.2.2",
  "date-fns": "^2.30.0",
  "form-data": "^4.0.5",
  "undici": "^7.18.2"
}
```

### Node.js
- **Version**: 25.2.1 (pinned via .nvmrc)
- **Installed via**: nvm (Node Version Manager)

---

## 🎯 Installation Locations

### Default Installation
- **Directory**: `/opt/secure-ai-chat`
- **User**: Current user (who runs script)
- **Port**: 3000 (configurable via PORT environment variable)

### Custom Installation
```bash
# Custom directory
INSTALL_DIR=/home/myuser curl -fsSL ... | bash

# Custom port
PORT=8080 curl -fsSL ... | bash

# Custom tag
TAG=v1.0.10 curl -fsSL ... | bash
```

---

## ✅ Post-Installation

### 1. Configure API Keys

```bash
cd /opt/secure-ai-chat
nano .env.local
```

**Add your keys:**
```bash
# OpenAI (required for OpenAI provider)
OPENAI_API_KEY=sk-your-key-here

# Azure OpenAI (optional, for Azure provider)
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
# OR APIM gateway:
AZURE_OPENAI_ENDPOINT=https://staging-openai.azure-api.net/openai-gw-proxy-dev/

# Lakera AI (optional)
LAKERA_AI_KEY=your-lakera-key

# Check Point TE (optional)
CHECKPOINT_TE_API_KEY=your-checkpoint-key
```

### 2. Restart Service (if needed)

```bash
sudo systemctl restart secure-ai-chat
```

### 3. Verify Installation

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check health
curl http://localhost:3000/api/health

# Check version
curl http://localhost:3000/api/version
# Should return: {"version":"1.0.11"}
```

---

## 🔍 Verification Checklist

After installation, verify:

- [ ] Service is running: `sudo systemctl status secure-ai-chat`
- [ ] Port is listening: `sudo ss -tlnp | grep :3000`
- [ ] Health endpoint works: `curl http://localhost:3000/api/health`
- [ ] Version is correct: `curl http://localhost:3000/api/version`
- [ ] WAF health works: `curl http://localhost:3000/api/waf/health`
- [ ] Application accessible: Browser can access `http://VM_IP:3000`

---

## 🐛 Troubleshooting

### Service Not Starting

```bash
# Check logs
sudo journalctl -u secure-ai-chat -n 50

# Common issues:
# - Directory not found: Check FULL_PATH in service file
# - Node.js not found: Verify nvm path
# - Permission denied: Fix ownership
```

### Port Not Accessible

```bash
# Check firewall
sudo ufw status

# Check if listening
sudo ss -tlnp | grep :3000

# Should show: 0.0.0.0:3000 (not 127.0.0.1:3000)
```

### Build Failures

```bash
# Clean and rebuild
cd /opt/secure-ai-chat
rm -rf .next node_modules
npm install
npm run build
```

---

## 📊 Comparison: v1.0.10 vs v1.0.11 Script

| Feature | v1.0.10 | v1.0.11 Script |
|---------|---------|----------------|
| Base Version | v1.0.10 | v1.0.10 (stable) |
| Updates | - | All v1.0.11 features |
| Azure OpenAI | ❌ | ✅ Full support |
| WAF Integration | ❌ | ✅ Complete |
| Service Fix | ❌ | ✅ Fixed directory |
| Auto Startup | ❌ | ✅ Automatic |
| APIM Support | ❌ | ✅ Auto-detect |
| Error Handling | Basic | ✅ Enhanced |

---

## 🎉 Summary

This installation script provides:
- ✅ **Stable foundation** from v1.0.10
- ✅ **All v1.0.11 features** and improvements
- ✅ **All bug fixes** discovered during development
- ✅ **Production-ready** configuration
- ✅ **Automatic startup** via systemd
- ✅ **Comprehensive error handling**

**Ready for production deployment!**

---

**Script Version**: 1.0.11  
**Last Updated**: January 16, 2026
