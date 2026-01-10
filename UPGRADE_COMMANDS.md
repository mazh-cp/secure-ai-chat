# One-Step Production Upgrade Commands

**Version**: 1.0.4  
**Branch**: `release/unifi-theme-safe-final`  
**Last Updated**: 2026-01-XX

## 🚀 Quick Start - One Command

SSH into your production VM and run:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/unifi-theme-safe-final/scripts/upgrade-production.sh | bash
```

That's it! The script will automatically:
- ✅ Backup current deployment
- ✅ Pull latest code from GitHub
- ✅ Install dependencies
- ✅ Build the application
- ✅ Restart the service
- ✅ Verify deployment

---

## 📋 Alternative Commands

### Option 1: Download and Run Locally

```bash
# Download the script
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/unifi-theme-safe-final/scripts/upgrade-production.sh -o upgrade.sh

# Make it executable
chmod +x upgrade.sh

# Run it
./upgrade.sh
```

### Option 2: If Repository Already Exists

```bash
cd /home/adminuser/secure-ai-chat
git pull origin release/unifi-theme-safe-final
bash scripts/upgrade-production.sh
```

### Option 3: Custom Configuration

```bash
# Custom repository directory
REPO_DIR=/opt/secure-ai-chat bash scripts/upgrade-production.sh

# Custom branch
BRANCH=main bash scripts/upgrade-production.sh

# All custom
REPO_DIR=/opt/secure-ai-chat \
BRANCH=main \
SERVICE_NAME=my-app \
bash scripts/upgrade-production.sh
```

---

## ✅ Verification Commands

After upgrade, verify everything works:

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check health endpoint
curl http://localhost:3000/api/health

# Check service logs
sudo journalctl -u secure-ai-chat -n 50
```

---

## 🔧 Default Configuration

| Variable | Default Value |
|----------|---------------|
| `REPO_DIR` | `/home/adminuser/secure-ai-chat` |
| `BRANCH` | `release/unifi-theme-safe-final` |
| `SERVICE_USER` | `adminuser` |
| `SERVICE_NAME` | `secure-ai-chat` |

---

## 📚 Detailed Documentation

For more information, see:
- `PRODUCTION_UPGRADE.md` - Complete upgrade guide with troubleshooting
- `RELEASE_NOTES_v1.0.4.md` - Release notes for version 1.0.4
- `RELEASE_CHECKLIST_v1.0.4.md` - Pre-deployment checklist

---

## 🆘 Quick Troubleshooting

### Permission Errors
```bash
sudo chown -R adminuser:adminuser /home/adminuser/secure-ai-chat
```

### Service Not Starting
```bash
sudo journalctl -u secure-ai-chat -n 100
sudo systemctl restart secure-ai-chat
```

### Build Fails
```bash
cd /home/adminuser/secure-ai-chat
rm -rf .next node_modules
npm ci
npm run build
```

---

**Need Help?** Check `PRODUCTION_UPGRADE.md` for detailed troubleshooting.
