# Lakera Guard API Compliance Analysis

## Overview
This document compares the current application's Lakera Guard integration with the official API specification from [Lakera Guard API Documentation](https://docs.lakera.ai/api-reference/lakera-api/guard/screen-content).

## Current Implementation Locations

1. **Chat API**: `app/api/chat/route.ts` - Lines 93-275 (`checkWithLakera` function)
2. **File Scan API**: `app/api/scan/route.ts` - Lines 222-262 (Lakera request)

---

## Compliance Issues Found

### ❌ **CRITICAL: Project ID Location**

**Official API Specification:**
- Project ID should be passed in the **request body** as `project_id`
- Example: `{ "messages": [...], "project_id": "your-project-id" }`

**Current Implementation:**
```typescript
// ❌ INCORRECT - Using header
if (lakeraProjectId) {
  headers['X-Lakera-Project'] = lakeraProjectId
}
```

**Location:**
- `app/api/chat/route.ts` line 131-133
- `app/api/scan/route.ts` line 244-247

**Impact:** Medium - May still work but not following official spec

---

### ⚠️ **WARNING: Custom Context Field**

**Official API Specification:**
- No `context` field in the request body
- Metadata should be passed via `metadata` object with specific fields:
  - `user_id`
  - `session_id`
  - `ip_address`
  - `internal_request_id`

**Current Implementation:**
```typescript
// ⚠️ NON-STANDARD - Custom context field
const requestBody = {
  messages: [...],
  context: {  // ❌ Not in official API spec
    type: context,
    timestamp: new Date().toISOString(),
  }
}
```

**Location:**
- `app/api/chat/route.ts` line 136-154
- `app/api/scan/route.ts` line 223-236

**Impact:** Low - Custom field may be ignored by API, but not causing errors

---

### ✅ **CORRECT: Message Format**

**Official API Specification:**
- Messages array with OpenAI Chat Completions format
- Each message has `role` and `content`

**Current Implementation:**
```typescript
// ✅ CORRECT
messages: [
  {
    role: 'user',
    content: message,
  }
]
```

**Status:** ✅ Compliant

---

### ⚠️ **MISSING: Optional Parameters**

**Official API Specification:**
- `payload` (boolean) - Returns detected PII, profanity, regex matches
- `breakdown` (boolean) - Returns list of detectors run
- `dev_info` (boolean) - Returns build information

**Current Implementation:**
- Not using any optional parameters

**Impact:** Low - Missing enhanced response data

---

### ⚠️ **MISSING: Proper Metadata Structure**

**Official API Specification:**
```json
{
  "metadata": {
    "user_id": "string",
    "session_id": "string",
    "ip_address": "ipv4",
    "internal_request_id": "string"
  }
}
```

**Current Implementation:**
- Not using official metadata structure
- Using custom `context` field instead

**Impact:** Medium - Missing opportunity for better tracking and correlation

---

### ✅ **CORRECT: Response Parsing**

**Official API Specification:**
- Response has `flagged` (boolean)
- Optional: `payload`, `breakdown`, `dev_info`, `metadata`

**Current Implementation:**
```typescript
// ✅ CORRECT - Handles both formats
if (data.results && Array.isArray(data.results)) {
  flagged = data.results.some(r => r.flagged === true)
} else {
  flagged = data.flagged === true
}
```

**Status:** ✅ Compliant (handles both response formats)

---

## Recommended Fixes

### 1. **Fix Project ID Location** (HIGH PRIORITY)

**Change from:**
```typescript
if (lakeraProjectId) {
  headers['X-Lakera-Project'] = lakeraProjectId
}
```

**Change to:**
```typescript
const requestBody = {
  messages: [...],
  project_id: lakeraProjectId || undefined,  // ✅ In request body
  // ... other fields
}
```

### 2. **Replace Custom Context with Official Metadata** (MEDIUM PRIORITY)

**Change from:**
```typescript
context: {
  type: context,
  timestamp: new Date().toISOString(),
}
```

**Change to:**
```typescript
metadata: {
  internal_request_id: requestId,
  ip_address: userIP,
  // user_id and session_id can be added if available
}
```

### 3. **Add Optional Parameters** (LOW PRIORITY)

Consider adding:
```typescript
payload: true,      // Get PII/profanity matches
breakdown: true,    // Get detector breakdown
// dev_info: true,  // Only for debugging
```

---

## Summary

| Issue | Severity | Status | Impact |
|-------|----------|--------|--------|
| Project ID in header instead of body | Medium | ❌ Non-compliant | May work but not following spec |
| Custom `context` field | Low | ⚠️ Non-standard | Field likely ignored |
| Missing official `metadata` | Medium | ⚠️ Missing | Lost tracking capabilities |
| Missing optional parameters | Low | ⚠️ Missing | Missing enhanced response data |
| Message format | - | ✅ Correct | Compliant |
| Response parsing | - | ✅ Correct | Handles both formats |

---

## Action Items

1. ✅ **COMPLETED**: Move `project_id` from header to request body
2. ✅ **COMPLETED**: Replace custom `context` with official `metadata` structure
3. ✅ **COMPLETED**: Add optional parameters (`payload`, `breakdown`) for enhanced responses

## Implementation Status: ✅ COMPLETE

All fixes have been implemented and verified:
- ✅ Project ID now in request body (not header)
- ✅ Official metadata structure used
- ✅ Optional parameters (payload, breakdown) added
- ✅ Type checking passes
- ✅ No linter errors

---

## References

- [Official Lakera Guard API Documentation](https://docs.lakera.ai/api-reference/lakera-api/guard/screen-content)
- Current Implementation: `app/api/chat/route.ts` and `app/api/scan/route.ts`
