# Check Point TE File Sandboxing Test Plan

## Test Objective

Verify that malicious file uploads are properly scanned by Check Point Threat Cloud API when File Sandboxing is enabled.

## Prerequisites

1. ✅ Check Point TE API key configured in Settings
2. ✅ File Sandboxing toggle enabled on Files page
3. ✅ Valid Check Point TE API key with proper permissions
4. ✅ Test file(s) available (can use any file for testing)

## Test Scenarios

### Test 1: Basic File Upload with Sandboxing Enabled

**Steps:**
1. Navigate to Files page
2. Verify "File Sandboxing (Check Point TE)" toggle is enabled (green dot)
3. Upload a test file
4. Observe file status changes

**Expected Results:**
- File appears in file list immediately
- File status shows `pending` (scanning in progress)
- After scan completes, status changes to:
  - `safe` - if file is clean
  - `malicious` - if file contains threats
  - `unknown` - if verdict is unclear
- Scan results/details are displayed

**Verification:**
- Check browser Network tab for `/api/te/upload` request
- Verify `/api/te/query` is polled multiple times
- Check server logs for Check Point TE API responses

### Test 2: Malicious File Detection

**Steps:**
1. Upload a file known to be malicious (or use EICAR test file)
2. Wait for scan to complete
3. Check file status and results

**Expected Results:**
- File status shows `malicious`
- Threat details are displayed
- File is marked appropriately in UI
- Scan result contains threat information

**Verification:**
- Check `file.scanStatus === 'malicious'`
- Verify `file.scanResult` contains threat details
- Check Check Point TE API response for threat verdict

### Test 3: Safe File Detection

**Steps:**
1. Upload a clean text file (e.g., .txt with normal content)
2. Wait for scan to complete
3. Check file status

**Expected Results:**
- File status shows `safe`
- No threat warnings displayed
- File can be used normally

**Verification:**
- Check `file.scanStatus === 'safe'`
- Verify no threat indicators in UI

### Test 4: Sandboxing Disabled

**Steps:**
1. Disable "File Sandboxing (Check Point TE)" toggle
2. Upload a file
3. Check if Check Point TE API is called

**Expected Results:**
- File uploads normally
- No `/api/te/upload` request is made
- File status may be `not_scanned` or handled by other scanning

**Verification:**
- Check browser Network tab - no `/api/te/upload` request
- Check server logs - no Check Point TE API calls

### Test 5: API Key Not Configured

**Steps:**
1. Remove Check Point TE API key from Settings
2. Try to enable File Sandboxing toggle
3. Upload a file

**Expected Results:**
- Toggle may be disabled (grayed out)
- Error message if sandboxing is attempted
- File upload may proceed without Check Point TE scanning

**Verification:**
- Check UI for error messages
- Verify toggle state reflects API key configuration

### Test 6: Polling and Timeout

**Steps:**
1. Upload a file with sandboxing enabled
2. Monitor polling behavior
3. Check timeout handling

**Expected Results:**
- Polling starts after upload
- Polls every 2 seconds
- Stops when status is `FOUND`, `PARTIALLY_FOUND`, or `NOT_FOUND`
- Times out after 60 seconds (30 attempts) if still pending

**Verification:**
- Check browser Network tab for multiple `/api/te/query` requests
- Verify polling interval (2 seconds)
- Check timeout behavior

## Code Verification Checklist

### File Upload Handler
- [ ] `handleFileUpload` checks `checkpointTeSandboxEnabled`
- [ ] Calls `handleCheckpointTeSandbox` when enabled
- [ ] File is stored locally before/after scanning

### Check Point TE Sandboxing
- [ ] `handleCheckpointTeSandbox` is called correctly
- [ ] File content is sent to `/api/te/upload`
- [ ] `request_id` is received from Check Point TE
- [ ] Polling starts with correct `request_id`

### API Endpoints
- [ ] `/api/te/upload` submits file to Check Point TE API
- [ ] `/api/te/query` queries scan status correctly
- [ ] Responses are parsed correctly
- [ ] Error handling is comprehensive

### Status Updates
- [ ] File status updates during polling
- [ ] Final status reflects Check Point TE verdict
- [ ] Threat details are stored in file metadata
- [ ] UI displays status correctly

## Debugging Commands

### Check Server Logs:
```bash
# Monitor Check Point TE API calls
tail -f /path/to/logs | grep -i checkpoint

# Check for errors
grep -i "error\|failed" /path/to/logs | grep -i "te\|checkpoint"
```

### Test API Directly:
```bash
# Test Check Point TE upload
curl -X POST https://te-api.checkpoint.com/tecloud/api/v1/file \
  -H "Authorization: <your_api_key>" \
  -F "file=@test.txt" \
  -F "request={\"file_name\":\"test.txt\"}"
```

### Check File Status:
```javascript
// In browser console on Files page
// Check localStorage for files
JSON.parse(localStorage.getItem('uploadedFiles'))
```

## Expected API Flow

```
1. User uploads file
   ↓
2. handleFileUpload() called
   ↓
3. checkpointTeSandboxEnabled === true?
   ↓ YES
4. handleCheckpointTeSandbox() called
   ↓
5. POST /api/te/upload
   - File content sent to Check Point TE
   ↓
6. Check Point TE responds with request_id
   ↓
7. Start polling loop
   ↓
8. GET /api/te/query?request_id=...
   ↓
9. Check Point TE responds with status
   ↓
10. Status === PENDING?
    ↓ YES → Wait 2s → Go to step 8 (max 30 times)
    ↓ NO
11. Parse response
    - Extract verdict (safe/malicious/unknown)
    - Extract threat details
    ↓
12. Update file.scanStatus
    Update file.scanResult
    ↓
13. Display in UI
```

## Success Criteria

✅ **File Upload**:
- File is successfully uploaded
- Check Point TE API is called when sandboxing is enabled

✅ **Scanning**:
- File is submitted to Check Point TE
- Polling works correctly
- Scan completes within timeout period

✅ **Results**:
- Threat verdict is correctly extracted
- File status reflects verdict
- Threat details are available

✅ **UI**:
- File status is displayed correctly
- Malicious files show appropriate warnings
- Safe files show success indicators

✅ **Error Handling**:
- Errors are handled gracefully
- User-friendly error messages
- App doesn't crash on API failures
