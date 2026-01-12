# Key Save Debugging Guide

**Issue:** Keys show as saved in Settings but `/api/keys/retrieve` returns `null`

## 🔍 Diagnostic Steps

### Step 1: Check Service Logs

```bash
# View recent logs for key save attempts
sudo journalctl -u secure-ai-chat -n 100 --no-pager | grep -i "key\|save\|error"
```

Look for:
- "Keys saved successfully"
- "Error saving API keys"
- "Invalid OpenAI key format"

### Step 2: Check Storage Directory

```bash
# Check if storage directory exists
ls -la /home/adminuser/secure-ai-chat/.secure-storage/

# Check permissions
stat /home/adminuser/secure-ai-chat/.secure-storage/

# Should show:
# Owner: adminuser:adminuser
# Permissions: 700 (drwx------)
```

### Step 3: Check Storage File

```bash
# Check if keys file exists
ls -la /home/adminuser/secure-ai-chat/.secure-storage/api-keys.enc

# Check file size (should be > 0 if keys are saved)
stat /home/adminuser/secure-ai-chat/.secure-storage/api-keys.enc
```

### Step 4: Test Key Save via API

```bash
# Test saving a key directly via API
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{"keys":{"openAiKey":"sk-test123456789012345678901234567890"}}'

# Check response - should show success
# Then verify:
curl http://localhost:3000/api/keys/retrieve
```

### Step 5: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Settings page
3. Paste your OpenAI API key
4. Click Save
5. Check Console tab for errors
6. Check Network tab for `/api/keys` request
   - Check request payload
   - Check response status and body

## 🐛 Common Issues

### Issue 1: Invalid Key Format

**Symptoms:**
- Error in browser console: "Invalid OpenAI API key format"
- Keys don't save

**Solution:**
- Ensure OpenAI key starts with `sk-`
- Ensure key is at least 20 characters long
- Check for extra spaces (will be trimmed automatically)

### Issue 2: Permission Denied

**Symptoms:**
- Error in logs: "Error saving API keys: EACCES"
- Storage directory exists but can't write

**Solution:**
```bash
sudo bash scripts/fix-key-storage.sh
```

### Issue 3: Empty Keys Being Sent

**Symptoms:**
- Keys appear to save but aren't persisted
- Network request shows empty values

**Solution:**
- Check browser Network tab
- Ensure you're pasting the full key
- Check if key field is actually populated before clicking Save

### Issue 4: Environment Variables Override

**Symptoms:**
- Keys save but don't appear in retrieval
- Logs show keys are being ignored

**Solution:**
- Check if environment variables are set:
  ```bash
  env | grep -i "OPENAI\|LAKERA"
  ```
- If set, keys won't be saved to file (env vars take priority)
- Either remove env vars or use them instead

## 🔧 Manual Fix

If keys still aren't saving:

```bash
# 1. Fix permissions
sudo bash scripts/fix-key-storage.sh

# 2. Check service logs
sudo journalctl -u secure-ai-chat -f

# 3. Try saving via API directly
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{"keys":{"openAiKey":"YOUR_ACTUAL_KEY_HERE"}}'

# 4. Verify
curl http://localhost:3000/api/keys/retrieve
```

## 📋 Verification Checklist

After saving keys:

- [ ] Browser console shows no errors
- [ ] Network request to `/api/keys` returns 200 OK
- [ ] Response shows `"success": true`
- [ ] `/api/keys/retrieve` returns `"openAiKey": "configured"`
- [ ] Storage file exists: `.secure-storage/api-keys.enc`
- [ ] File size > 0 bytes
- [ ] Service logs show "Keys saved successfully"
- [ ] ModelSelector appears in Chat page

---

**Last Updated:** January 12, 2026
