# Checkpoint TE File Scanning Fix

## Issues Found and Fixed

### 1. Form-Data Stream Error ✅ FIXED
**Error**: `TypeError: formDataStream is not async iterable`

**Root Cause**: The form-data package stream was being handled incorrectly when converting to buffer for fetch API.

**Fix Applied**: Updated the stream handling in `app/api/te/upload/route.ts` to properly use event listeners instead of async iteration.

**Location**: `app/api/te/upload/route.ts` lines 173-204

### 2. API Key Not Configured ⚠️ USER ACTION REQUIRED
**Status**: Checkpoint TE API key is not configured

**Solution**: 
1. Go to Settings page (`/settings`)
2. Scroll to "Check Point Threat Emulation" section
3. Enter your Check Point TE API key
4. Click "Save" button
5. Verify status shows "Configured"

**Note**: The API key should NOT include the `TE_API_KEY_` prefix - just enter the key itself.

## How to Configure Checkpoint TE

### Step 1: Get Your API Key
- Log into Check Point SmartConsole
- Navigate to: **Management API** → **Advanced Settings**
- Generate or copy your Threat Emulation API key

### Step 2: Configure in Application
1. Open the application: http://localhost:3000
2. Navigate to **Settings** page
3. Find **"Check Point Threat Emulation"** section
4. Paste your API key (without `TE_API_KEY_` prefix)
5. Click **"Save"** button
6. Verify it shows **"Configured"** status

### Step 3: Enable File Sandboxing
1. Go to **Files** page (`/files`)
2. In the **"Scanning Options"** section
3. Enable **"File Sandboxing (Check Point TE)"** toggle
4. The toggle should show green when API key is configured

## Testing File Scanning

### Test Upload and Scan
1. Go to **Files** page
2. Ensure **"File Sandboxing (Check Point TE)"** toggle is enabled
3. Upload a test file (PDF, DOCX, or other supported format)
4. The file should show:
   - Status: "Scanning..." initially
   - Then: "Safe" or "Flagged" based on Checkpoint TE analysis
   - Details: Verdict, severity, confidence level, etc.

### Expected Behavior
- **Safe files**: Show "File passed Check Point TE sandboxing" with analysis details
- **Malicious files**: Show "File blocked by Check Point Threat Emulation" with threat details
- **Pending**: If analysis takes time, will poll for up to 60 seconds

## Troubleshooting

### Error: "API key not configured"
- **Solution**: Configure API key in Settings page (see above)

### Error: "Invalid API key" (401)
- **Solution**: Verify your API key is correct
- Check that you didn't include the `TE_API_KEY_` prefix
- Verify the key hasn't expired in Check Point console

### Error: "Access denied" (403)
- **Solution**: Check API key permissions in Check Point SmartConsole
- Verify your server IP is allowed in Management API settings
- Check API subscription/plan limits

### Error: "Request timeout" (504)
- **Solution**: File may be too large or Checkpoint TE service is slow
- Try with a smaller file
- Check your internet connection
- Wait and try again later

### Files Not Scanning
1. **Check API key**: Verify it's configured in Settings
2. **Check toggle**: Ensure "File Sandboxing (Check Point TE)" is enabled
3. **Check file size**: Maximum 50 MB per file
4. **Check file type**: Supported formats include PDF, DOCX, TXT, etc.
5. **Check system logs**: Go to Dashboard → System Logs to see detailed error messages

## System Logs

To view detailed error information:
1. Go to **Dashboard** page
2. Scroll to **"System Logs"** section
3. Look for entries with service: `checkpoint_te`
4. Check error messages and details for troubleshooting

## Files Modified

- `app/api/te/upload/route.ts` - Fixed form-data stream handling

## Verification

After configuring the API key:
```bash
# Check API key status
curl http://localhost:3000/api/te/config

# Should return:
# {"configured": true, "message": "Check Point TE API key is configured"}
```

## Next Steps

1. ✅ Form-data stream error fixed
2. ⚠️ **Configure Checkpoint TE API key in Settings**
3. ✅ Enable file sandboxing toggle
4. ✅ Test file upload and scanning

The application is ready once the API key is configured!
