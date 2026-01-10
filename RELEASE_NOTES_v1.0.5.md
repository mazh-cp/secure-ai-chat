# Release Notes - Version 1.0.5

## 🎉 Secure AI Chat v1.0.5

**Release Date:** January 2025  
**Status:** Stable Release  
**Branch:** `release/v1.0.5`

---

## 🆕 New Features

### OpenAI Model Selector

Users can now select different OpenAI models from a dropdown list on the Chat page:

- **Model Dropdown**: Displays available GPT models based on the configured OpenAI API key
- **Dynamic Model List**: Fetches available models from OpenAI API in real-time
- **Model Preference Persistence**: Selected model is saved to localStorage and persists across sessions
- **User-Friendly Display**: Model names are formatted for readability (e.g., "GPT-4o Mini", "GPT-4o")
- **Sorted List**: Models are sorted with newest models first for better UX
- **Secure Validation**: Only GPT models (gpt-*) are allowed for security
- **Default Model**: Falls back to `gpt-4o-mini` if no selection is made

### Technical Implementation

- **New API Route**: `/api/models` - Fetches available OpenAI models
- **New Component**: `ModelSelector` - Dropdown component for model selection
- **Enhanced Chat API**: Accepts and uses the selected model parameter
- **UI Integration**: Model selector displayed above chat messages (aligned right)
- **Theme Styling**: Styled with UniFi theme tokens for consistency

---

## 🐛 Bug Fixes

### Settings Page Enhancements

- **Save Keys Button Visibility**: Fixed Save Keys button not visible in light mode
  - Changed from invalid `var(--primary)` to `rgb(var(--accent))` for proper theme support
  - Button now clearly visible in both light and dark modes

- **Lakera Project ID Visibility**: Made Project ID field visible (text input instead of password)
  - Project ID is not sensitive data, so visibility helps with policy verification
  - Added helpful message about ensuring correct policy from Lakera Platform
  - Current Project ID displayed when configured for easy verification

---

## 📋 Changes Summary

### Files Added
- `app/api/models/route.ts` - API route for fetching OpenAI models
- `components/ModelSelector.tsx` - Model selector dropdown component
- `RELEASE_NOTES_v1.0.5.md` - This file

### Files Modified
- `app/api/chat/route.ts` - Added model parameter support
- `components/ChatInterface.tsx` - Integrated ModelSelector component
- `components/SettingsForm.tsx` - Fixed Save Keys button and Lakera Project ID visibility
- `package.json` - Version updated to 1.0.5
- `CHANGELOG.md` - Added version 1.0.5 entry

---

## 🚀 Deployment

### Production Update Command

Run this command on your production VM to update to v1.0.5:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/v1.0.5/scripts/upgrade-production.sh | bash
```

### Manual Update Steps

If you prefer to update manually:

```bash
cd /home/adminuser/secure-ai-chat
git fetch origin
git checkout release/v1.0.5
git pull origin release/v1.0.5
npm ci
npm run build
sudo systemctl restart secure-ai-chat
sleep 5
curl http://localhost:3000/api/health
```

---

## ✅ Verification Checklist

After updating to v1.0.5, verify:

- [ ] Application starts successfully
- [ ] Health endpoint responds (http://localhost:3000/api/health)
- [ ] Model selector appears on Chat page (above messages, right-aligned)
- [ ] Model dropdown shows available OpenAI models
- [ ] Model selection works correctly
- [ ] Selected model persists after page refresh
- [ ] Save Keys button visible in both light and dark modes
- [ ] Lakera Project ID field is visible (not password type)
- [ ] All existing functionality works as expected

---

## 📝 Notes

- **Model Selection**: Model preference is stored client-side in localStorage
- **API Key Requirement**: Model selector only appears when OpenAI API key is configured
- **Model Validation**: Only models starting with "gpt-" are allowed for security
- **Backward Compatibility**: Existing functionality remains unchanged
- **Theme Support**: All new UI elements support both light and dark themes

---

## 🔗 Related Documentation

- [Model Selector Usage](../docs/MODEL_SELECTOR.md) (if created)
- [Settings Page](../docs/SETTINGS.md) (if created)
- [API Documentation](../docs/API.md) (if created)

---

## 🙏 Credits

- OpenAI API for model availability
- UniFi theme system for consistent styling
- Community feedback for feature requests

---

**Previous Version:** [v1.0.4](../RELEASE_NOTES_v1.0.4.md)  
**Next Version:** TBD