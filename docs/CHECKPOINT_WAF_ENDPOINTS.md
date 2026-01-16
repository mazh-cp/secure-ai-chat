# Check Point WAF - API Endpoints Configuration Guide

This document provides a complete list of API endpoints that need to be configured in Check Point WAF, including security policies, rate limiting, and monitoring recommendations.

## Endpoint Categories

### 1. Public/Health Check Endpoints
These endpoints should have minimal restrictions but should still be monitored.

### 2. Authentication/Configuration Endpoints
These endpoints handle sensitive operations and require strict security.

### 3. Data Processing Endpoints
These endpoints process user data and require content inspection.

### 4. File Upload Endpoints
These endpoints handle file uploads and require strict security policies.

### 5. Monitoring/Logging Endpoints
These endpoints provide logs and monitoring data.

---

## Complete Endpoint List

### Health & Status Endpoints

#### 1. `/api/health`
- **Methods**: `GET`
- **Security Level**: Low (but monitor)
- **Rate Limit**: 60 requests/minute per IP
- **Content Inspection**: None
- **Description**: General health check endpoint
- **Check Point WAF Configuration**:
  - Allow without authentication
  - Monitor for excessive requests (possible DDoS)
  - Log requests for monitoring
  - No content inspection needed

#### 2. `/api/health/openai`
- **Methods**: `GET`, `POST`
- **Security Level**: Medium
- **Rate Limit**: 10 requests/minute per IP
- **Content Inspection**: Request body (POST only)
- **Description**: OpenAI API connectivity check
- **Check Point WAF Configuration**:
  - Allow without authentication (but monitor)
  - Inspect POST request body for API keys
  - Block if API keys detected in logs/responses
  - Rate limit more strictly than general health

#### 3. `/api/health/cache`
- **Methods**: `GET`
- **Security Level**: Low
- **Rate Limit**: 30 requests/minute per IP
- **Content Inspection**: None
- **Description**: Cache health check
- **Check Point WAF Configuration**:
  - Allow without authentication
  - Monitor for unusual patterns
  - No content inspection needed

#### 4. `/api/waf/health`
- **Methods**: `GET`
- **Security Level**: Medium
- **Rate Limit**: 20 requests/minute per IP (or per API key if authenticated)
- **Content Inspection**: None
- **Description**: Check Point WAF integration health check
- **Check Point WAF Configuration**:
  - Optional authentication (if `WAF_AUTH_ENABLED=true`)
  - Monitor for Check Point WAF monitoring requests
  - Log all requests
  - Higher rate limit for Check Point WAF IPs

---

### Chat & AI Processing Endpoints

#### 5. `/api/chat` ⚠️ **HIGH PRIORITY**
- **Methods**: `POST`
- **Security Level**: **CRITICAL**
- **Rate Limit**: 
  - Standard users: 20 requests/minute per IP
  - Authenticated users: 100 requests/minute per API key
- **Content Inspection**: **REQUIRED**
- **Description**: Main chat endpoint - processes user messages and AI responses
- **Check Point WAF Configuration**:
  - **Content Inspection**: Enable for both request and response
  - **Threat Detection**: Enable prompt injection detection
  - **Rate Limiting**: Strict limits to prevent abuse
  - **Request Body Size**: Limit to 1MB
  - **Response Body Size**: Limit to 10MB
  - **Security Policies**:
    - Block SQL injection attempts
    - Block XSS attempts in user messages
    - Block command injection attempts
    - Monitor for prompt injection patterns
  - **Logging**: Log all requests and responses (sanitized)
  - **Monitoring**: Alert on rate limit violations
  - **Headers**: Check for `Content-Type: application/json`

#### 6. `/api/models`
- **Methods**: `GET`
- **Security Level**: Low
- **Rate Limit**: 30 requests/minute per IP
- **Content Inspection**: None
- **Description**: List available AI models
- **Check Point WAF Configuration**:
  - Allow without authentication
  - Monitor for excessive requests
  - No content inspection needed

