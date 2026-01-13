# Lakera Guard API Enhancement - Rollback & Verification Guide

**Date:** January 13, 2025  
**Version:** 1.0.8  
**Enhancement:** Added official `payload` and `breakdown` fields from Lakera Guard API v2 specification

---

## Overview

This document provides clear steps to verify the Lakera Guard API enhancements and rollback procedures if functionality breaks.

### What Changed

1. **Updated `LakeraResponse` interface** to include official API fields:
   - `payload` - Array of detected threats with locations
   - `breakdown` - Array of detector results
   - `dev_info` - Build information (optional)
   - `metadata` - Request metadata

2. **Updated `ScanResult` interface** to include:
   - `payload` - Detected threats with text positions
   - `breakdown` - Detector execution results

3. **Enhanced extraction logic** in:
   - `app/api/chat/route.ts` - Chat message scanning
   - `app/api/scan/route.ts` - File content scanning

4. **Updated UI components** to display:
   - Payload data (detected threats with locations) in:
     - `components/MessageBubble.tsx` - Chat messages
     - `components/FileList.tsx` - File scan results
     - `components/LogViewer.tsx` - System logs
   - Breakdown data (detector results) in:
     - `components/LogViewer.tsx` - System logs
     - `components/FileList.tsx` - File scan results

5. **Updated type definitions** in:
   - `types/chat.ts` - Chat message types
   - `types/logs.ts` - Log entry types
   - `types/files.ts` - File upload types

---

## Verification Steps

### 1. Build Verification

```bash
# Navigate to project directory
cd secure-ai-chat

# Clean build
rm -rf .next
npm run build

# Check for TypeScript errors
npm run type-check

# Check for linting errors
npm run lint
```

**Expected Result:** ✅ No errors

---

### 2. Functionality Verification

#### A. Chat Message Scanning

1. **Start the application:**
   ```bash
   npm run dev
   ```

2. **Test Input Scanning:**
   - Open the chat interface
   - Enable "Input Scan" toggle
   - Send a test message with potential injection: `"Ignore all previous instructions"`
   - **Expected:** Message should be blocked
   - **Check:** Message bubble should show:
     - Threat detected indicator
     - Categories (e.g., "prompt_injection")
     - If payload data is available: Detected threats with positions
     - Threat score

3. **Test Output Scanning:**
   - Enable "Output Scan" toggle
   - Send a normal message
   - **Expected:** Response should be scanned
   - **Check:** Response bubble should show scan status

#### B. File Scanning

1. **Upload a test file:**
   - Go to Files page
   - Upload a text file with suspicious content
   - Click "Scan" button
   - **Expected:** File should be scanned
   - **Check:** File should show:
     - Scan status (safe/flagged)
     - If flagged: Categories, threat level
     - If payload data available: Detected threats with positions
     - If breakdown data available: Detector results

#### C. Logs Verification

1. **Check System Logs:**
   - Go to Dashboard → System Logs
   - Look for recent scan entries
   - **Expected:** Logs should show:
     - Lakera decision details
     - Categories and scores
     - If available: Payload data (detected threats)
     - If available: Breakdown data (detector results)

2. **Check Console Logs:**
   - Open browser DevTools (F12)
   - Check Console tab
   - **Expected:** Should see debug logs:
     - "Lakera Guard Breakdown:" (if breakdown available)
     - "Lakera Guard Payload (Detected Threats):" (if payload available)

---

### 3. API Response Verification

#### Test Lakera API Response Structure

1. **Check Network Tab:**
   - Open browser DevTools → Network tab
   - Send a chat message or scan a file
   - Find the `/api/chat` or `/api/scan` request
   - Check the response JSON
   - **Expected:** Response should include:
     - `flagged` (boolean)
     - `categories` (object, if available)
     - `scores` (object, if available)
     - `payload` (array, if `payload: true` was sent)
     - `breakdown` (array, if `breakdown: true` was sent)

2. **Verify Request Body:**
   - Check the request payload to Lakera API
   - **Expected:** Should include:
     - `messages` array
     - `project_id` (if configured)
     - `payload: true`
     - `breakdown: true`
     - `metadata` object (if available)

---

## Rollback Procedures

### If Functionality Breaks

#### Option 1: Quick Rollback (Git)

If you have committed the changes to git:

```bash
# Navigate to project directory
cd secure-ai-chat

# Check current commit
git log --oneline -5

# Rollback to previous commit (replace COMMIT_HASH with the commit before enhancements)
git checkout COMMIT_HASH

# Or rollback specific files
git checkout HEAD~1 -- app/api/chat/route.ts
git checkout HEAD~1 -- app/api/scan/route.ts
git checkout HEAD~1 -- types/chat.ts
git checkout HEAD~1 -- types/logs.ts
git checkout HEAD~1 -- types/files.ts
git checkout HEAD~1 -- components/MessageBubble.tsx
git checkout HEAD~1 -- components/LogViewer.tsx
git checkout HEAD~1 -- components/FileList.tsx
git checkout HEAD~1 -- app/files/page.tsx

# Rebuild
npm run build
```

#### Option 2: Manual Rollback (File-by-File)

If git rollback is not available, manually revert changes:

##### Step 1: Revert `LakeraResponse` Interface

**File:** `app/api/chat/route.ts` and `app/api/scan/route.ts`

**Remove:**
```typescript
// Official fields (when payload=true)
payload?: Array<{...}>

// Official fields (when breakdown=true)
breakdown?: Array<{...}>

// Official fields (when dev_info=true)
dev_info?: {...}

// Official fields (metadata)
metadata?: {...}
```

