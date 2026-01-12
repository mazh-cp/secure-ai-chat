# Keys Sync Fix - ModelSelector Not Showing

**Issue:** Keys show as saved in Settings, but ModelSelector doesn't appear in Chat and still complains about missing keys.

## 🐛 Problem

After saving keys in Settings:
- ✅ Settings page shows keys are saved
- ❌ Chat page doesn't show ModelSelector
- ❌ Chat still shows "API key not configured" error

## ✅ Root Cause

The `/api/keys/retrieve` endpoint was returning `null` for keys (for security), but `ChatInterface` was checking for the actual key value. This caused the component to think no key was configured even though it was saved server-side.

## 🔧 Fix Applied

### 1. Updated `/api/keys/retrieve` endpoint
- Now returns `'configured'` placeholder instead of `null` when key exists
- This allows client to detect that keys are configured without exposing actual values

### 2. Updated `ChatInterface` component
- Checks for `'configured'` placeholder or actual key value
- Added periodic refresh (every 5 seconds) to detect key updates
- Fixed `hasApiKey` check to work with server-side storage

### 3. ModelSelector visibility
- Now correctly shows when `hasApiKey` is true
- Fetches models from `/api/models` which uses server-side keys

## 🔄 How It Works Now

1. **Settings saves keys** → Stored server-side in `.secure-storage/`
2. **ChatInterface loads** → Calls `/api/keys/retrieve`
3. **Endpoint responds** → Returns `'configured'` placeholder if key exists
4. **ChatInterface detects** → Sets `hasApiKey = true`
5. **ModelSelector shows** → Fetches models from `/api/models`
6. **Periodic refresh** → Checks every 5 seconds for key updates

## 🚀 Verification

After the fix, verify:

1. **Save keys in Settings**
   - Go to Settings
   - Add OpenAI API key
   - Click Save
   - Should show "Keys saved successfully"

2. **Check Chat page**
   - Navigate to Chat
   - ModelSelector should appear within 5 seconds
   - Should show list of available models
   - No "API key not configured" error

3. **Test model selection**
   - Select a model from dropdown
   - Should persist selection
   - Should work for chat requests

## 🔍 Troubleshooting

### Issue: ModelSelector still not showing

**Check 1: Verify keys are actually saved**
```bash
# On server, check if keys exist
ls -la /home/adminuser/secure-ai-chat/.secure-storage/
```

**Check 2: Test API endpoint**
```bash
# From browser console or curl
curl http://localhost:3000/api/keys/retrieve

# Should return:
# {
#   "keys": { "openAiKey": "configured", ... },
#   "configured": { "openAiKey": true, ... }
# }
```

**Check 3: Check browser console**
- Open browser DevTools (F12)
- Check Console for errors
- Check Network tab for `/api/keys/retrieve` response

**Check 4: Clear browser cache**
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Or clear browser cache and reload

### Issue: Keys show in Settings but not detected in Chat

**Solution:**
1. Wait 5 seconds (periodic refresh interval)
2. Or manually refresh the Chat page
3. Or navigate away and back to Chat page

### Issue: ModelSelector shows but models list is empty

**Check:**
```bash
# Test models endpoint
curl http://localhost:3000/api/models

# Should return list of models or error about API key
```

**Possible causes:**
- Invalid OpenAI API key
- Network issues reaching OpenAI API
- API key doesn't have model access

## 📋 Related Files

- `components/ChatInterface.tsx` - Main chat component
- `components/ModelSelector.tsx` - Model selection component
- `app/api/keys/retrieve/route.ts` - Key retrieval endpoint
- `app/api/models/route.ts` - Models listing endpoint

---

**Last Updated:** January 12, 2026  
**Status:** ✅ Fixed