---

### File Management Endpoints

#### 7. `/api/files/list`
- **Methods**: `GET`
- **Security Level**: Medium
- **Rate Limit**: 30 requests/minute per IP
- **Content Inspection**: Query parameters
- **Description**: List uploaded files
- **Check Point WAF Configuration**:
  - Monitor for unauthorized access attempts
  - Inspect query parameters for injection attempts
  - Rate limit to prevent enumeration attacks

#### 8. `/api/files/store`
- **Methods**: `POST`
- **Security Level**: **HIGH**
- **Rate Limit**: 10 requests/minute per IP
- **Content Inspection**: **REQUIRED** (multipart/form-data)
- **Description**: Store uploaded files
- **Check Point WAF Configuration**:
  - **Content Inspection**: Enable file upload scanning
  - **File Size Limits**: 50MB maximum
  - **File Type Restrictions**: 
    - Block executable files (.exe, .bat, .sh, .dll)
    - Block script files (.js, .php, .asp, .jsp)
    - Allow: .txt, .pdf, .docx, .xlsx, .csv, .json, .md, .png, .jpg, .jpeg, .gif
  - **Security Policies**:
    - Scan for malware
    - Block dangerous file types
    - Validate file extensions
    - Check file signatures (magic bytes)
  - **Rate Limiting**: Strict to prevent file upload abuse
  - **Headers**: Check for `Content-Type: multipart/form-data`

#### 9. `/api/files/delete`
- **Methods**: `DELETE`, `POST`
- **Security Level**: **HIGH**
- **Rate Limit**: 20 requests/minute per IP
- **Content Inspection**: Request body (file ID)
- **Description**: Delete uploaded files
- **Check Point WAF Configuration**:
  - Monitor for mass deletion attempts
  - Validate file ID format (prevent path traversal)
  - Block requests with suspicious patterns
  - Log all delete operations

---

### Security Scanning Endpoints

#### 10. `/api/scan` ⚠️ **HIGH PRIORITY**
- **Methods**: `POST`
- **Security Level**: **HIGH**
- **Rate Limit**: 30 requests/minute per IP
- **Content Inspection**: **REQUIRED**
- **Description**: Scan file content with Lakera Guard
- **Check Point WAF Configuration**:
  - **Content Inspection**: Enable request body inspection
  - **Threat Detection**: Enable for prompt injection, PII detection
  - **File Content**: Scan uploaded file content
  - **Rate Limiting**: Prevent abuse of scanning service
  - **Security Policies**:
    - Block obvious injection attempts before reaching application
    - Validate file content structure
  - **Headers**: Check for `Content-Type: application/json`

#### 11. `/api/te/upload` ⚠️ **HIGH PRIORITY**
- **Methods**: `POST`
- **Security Level**: **CRITICAL**
- **Rate Limit**: 5 requests/minute per IP (Check Point TE has limits)
- **Content Inspection**: **REQUIRED** (multipart/form-data)
- **Description**: Upload files to Check Point Threat Emulation
- **Check Point WAF Configuration**:
  - **Content Inspection**: Enable file upload scanning
  - **File Size Limits**: 50MB maximum
  - **File Type Restrictions**: Same as `/api/files/store`
  - **Security Policies**:
    - Pre-scan files before forwarding to Check Point TE
    - Block known malicious files
    - Validate file signatures
  - **Rate Limiting**: Very strict (Check Point TE has API limits)
  - **Headers**: Check for `Content-Type: multipart/form-data`
  - **Timeout**: Set longer timeout (30+ seconds for sandboxing)

#### 12. `/api/te/query`
- **Methods**: `POST`
- **Security Level**: **HIGH**
- **Rate Limit**: 20 requests/minute per IP
- **Content Inspection**: Request body (query parameters)
- **Description**: Query Check Point TE for file analysis results
- **Check Point WAF Configuration**:
  - Inspect request body for injection attempts
  - Validate query parameters format
  - Monitor for excessive queries
  - Rate limit to prevent abuse

