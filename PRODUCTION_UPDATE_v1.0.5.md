# Production Update Command - Version 1.0.5

## 🚀 One-Step Production Update

Update your production VM to Secure AI Chat v1.0.5 with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/v1.0.5/scripts/upgrade-production.sh | bash
```

---

## 📋 What This Updates

Version 1.0.5 includes:

- **OpenAI Model Selector**: Choose different OpenAI models from dropdown
- **Save Keys Button Fix**: Visible in both light and dark modes
- **Lakera Project ID Visibility**: Made visible for policy verification

---

## 🔄 Manual Update Steps

If you prefer to update manually:

```bash
# Navigate to application directory
cd /home/adminuser/secure-ai-chat

# Fetch latest changes
git fetch origin

# Switch to release branch
git checkout release/v1.0.5

# Pull latest changes
git pull origin release/v1.0.5

# Install dependencies
npm ci

# Build application
npm run build

# Restart service
sudo systemctl restart secure-ai-chat

# Wait for service to start
sleep 5

# Verify deployment
curl http://localhost:3000/api/health
```

---

## ✅ Verification

After updating, verify:

1. **Service Status**:
   ```bash
   sudo systemctl status secure-ai-chat
   ```

2. **Health Check**:
   ```bash
   curl http://localhost:3000/api/health
   ```
   Expected: `{"status":"ok",...}`

3. **Application Features**:
   - Open the application in browser
   - Navigate to Chat page
   - Verify Model Selector appears above chat messages
   - Test model selection functionality
   - Verify Save Keys button visible in light mode
   - Check Lakera Project ID field is visible

---

## 🔙 Rollback

If you need to rollback to a previous version:

```bash
cd /home/adminuser/secure-ai-chat
git checkout release/v1.0.4  # or previous version
git pull origin release/v1.0.4
npm ci
npm run build
sudo systemctl restart secure-ai-chat
```

---

## 📝 Notes

- **Branch**: `release/v1.0.5`
- **Version**: 1.0.5
- **Release Date**: January 2025
- **Breaking Changes**: None
- **Backward Compatibility**: Maintained

---

## 🆘 Troubleshooting

If the update fails:

1. Check git access:
   ```bash
   git fetch origin
   ```

2. Check Node.js version:
   ```bash
   node -v  # Should be v25.2.1
   ```

3. Check service logs:
   ```bash
   sudo journalctl -u secure-ai-chat -n 50
   ```

4. Verify build:
   ```bash
   npm run build
   ```

---

**Previous Version**: [v1.0.4](PRODUCTION_UPDATE_v1.0.4.md) (if exists)  
**Release Notes**: [RELEASE_NOTES_v1.0.5.md](RELEASE_NOTES_v1.0.5.md)