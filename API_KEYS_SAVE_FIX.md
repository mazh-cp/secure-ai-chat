# API Keys Save Fix

## Issue
System wasn't saving keys and not enabling providers/LLMs for chat after saving API keys in the Settings page.

## Root Causes

1. **Cache Invalidation Issue**: After saving keys, the cache wasn't being properly reloaded, causing stale data
2. **Empty String Handling**: Empty strings for Azure OpenAI keys/endpoints weren't being handled correctly in the merge logic
3. **Cache Not Refreshing**: The `setApiKeys` function invalidated cache but didn't force a reload

## Fixes Applied

### 1. Force Cache Reload After Save
**File**: `lib/api-keys-storage.ts`

```typescript
export async function setApiKeys(keys: StoredApiKeys): Promise<void> {
  await saveApiKeys(keys)
  // Invalidate cache to force reload on next access
  cachedKeys = null
  keysLoaded = false
  // Force reload to update cache with saved keys
  await loadApiKeys()
}
```

### 2. Improved Azure OpenAI Key/Endpoint Handling
**File**: `lib/api-keys-storage.ts`

Fixed the logic to properly handle:
- New keys being saved
- Empty strings (should keep existing if exists, otherwise remove)
- Undefined values (should keep existing)

### 3. Enhanced Verification After Save
**File**: `app/api/keys/route.ts`

Added verification to ensure keys file exists and is accessible after save, with better logging.

## Testing

After applying these fixes:

1. **Save API Keys**:
   - Go to Settings page
   - Enter OpenAI or Azure OpenAI keys
   - Click "Save Settings"
   - Check browser console for success message

2. **Verify Keys Are Saved**:
   ```bash
   # Check if keys file exists
   ls -la .secure-storage/api-keys.enc
   
   # Check server logs
   sudo journalctl -u secure-ai-chat -n 50 | grep -i "keys saved"
   ```

3. **Verify Chat Page**:
   - Go to Chat page
   - Provider selector should show configured providers
   - Model selector should be enabled
   - Should be able to send messages

4. **Check API Status**:
   ```bash
   curl http://localhost:3000/api/keys | jq .
   ```

## Expected Behavior

- ✅ Keys save successfully to `.secure-storage/api-keys.enc`
- ✅ Cache is invalidated and reloaded after save
- ✅ Chat page immediately reflects saved keys
- ✅ Provider selector enables configured providers
- ✅ Model selector is enabled when provider has keys

## Troubleshooting

If keys still don't save:

1. **Check File Permissions**:
   ```bash
   ls -la .secure-storage/
   # Should show: -rw------- (600 permissions)
   ```

2. **Check Server Logs**:
   ```bash
   sudo journalctl -u secure-ai-chat -f
   # Look for "Keys saved successfully" message
   ```

3. **Verify Storage Directory**:
   ```bash
   ls -la .secure-storage/
   # Should contain: api-keys.enc
   ```

4. **Test API Endpoint**:
   ```bash
   curl -X POST http://localhost:3000/api/keys \
     -H "Content-Type: application/json" \
     -d '{"keys": {"openAiKey": "sk-test123456789012345678901234567890"}}'
   ```

5. **Clear Cache and Retry**:
   - Restart the application
   - Clear browser cache
   - Try saving keys again

## Related Files

- `lib/api-keys-storage.ts` - Key storage logic
- `app/api/keys/route.ts` - API endpoint for saving keys
- `components/SettingsForm.tsx` - Settings form UI
- `components/ChatInterface.tsx` - Chat interface that loads keys