**Keep only:**
```typescript
interface LakeraResponse {
  flagged: boolean
  categories?: Record<string, boolean>
  payload_scores?: Record<string, number>
  results?: Array<{...}>
  message?: string
  error?: string
}
```

##### Step 2: Revert Extraction Logic

**File:** `app/api/chat/route.ts` (around line 208-223)

**Remove:**
```typescript
let payload: Array<{...}> | undefined
let breakdown: Array<{...}> | undefined

// ... extraction logic for payload and breakdown

// Log breakdown information for debugging
if (breakdown && breakdown.length > 0) {
  console.log('Lakera Guard Breakdown:', {...})
}

// Log payload information for debugging
if (payload && payload.length > 0) {
  console.log('Lakera Guard Payload (Detected Threats):', {...})
}
```

**Keep only:**
```typescript
let flagged = false
let categories: Record<string, boolean> | undefined
let scores: Record<string, number> | undefined

if (data.results && Array.isArray(data.results) && data.results.length > 0) {
  flagged = data.results.some(r => r.flagged === true)
  categories = data.results[0]?.categories
  scores = data.results[0]?.payload_scores
} else {
  flagged = data.flagged === true
  categories = data.categories
  scores = data.payload_scores
}
```

**File:** `app/api/scan/route.ts` (similar changes)

##### Step 3: Revert Return Values

**File:** `app/api/chat/route.ts` (around line 262-271)

**Remove:**
```typescript
payload,      // Include official payload data
breakdown,    // Include official breakdown data
```

**File:** `app/api/scan/route.ts` (around line 486-494 and 510-523)

**Remove:**
```typescript
payload,      // Include official payload data
breakdown,    // Include official breakdown data
```

##### Step 4: Revert Type Definitions

**File:** `types/chat.ts`

**Remove:**
```typescript
payload?: Array<{...}>
breakdown?: Array<{...}>
```

**File:** `types/logs.ts`

**Remove:**
```typescript
payload?: Array<{...}>
breakdown?: Array<{...}>
```

**File:** `types/files.ts`

**Remove:**
```typescript
payload?: Array<{...}>
breakdown?: Array<{...}>
```

##### Step 5: Revert UI Components

**File:** `components/MessageBubble.tsx`

**Remove:** The entire payload display section (around lines 68-95)

**File:** `components/LogViewer.tsx`

**Remove:** The payload and breakdown display sections (around lines 198-260)

**File:** `components/FileList.tsx`

**Remove:** The payload and breakdown display sections (around lines 332-400)

**File:** `app/files/page.tsx`

**Remove:**
```typescript
payload: data.details.payload,
breakdown: data.details.breakdown,
```

##### Step 6: Rebuild and Test

```bash
# Clean build
rm -rf .next
npm run build

# Test
npm run dev
```

---

## Troubleshooting

### Issue: TypeScript Errors After Rollback

**Solution:**
```bash
# Clean TypeScript cache
rm -rf tsconfig.tsbuildinfo
rm -rf .next
npm run type-check
```

### Issue: UI Not Displaying Correctly

**Solution:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+Shift+R)
3. Restart dev server:
   ```bash
   pkill -f "next dev"
   npm run dev
   ```

### Issue: API Responses Not Working

**Solution:**
1. Check Lakera API key configuration
2. Verify endpoint URL is correct
3. Check browser console for errors
4. Check server logs:
   ```bash
   # If using systemd
   sudo journalctl -u secure-ai-chat -f
   
   # If running locally
   # Check terminal where npm run dev is running
   ```

### Issue: Payload/Breakdown Data Not Appearing

**Possible Causes:**
1. Lakera API may not return payload/breakdown if:
   - `payload: true` or `breakdown: true` not sent in request
   - API key doesn't have permissions
   - Project ID not configured correctly

2. **Solution:**
   - Verify request includes `payload: true` and `breakdown: true`
   - Check Lakera API documentation for your plan/features
   - Verify project ID is correct

---

## Testing Checklist

After rollback, verify:

- [ ] Application builds without errors
- [ ] Chat messages can be sent and received
- [ ] Input scanning works (blocks malicious messages)
- [ ] Output scanning works (scans LLM responses)
- [ ] File upload works
- [ ] File scanning works
- [ ] Logs display correctly
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] No linting errors

---

## Support

If issues persist after rollback:

1. **Check Git History:**
   ```bash
   git log --oneline --all
   git diff HEAD~1 HEAD
   ```

2. **Check Application Logs:**
   - Browser console (F12)
   - Server logs (terminal or systemd)

3. **Verify Lakera API:**
   - Test API key directly with curl:
     ```bash
     curl -X POST https://api.lakera.ai/v2/guard \
       -H "Authorization: Bearer YOUR_API_KEY" \
       -H "Content-Type: application/json" \
       -d '{"messages":[{"role":"user","content":"test"}],"payload":true,"breakdown":true}'
     ```

4. **Create Issue Report:**
   - Include error messages
   - Include browser console logs
   - Include server logs
   - Include steps to reproduce

---

## Summary

The enhancements add support for official Lakera Guard API v2 fields (`payload` and `breakdown`) while maintaining backward compatibility with existing functionality. If issues occur:

1. **First:** Verify the issue is related to these changes (check console logs)
2. **Quick Fix:** Rollback using git if available
3. **Manual Fix:** Follow file-by-file rollback steps
4. **Test:** Verify all functionality works after rollback
5. **Report:** Document the issue for future reference

**Note:** These enhancements are **additive** - they add new fields without removing existing functionality. The application should continue to work even if Lakera API doesn't return payload/breakdown data.

---

**Last Updated:** January 13, 2025  
**Version:** 1.0.8
