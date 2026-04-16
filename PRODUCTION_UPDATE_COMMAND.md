# Production Update Command - Border Enhancements

**Version**: 1.0.4  
**Branch**: `release/unifi-theme-safe-final`  
**Date**: 2026-01-XX

## 🚀 One-Step Production Update Command

Run this command on your production VM:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/unifi-theme-safe-final/scripts/upgrade-production.sh | bash
```

---

## 📋 What This Update Includes

This update adds clear, visible borders to all sections for better visibility in both light and dark modes:

1. ✅ **Main Headline Area** (Chat page) - 2px border
2. ✅ **Side Bar Section** (Layout) - 2px right border
3. ✅ **Lakera AI Protection Sections** - 2px border around card
4. ✅ **Chat Window and Editing Section** - 2px border around messages area
5. ✅ **Chat Input Area** - Clear white border frame (enhanced)
6. ✅ **File Upload & RAG Page** - Borders on all sections
7. ✅ **Settings Page** - 2px borders on all key entry fields

---

## 🔄 Alternative Update Methods

### Option 1: If Repository Already Exists

```bash
cd /home/adminuser/secure-ai-chat
git pull origin release/unifi-theme-safe-final
npm ci
npm run build
sudo systemctl restart secure-ai-chat
sleep 5
curl http://localhost:3000/api/health
```

### Option 2: Manual One-Line Command

```bash
cd /home/adminuser/secure-ai-chat && git fetch origin && git checkout release/unifi-theme-safe-final && git pull origin release/unifi-theme-safe-final && npm ci && npm run build && sudo systemctl restart secure-ai-chat && sleep 5 && curl http://localhost:3000/api/health && echo "✅ Update complete!"
```

### Option 3: Custom Configuration

```bash
REPO_DIR=/home/adminuser/secure-ai-chat \
BRANCH=release/unifi-theme-safe-final \
SERVICE_NAME=secure-ai-chat \
bash scripts/upgrade-production.sh
```

---

## ✅ Verification Steps

After updating, verify the changes:

1. **Check Service Status**:

   ```bash
   sudo systemctl status secure-ai-chat
   ```

2. **Check Health Endpoint**:

   ```bash
   curl http://localhost:3000/api/health
   ```

3. **Visual Verification**:
   - Open the application in your browser
   - Switch to light mode to see the borders clearly
   - Verify all sections have visible borders:
     - Main headline area
     - Sidebar section
     - Lakera AI Protection section
     - Chat window
     - Chat input area
     - File Upload page sections
     - Settings page key fields

---

## 📝 Changes Summary

| Component                      | Change                                | Border Style       |
| ------------------------------ | ------------------------------------- | ------------------ |
| `app/page.tsx`                 | Main headline, Lakera card, Chat card | 2px border         |
| `components/Layout.tsx`        | Sidebar                               | 2px right border   |
| `components/LakeraToggles.tsx` | Protection card                       | 2px border         |
| `components/ChatInterface.tsx` | Messages area                         | 2px border         |
| `components/MessageInput.tsx`  | Input frame                           | White border frame |
| `app/files/page.tsx`           | All sections                          | 2px borders        |
| `components/SettingsForm.tsx`  | Key input fields                      | 2px borders        |

---

## 🎨 Visual Improvements

- **Theme-Aware**: All borders use `rgb(var(--border))` for theme compatibility
- **Light Mode**: Clear, visible borders for better section separation
- **Dark Mode**: Subtle borders that maintain the dark theme aesthetic
- **Consistency**: Unified 2px border style across all sections
- **Professional**: Polished appearance with clear visual hierarchy

---

## 🔒 Security Notes

- ✅ No breaking changes
- ✅ All changes are visual only (CSS/styling)
- ✅ No API or functionality changes
- ✅ Backward compatible with existing deployments

---

## ⚠️ Troubleshooting

### If Update Fails

1. **Check Git Status**:

   ```bash
   cd /home/adminuser/secure-ai-chat
   git status
   ```

2. **Reset and Pull**:

   ```bash
   git fetch origin
   git reset --hard origin/release/unifi-theme-safe-final
   npm ci
   npm run build
   ```

3. **Restart Service**:
   ```bash
   sudo systemctl restart secure-ai-chat
   ```

### If Service Won't Start

```bash
# Check logs
sudo journalctl -u secure-ai-chat -n 50

# Restart manually
sudo systemctl restart secure-ai-chat

# Verify status
sudo systemctl status secure-ai-chat
```

---

## 📚 Related Documentation

- `PRODUCTION_UPGRADE.md` - Detailed upgrade guide
- `UPGRADE_COMMANDS.md` - Quick reference commands
- `RELEASE_NOTES_v1.0.4.md` - Full release notes

---

**Last Updated**: 2026-01-XX  
**Branch**: `release/unifi-theme-safe-final`  
**Status**: ✅ Ready for Production