#### 13. `/api/te/config`
- **Methods**: `GET`, `POST`
- **Security Level**: **CRITICAL**
- **Rate Limit**: 5 requests/minute per IP
- **Content Inspection**: Request body (POST only - API keys)
- **Description**: Configure Check Point TE API key
- **Check Point WAF Configuration**:
  - **Authentication**: Require authentication if possible
  - **Content Inspection**: Scan for API keys in logs/responses
  - **Block API Key Leakage**: Never allow API keys in responses
  - **Rate Limiting**: Very strict
  - **Monitoring**: Alert on configuration changes

---

### Authentication & Settings Endpoints

#### 14. `/api/keys`
- **Methods**: `GET`, `POST`, `PUT`, `DELETE`
- **Security Level**: **CRITICAL**
- **Rate Limit**: 10 requests/minute per IP
- **Content Inspection**: **REQUIRED** (request body contains API keys)
- **Description**: Manage API keys (OpenAI, Lakera, etc.)
- **Check Point WAF Configuration**:
  - **Content Inspection**: Scan request body for API key patterns
  - **Block API Key Leakage**: Never allow API keys in responses
  - **Security Policies**:
    - Detect API key patterns in responses
    - Block responses containing API keys
    - Log key management operations
  - **Rate Limiting**: Strict to prevent brute force
  - **Headers**: Check for `Content-Type: application/json`

#### 15. `/api/keys/retrieve`
- **Methods**: `GET`
- **Security Level**: **CRITICAL**
- **Rate Limit**: 5 requests/minute per IP
- **Content Inspection**: Query parameters
- **Description**: Retrieve stored API keys
- **Check Point WAF Configuration**:
  - **Block API Key Leakage**: NEVER allow API keys in responses
  - **Content Inspection**: Scan responses for API key patterns
  - **Security Policies**:
    - Block if API keys detected in response body
    - Log all retrieval attempts
  - **Rate Limiting**: Very strict

#### 16. `/api/pin`
- **Methods**: `GET`, `POST`, `PUT`
- **Security Level**: **HIGH**
- **Rate Limit**: 5 requests/minute per IP
- **Content Inspection**: Request body (POST/PUT - PIN codes)
- **Description**: Manage PIN codes for security
- **Check Point WAF Configuration**:
  - Monitor for brute force attempts
  - Rate limit strictly
  - Log all PIN operations
  - Block excessive failed attempts

#### 17. `/api/settings/status`
- **Methods**: `GET`
- **Security Level**: Medium
- **Rate Limit**: 30 requests/minute per IP
- **Content Inspection**: None
- **Description**: Get settings status
- **Check Point WAF Configuration**:
  - Monitor for unusual patterns
  - No API keys should be in response

---

### Logging & Monitoring Endpoints

#### 18. `/api/logs/system`
- **Methods**: `GET`, `POST`, `DELETE`
- **Security Level**: **HIGH**
- **Rate Limit**: 
  - GET: 30 requests/minute per IP
  - POST: 10 requests/minute per IP
  - DELETE: 5 requests/minute per IP
- **Content Inspection**: Request body (POST), Query parameters (GET)
- **Description**: System log management
- **Check Point WAF Configuration**:
  - **Content Inspection**: Scan for sensitive data in POST body
  - **Security Policies**:
    - Block if API keys detected in logs
    - Sanitize logs before forwarding
  - **Rate Limiting**: Prevent log flooding
  - **DELETE Method**: Very strict rate limit

#### 19. `/api/waf/logs` ⚠️ **CHECK POINT WAF INTEGRATION**
- **Methods**: `GET`, `POST`
- **Security Level**: **HIGH**
- **Rate Limit**: 
  - From Check Point WAF IPs: 60 requests/minute
  - From other IPs: 10 requests/minute per IP (if auth enabled)
