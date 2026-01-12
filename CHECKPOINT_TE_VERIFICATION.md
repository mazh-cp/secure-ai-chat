# Check Point Threat Emulation (TE) File Sandboxing Verification

## Overview

This document verifies that malicious file uploads are properly scanned by Check Point Threat Cloud API when File Sandboxing is enabled.

## Current Implementation

### 1. File Upload Flow

When a file is uploaded with Check Point TE Sandboxing enabled:

1. **File Upload** (`app/files/page.tsx`):
   - User uploads file via `FileUploader` component
   - `handleFileUpload` function is called
   - If `checkpointTeSandboxEnabled` is true, calls `handleCheckpointTeSandbox`

2. **Check Point TE Sandboxing** (`handleCheckpointTeSandbox`):
   - Calls `/api/te/upload` endpoint
   - Submits file to Check Point Threat Cloud API
   - Receives upload response with `request_id`
   - Starts polling `/api/te/query` endpoint
   - Polls every 2 seconds for up to 30 attempts (60 seconds total)
   - Updates file status based on scan results

3. **API Endpoints**:
   - `/api/te/upload` - Uploads file to Check Point TE
   - `/api/te/query` - Queries scan status and results

### 2. Check Point TE API Integration

**Upload Endpoint** (`app/api/te/upload/route.ts`):
- Receives file content (base64 or binary)
- Creates multipart form data
- Submits to Check Point TE API: `https://te-api.checkpoint.com/tecloud/api/v1/file`
- Returns `request_id` for polling

**Query Endpoint** (`app/api/te/query/route.ts`):
- Queries Check Point TE API with `request_id`
- Returns scan status: `FOUND`, `PARTIALLY_FOUND`, `NOT_FOUND`, `PENDING`
- Returns threat verdict: `safe`, `malicious`, `unknown`
- Returns detailed log fields with threat information

### 3. File Status Updates

File status is updated based on Check Point TE results:
- `pending` - Scan in progress
- `safe` - File is safe (verdict: safe)
- `malicious` - File is malicious (verdict: malicious)
- `unknown` - Scan completed but verdict is unknown
- `error` - Scan failed or error occurred

## Verification Checklist

### ✅ Configuration
- [ ] Check Point TE API key is configured in Settings
- [ ] File Sandboxing toggle is enabled
- [ ] API key is valid and has proper permissions

### ✅ File Upload
- [ ] File upload triggers Check Point TE sandboxing when enabled
- [ ] Upload request is sent to `/api/te/upload`
- [ ] File is successfully submitted to Check Point TE API
- [ ] `request_id` is received from Check Point TE

### ✅ Polling
- [ ] Polling starts after successful upload
- [ ] Polls `/api/te/query` every 2 seconds
- [ ] Polling continues until status is `FOUND`, `PARTIALLY_FOUND`, or `NOT_FOUND`
- [ ] Polling times out after 60 seconds (30 attempts)

### ✅ Results Processing
- [ ] Scan results are correctly parsed
- [ ] Threat verdict is extracted (`safe`, `malicious`, `unknown`)
- [ ] File status is updated based on verdict
- [ ] Detailed threat information is stored in file metadata

### ✅ UI Display
- [ ] File status is displayed in FileList component
- [ ] Malicious files show appropriate warning/indicator
- [ ] Safe files show success indicator
- [ ] Scan results/details are accessible

## Testing Steps

### Test 1: Malicious File Upload

1. **Enable File Sandboxing**:
   - Go to Settings page
   - Configure Check Point TE API key
   - Go to Files page
   - Enable "File Sandboxing (Check Point TE)" toggle

2. **Upload Test File**:
   - Upload a file (can be any file for testing)
   - Watch for status updates:
     - Initial: `pending` (scanning)
     - After scan: `safe`, `malicious`, or `unknown`

3. **Verify API Calls**:
   - Check browser Network tab
   - Verify `/api/te/upload` is called
   - Verify `/api/te/query` is polled multiple times
   - Check server logs for Check Point TE API responses

