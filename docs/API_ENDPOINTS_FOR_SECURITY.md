# API Endpoints for Security Configuration

This document provides the recommended API endpoints and prompt locations for configuring security services like Lakera AI.

---

## Primary Chat Endpoint (Recommended)

### Request URI
```
/api/chat
```

**Full URL examples:**
- Local: `http://localhost:3000/api/chat`
- Production: `https://your-domain.com/api/chat`

### HTTP Method
```
POST
```

### Request Body Structure
```json
{
  "messages": [
    {
      "role": "user",
      "content": "User's prompt text here"
    },
    {
      "role": "assistant",
      "content": "Previous assistant response"
    }
  ],
  "apiKeys": { ... },
  "scanOptions": {
    "scanInput": true,
    "scanOutput": true
  },
  "model": "gpt-4o-mini",
  "enableRAG": true
}
```

### Prompt Location
**For Input Scanning (User Prompts):**
- **Path**: `messages[].content`
- **Filter**: Where `messages[].role === "user"`
- **Description**: The latest user message in the messages array contains the prompt to scan

**JSONPath Expression:**
```
$.messages[?(@.role == 'user')].content
```

**Example:**
- The prompt is in: `body.messages[].content` where `role === 'user'`
- The application extracts the latest user message: `messages.filter(m => m.role === 'user').pop()`

### Response Structure
```json
{
  "content": "AI response text",
  "inputScanResult": {
    "scanned": true,
    "flagged": false,
    "categories": {},
    "threatLevel": "low"
  },
  "outputScanResult": {
    "scanned": true,
    "flagged": false,
    "categories": {},
    "threatLevel": "low"
  },
  "logData": { ... }
}
```

---

## Alternative Endpoints

### 1. File Scan Endpoint

**Request URI:**
```
/api/scan
```

**HTTP Method:**
```
POST
```

**Request Body:**
```json
{
  "content": "File content to scan",
  "fileName": "example.txt",
  "fileType": "text/plain"
}
```

**Prompt Location:**
- **Path**: `content`
- **Description**: Direct content field for file scanning

**JSONPath Expression:**
```
$.content
```

---

## Configuration Recommendations

### For Lakera AI Integration

**Request URI:**
```
https://your-domain.com/api/chat
```

**Prompt Location:**
- **Field Path**: `messages[].content`
- **Filter**: Messages where `role === "user"`
- **Note**: The application automatically extracts the latest user message for scanning

**Request Headers:**
```
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "This is the user prompt to scan"
    }
  ],
  "scanOptions": {
    "scanInput": true,
    "scanOutput": true
  }
}
```

### For Webhook/Proxy Configuration

If you're setting up a webhook or proxy to intercept requests:

1. **Endpoint**: `/api/chat`
2. **Method**: `POST`
3. **Content-Type**: `application/json`
4. **Prompt Extraction**:
   - Parse JSON body
   - Find `messages` array
   - Filter for `role === "user"`
   - Extract `content` from latest user message

---

## Security Scanning Flow

### Input Scanning (User Prompts)
1. User sends message to `/api/chat`
2. Application extracts latest user message: `messages.filter(m => m.role === 'user').pop()`
3. Content scanned: `latestUserMessage.content`
4. If flagged, request is blocked with 403 status

### Output Scanning (AI Responses)
1. After OpenAI API call succeeds
2. AI response content scanned: `aiResponse`
3. If flagged, response is blocked with 403 status

---

## Example Request/Response

### Request
```bash
curl -X POST https://your-domain.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "What is the weather today?"
      }
    ],
    "scanOptions": {
      "scanInput": true,
      "scanOutput": true
    }
  }'
```

### Response (Success)
```json
{
  "content": "I don't have access to real-time weather data...",
  "inputScanResult": {
    "scanned": true,
    "flagged": false,
    "threatLevel": "low"
  },
  "outputScanResult": {
    "scanned": true,
    "flagged": false,
    "threatLevel": "low"
  }
}
```

### Response (Blocked)
```json
{
  "error": "Message blocked by security filter",
  "scanResult": {
    "scanned": true,
    "flagged": true,
    "categories": {
      "prompt_injection": true
    },
    "threatLevel": "high"
  },
  "status": 403
}
```

---

## Summary

**Best Endpoint for Prompt Scanning:**
- **Request URI**: `/api/chat`
- **Method**: `POST`
- **Prompt Location**: `messages[].content` (where `role === "user"`)
- **JSONPath**: `$.messages[?(@.role == 'user')].content`

**For File Content Scanning:**
- **Request URI**: `/api/scan`
- **Method**: `POST`
- **Prompt Location**: `content` (direct field)

---

## Notes

1. The application already performs security scanning internally using Lakera AI
2. If you're configuring an external security service, use the endpoints above
3. The `/api/chat` endpoint handles both input and output scanning automatically
4. All prompts are scanned before being sent to OpenAI
5. All AI responses are scanned before being returned to the user