- **Content Inspection**: Query parameters (GET), Request body (POST)
- **Description**: Check Point WAF log access endpoint
- **Check Point WAF Configuration**:
  - **Authentication**: Enable if `WAF_AUTH_ENABLED=true`
  - **IP Whitelisting**: Consider whitelisting Check Point WAF IPs
  - **Content Inspection**: 
    - Scan query parameters for injection
    - Validate time range parameters
  - **Rate Limiting**: Higher limit for Check Point WAF IPs
  - **Headers**: Check for `Authorization` header if auth enabled
  - **Response**: May contain sensitive log data - ensure secure transport

---

### Other Endpoints

#### 20. `/api/version`
- **Methods**: `GET`
- **Security Level**: Low
- **Rate Limit**: 30 requests/minute per IP
- **Content Inspection**: None
- **Description**: Get application version
- **Check Point WAF Configuration**:
  - Allow without authentication
  - Monitor for excessive requests
  - No content inspection needed

#### 21. `/api/release-notes`
- **Methods**: `GET`
- **Security Level**: Low
- **Rate Limit**: 30 requests/minute per IP
- **Content Inspection**: None
- **Description**: Get release notes
- **Check Point WAF Configuration**:
  - Allow without authentication
  - No content inspection needed

---

## Check Point WAF Configuration Summary

### Priority Endpoints (Highest Security)

1. **`/api/chat`** - CRITICAL - Enable full content inspection
2. **`/api/te/upload`** - CRITICAL - File upload scanning
3. **`/api/scan`** - HIGH - Content inspection
4. **`/api/keys`**, **`/api/keys/retrieve`** - CRITICAL - Block API key leakage
5. **`/api/files/store`** - HIGH - File upload scanning
6. **`/api/waf/logs`** - HIGH - Check Point WAF integration

### Security Policy Recommendations

#### Content Inspection
Enable for:
- `/api/chat` (request & response)
- `/api/scan` (request body)
- `/api/files/store` (multipart file content)
- `/api/te/upload` (multipart file content)
- `/api/keys/*` (request & response - block API keys)

#### Rate Limiting
Apply strict limits to:
- `/api/chat` - 20 req/min (standard), 100 req/min (authenticated)
- `/api/te/upload` - 5 req/min
- `/api/keys/*` - 5-10 req/min
- `/api/pin` - 5 req/min
- `/api/files/store` - 10 req/min

#### File Upload Protection
For `/api/files/store` and `/api/te/upload`:
- Maximum file size: 50MB
- Block executable files (.exe, .bat, .sh, .dll)
- Block script files (.js, .php, .asp, .jsp)
- Validate file signatures
- Scan for malware

#### API Key Protection
For `/api/keys/*` endpoints:
- Never allow API keys in response bodies
- Block responses containing patterns like `sk-`, `Bearer `, etc.
- Log all key management operations
- Rate limit strictly

#### Threat Detection
Enable for:
- Prompt injection detection (in `/api/chat`)
- SQL injection detection (all POST endpoints)
- XSS detection (all endpoints accepting user input)
- Command injection detection
- Path traversal detection (file endpoints)

### Header Validation

Ensure these headers are validated:
- `Content-Type`: Must match expected type (application/json, multipart/form-data)
- `Content-Length`: Validate file size limits
- `Authorization`: If authentication enabled

### Monitoring & Alerting

Set up alerts for:
- Rate limit violations (especially `/api/chat`, `/api/te/upload`)
- Security blocks (403 responses)
- API key leakage attempts
- File upload violations
- Excessive requests to health endpoints (possible DDoS)

---

## Check Point WAF Policy Configuration Template

### Policy 1: Critical Chat Endpoint
```
Path: /api/chat
Methods: POST
Rate Limit: 20/min (standard), 100/min (authenticated)
Content Inspection: Enabled (request & response)
Threat Detection: Prompt injection, SQL injection, XSS
Max Request Size: 1MB
Max Response Size: 10MB
Logging: All requests and responses
```