4. **Verify Results**:
   - Check file status in FileList
   - Verify threat verdict is displayed
   - Check if detailed threat information is available

### Test 2: Check Point TE API Response

1. **Check Server Logs**:
   - Look for Check Point TE API requests
   - Verify request includes file content
   - Verify API key is included in Authorization header
   - Check response status codes

2. **Verify Response Parsing**:
   - Check if `request_id` is extracted correctly
   - Verify polling uses correct `request_id`
   - Check if threat verdict is parsed correctly
   - Verify log fields are extracted

### Test 3: Error Handling

1. **Invalid API Key**:
   - Test with invalid Check Point TE API key
   - Verify error is handled gracefully
   - Check error message is displayed to user

2. **Network Errors**:
   - Test with network disconnected
   - Verify error handling doesn't crash app
   - Check error message is user-friendly

3. **Timeout Handling**:
   - Test with very slow Check Point TE response
   - Verify polling times out after 60 seconds
   - Check file status is set to `unknown` or `error`

## Expected Behavior

### When File Sandboxing is Enabled:

1. **File Upload**:
   ```
   User uploads file
   → handleFileUpload called
   → checkpointTeSandboxEnabled = true
   → handleCheckpointTeSandbox called
   → POST /api/te/upload
   → Check Point TE API receives file
   → Returns request_id
   ```

2. **Polling**:
   ```
   Start polling loop
   → GET /api/te/query?request_id=...
   → Check Point TE API returns status
   → If PENDING: wait 2s, retry (up to 30 times)
   → If FOUND/PARTIALLY_FOUND/NOT_FOUND: stop polling
   ```

3. **Result Processing**:
   ```
   Parse Check Point TE response
   → Extract verdict (safe/malicious/unknown)
   → Update file.scanStatus
   → Update file.scanResult
   → Display in UI
   ```

### When File Sandboxing is Disabled:

- File upload proceeds normally
- No Check Point TE API calls are made
- File status may be `not_scanned` or handled by other scanning (if any)

## Code Locations

### Key Files:
- `app/files/page.tsx` - File upload UI and Check Point TE integration
- `app/api/te/upload/route.ts` - File upload to Check Point TE API
- `app/api/te/query/route.ts` - Query Check Point TE scan status
- `lib/checkpoint-te.ts` - Check Point TE API utilities
- `components/FileList.tsx` - Display file status and scan results

### Key Functions:
- `handleFileUpload` - Main file upload handler
- `handleCheckpointTeSandbox` - Check Point TE sandboxing handler
- `pollCheckpointTeStatus` - Polling function for scan results

## Debugging

### Check Server Logs:
```bash
# Look for Check Point TE API calls
grep -i "checkpoint\|te-api" /path/to/logs

# Check for errors
grep -i "error\|failed" /path/to/logs | grep -i checkpoint
```

### Check Browser Console:
- Open browser DevTools
- Check Network tab for `/api/te/upload` and `/api/te/query` requests
- Verify request/response payloads
- Check for JavaScript errors

### Verify API Key:
- Check Settings page for Check Point TE API key status
- Verify API key is valid in Check Point TE dashboard
- Test API key directly with curl:
  ```bash
  curl -X POST https://te-api.checkpoint.com/tecloud/api/v1/file \
    -H "Authorization: <api_key>" \
    -F "file=@test.txt"
  ```

## Common Issues

1. **API Key Not Configured**:
   - Error: "Check Point TE API key not configured"
   - Fix: Configure API key in Settings page

2. **API Key Invalid**:
   - Error: 401 Unauthorized
   - Fix: Verify API key is correct in Check Point TE dashboard

3. **Polling Timeout**:
   - File status stuck on `pending`
   - Fix: Check Point TE API may be slow, increase timeout or check API status

4. **Network Errors**:
   - Error: "Failed to Fetch"
   - Fix: Check internet connection, firewall, CORS settings

5. **File Not Scanned**:
   - File uploads but no scan occurs
   - Fix: Verify File Sandboxing toggle is enabled