### Policy 2: File Upload Endpoints
```
Paths: /api/files/store, /api/te/upload
Methods: POST
Rate Limit: 10/min (files/store), 5/min (te/upload)
Content Inspection: Enabled (multipart file content)
File Size Limit: 50MB
Blocked Extensions: .exe, .bat, .sh, .dll, .js, .php, .asp, .jsp
Malware Scanning: Enabled
Logging: All uploads
```

### Policy 3: API Key Management
```
Paths: /api/keys, /api/keys/retrieve, /api/te/config
Methods: GET, POST, PUT, DELETE
Rate Limit: 5-10/min
Content Inspection: Enabled (request & response)
Block API Keys in Responses: Enabled
Logging: All operations
```

### Policy 4: Health Check Endpoints
```
Paths: /api/health, /api/health/openai, /api/health/cache, /api/waf/health
Methods: GET, POST (for /api/health/openai)
Rate Limit: 30-60/min
Content Inspection: Request body only (for POST)
Logging: Monitor for DDoS patterns
```

### Policy 5: Monitoring Endpoints
```
Paths: /api/logs/system, /api/waf/logs
Methods: GET, POST, DELETE
Rate Limit: 10-30/min (standard), 60/min (Check Point WAF IPs)
Content Inspection: Query parameters and request body
Authentication: Optional but recommended
IP Whitelisting: Check Point WAF IPs (for /api/waf/logs)
```

---

## Quick Reference Table

| Endpoint | Method | Security | Rate Limit | Content Inspect | Priority |
|----------|--------|----------|------------|-----------------|----------|
| `/api/chat` | POST | CRITICAL | 20/min | ✅ Both | ⚠️ HIGH |
| `/api/te/upload` | POST | CRITICAL | 5/min | ✅ File | ⚠️ HIGH |
| `/api/scan` | POST | HIGH | 30/min | ✅ Body | ⚠️ HIGH |
| `/api/keys/*` | ALL | CRITICAL | 5-10/min | ✅ Both | ⚠️ HIGH |
| `/api/files/store` | POST | HIGH | 10/min | ✅ File | HIGH |
| `/api/waf/logs` | GET/POST | HIGH | 10-60/min | ✅ Params/Body | HIGH |
| `/api/files/delete` | DELETE | HIGH | 20/min | ✅ Body | MEDIUM |
| `/api/te/query` | POST | HIGH | 20/min | ✅ Body | MEDIUM |
| `/api/pin` | ALL | HIGH | 5/min | ✅ Body | MEDIUM |
| `/api/logs/system` | ALL | HIGH | 10-30/min | ✅ Params/Body | MEDIUM |
| `/api/health/*` | GET/POST | LOW | 30-60/min | ⚠️ POST only | LOW |
| `/api/models` | GET | LOW | 30/min | ❌ None | LOW |
| `/api/version` | GET | LOW | 30/min | ❌ None | LOW |

**Legend**:
- ✅ = Required
- ⚠️ = Conditional
- ❌ = Not needed

---

## Implementation Checklist

- [ ] Configure all endpoints listed above in Check Point WAF
- [ ] Set appropriate rate limits for each endpoint
- [ ] Enable content inspection for high-priority endpoints
- [ ] Configure file upload scanning for `/api/files/store` and `/api/te/upload`
- [ ] Enable API key leakage protection for `/api/keys/*` endpoints
- [ ] Set up threat detection (prompt injection, SQL injection, XSS)
- [ ] Configure monitoring and alerting
- [ ] Test all endpoints with Check Point WAF in place
- [ ] Verify log access from Check Point WAF to `/api/waf/logs`
- [ ] Document any custom rules or exceptions

---

For detailed integration instructions, see [CHECKPOINT_WAF_INTEGRATION.md](./CHECKPOINT_WAF_INTEGRATION.md).