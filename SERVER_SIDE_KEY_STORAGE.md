# Server-Side Encrypted API Key Storage

This document describes how API keys are stored server-side and encrypted to ensure the application works from any browser or device.

---

## Overview

All API keys (OpenAI, Lakera AI, Lakera Project ID, Lakera Endpoint) are now stored **server-side** in encrypted storage. This ensures:

1. ✅ **Keys work from any browser/device** - No need to configure keys on each device
2. ✅ **Keys are encrypted at rest** - AES-256-CBC encryption with secure key management
3. ✅ **Keys never exposed to client** - Stored only on the server
4. ✅ **Environment variable support** - Can be set via environment variables (highest priority)
5. ✅ **Secure file storage** - Encrypted files in `.secure-storage/` directory

---

## Storage Architecture

### Storage Locations (Priority Order)

1. **Environment Variables** (Highest Priority)
   - `OPENAI_API_KEY`
   - `LAKERA_AI_KEY`
   - `LAKERA_PROJECT_ID`
   - `LAKERA_ENDPOINT`

2. **Encrypted File Storage** (Secondary)
   - Location: `.secure-storage/api-keys.enc`
   - Encryption: AES-256-CBC
   - Permissions: 600 (owner read/write only)

3. **localStorage** (Fallback/Migration)
   - Used only for backward compatibility
   - Automatically migrated to server-side storage
   - Cleared after successful server-side save

---

## Encryption Details

### Algorithm
- **AES-256-CBC** (Advanced Encryption Standard, 256-bit key, CBC mode)
- **IV** (Initialization Vector): Random 16 bytes per encryption
- **Key Derivation**: SHA-256 hash of encryption key or environment variable

### Encryption Key Source

1. **Environment Variable** (Recommended for production):
   ```bash
   API_KEYS_ENCRYPTION_KEY=your-secret-encryption-key-32-bytes-or-more
   # or
   CHECKPOINT_TE_ENCRYPTION_KEY=your-secret-encryption-key-32-bytes-or-more
   ```

2. **Default Key** (Less secure, for development only):
   - Uses a default secret if no environment variable is set
   - **Not recommended for production**

### File Format
```
<IV_HEX>:<ENCRYPTED_DATA_HEX>
```

Example:
```
a1b2c3d4e5f6...:9f8e7d6c5b4a...
```

---

## API Endpoints

### 1. GET `/api/keys`
**Purpose**: Get API key configuration status (without exposing keys)

**Response**:
```json
{
  "configured": {
    "openAiKey": true,
    "lakeraAiKey": true,
    "lakeraProjectId": true,
    "lakeraEndpoint": true
  },
  "source": {
    "openAiKey": "environment" | "storage" | "none",
    "lakeraAiKey": "environment" | "storage" | "none",
    ...
  },
  "message": "API keys configuration status retrieved successfully"
}
```

### 2. POST `/api/keys`
**Purpose**: Set or update API keys (encrypted server-side)

**Request Body**:
```json
{
  "keys": {
    "openAiKey": "sk-...",
    "lakeraAiKey": "lak_...",
    "lakeraProjectId": "proj_...",
    "lakeraEndpoint": "https://api.lakera.ai/v2/guard"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "API keys configured successfully",
  "configured": {
    "openAiKey": true,
    "lakeraAiKey": true,
    ...
  }
}
```

### 3. DELETE `/api/keys?key=openAiKey` or `/api/keys?all=true`
**Purpose**: Remove API key(s)

**Query Parameters**:
- `key`: Specific key name to delete (e.g., `openAiKey`, `lakeraAiKey`)
- `all`: Delete all keys (requires `all=true`)

**PIN Protection**: Requires PIN verification if PIN is configured

**Request Body** (if PIN configured):
```json
{
  "pin": "1234"
}
```

### 4. GET `/api/keys/retrieve`
**Purpose**: Retrieve API keys for client-side use (for API calls)

**Response**:
```json
{
  "keys": {
    "openAiKey": "sk-...",
    "lakeraAiKey": "lak_...",
    "lakeraProjectId": "proj_...",
    "lakeraEndpoint": "https://api.lakera.ai/v2/guard"
  },
  "configured": {
    "openAiKey": true,
    "lakeraAiKey": true,
    ...
  }
}
```

**Note**: This endpoint returns actual keys. It's used by client components that need to make API calls. Keys are already configured server-side, so this is safe.

---

## Usage Flow

### Setting API Keys

1. **User configures keys in Settings UI**:
   - Paste API keys into Settings form
   - Click "Save Keys"

2. **Frontend sends keys to server**:
   - POST to `/api/keys` with keys in request body
   - Keys are sent over HTTPS (encrypted in transit)

3. **Server stores keys encrypted**:
   - Keys encrypted using AES-256-CBC
   - Stored in `.secure-storage/api-keys.enc`
   - Permissions set to 600 (owner read/write only)

4. **Client cleared**:
   - Keys removed from localStorage
   - Keys cleared from component state
   - Server-side keys now take priority

### Using API Keys

1. **Client makes API request**:
   - Sends request to `/api/chat` or `/api/scan`
   - May include keys in request (for backward compatibility)

2. **Server retrieves keys**:
   - Checks environment variables first
   - If not found, loads from encrypted file storage
   - Falls back to client keys only if server-side not configured

3. **Server uses keys**:
   - Makes API calls using server-side keys
   - Keys never exposed to client
   - Works from any browser/device

---

## Migration from localStorage

The system automatically migrates keys from localStorage to server-side storage:

1. **On Settings page load**:
   - Checks server-side status
   - If localStorage has keys and server-side doesn't:
     - Displays keys from localStorage
     - User can save to migrate to server-side

2. **After saving to server-side**:
   - Keys removed from localStorage
   - Keys now stored server-side only
   - Works from any browser/device

3. **Backward compatibility**:
   - API routes check server-side first
   - Fall back to client keys if server-side not configured
   - Ensures existing installations continue working

---

## Security Considerations

### Encryption at Rest

- ✅ **AES-256-CBC encryption** - Industry-standard encryption
- ✅ **Random IV per encryption** - Prevents pattern analysis
- ✅ **Secure key derivation** - SHA-256 hash of encryption key
- ✅ **File permissions** - 600 (owner read/write only)

### Encryption Key Management

**Recommended for Production**:
```bash
# Set a strong encryption key via environment variable
export API_KEYS_ENCRYPTION_KEY="your-strong-random-key-32-bytes-minimum"
```

**Generate a secure key**:
```bash
# Generate a 32-byte (256-bit) random key
openssl rand -hex 32
```

### File Storage

- ✅ **Directory permissions**: 700 (owner read/write/execute only)
- ✅ **File permissions**: 600 (owner read/write only)
- ✅ **Location**: `.secure-storage/` (excluded from git)
- ✅ **Backup**: Included in `.env` backups during updates

### Access Control

- ✅ **PIN protection** - Required for deleting keys
- ✅ **Server-side only** - Keys never stored in browser
- ✅ **HTTPS only** - Keys sent encrypted in transit
- ✅ **No client exposure** - Keys not in JavaScript bundles

---

## Environment Variables

### For API Keys (Optional)

Set these if you want to configure keys via environment variables instead of UI:

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-...

# Lakera AI Key
LAKERA_AI_KEY=lak_...

# Lakera Project ID
LAKERA_PROJECT_ID=proj_...

# Lakera Endpoint (optional, defaults to https://api.lakera.ai/v2/guard)
LAKERA_ENDPOINT=https://api.lakera.ai/v2/guard
```

### For Encryption Key (Recommended for Production)

```bash
# Encryption key for API keys storage (32+ bytes recommended)
API_KEYS_ENCRYPTION_KEY=your-strong-random-encryption-key

# Or use Check Point TE encryption key (shared)
CHECKPOINT_TE_ENCRYPTION_KEY=your-strong-random-encryption-key
```

---

## Configuration Priority

1. **Environment Variables** (Highest Priority)
   - Always used if set
   - Not saved to file storage

2. **Encrypted File Storage** (Secondary)
   - Used if environment variables not set
   - Persists across restarts

3. **Client Keys** (Fallback/Backward Compatibility)
   - Used only if server-side not configured
   - Deprecated - will be removed in future versions

---

## Benefits

### ✅ Universal Access
- **Works from any browser** - Keys stored server-side, not browser-specific
- **Works from any device** - Mobile, tablet, desktop all work
- **No reconfiguration** - Set once, works everywhere

### ✅ Security
- **Encrypted at rest** - AES-256-CBC encryption
- **Secure storage** - Files in `.secure-storage/` with restricted permissions
- **No client exposure** - Keys never in browser storage or JavaScript
- **PIN protection** - Required for sensitive operations

### ✅ Flexibility
- **Environment variables** - Can be set via `.env` or system environment
- **UI configuration** - Can be set via Settings page
- **Easy backup** - Encrypted files can be backed up
- **Easy migration** - Automatic migration from localStorage

---

## File Structure

```
.secure-storage/
├── api-keys.enc              # Encrypted API keys (AES-256-CBC)
├── checkpoint-te-key.enc     # Encrypted Check Point TE key
├── verification-pin.hash     # Hashed PIN (PBKDF2-SHA512)
└── system-logs.json          # System logs (not encrypted)
```

**Permissions**:
- Directory: `700` (owner read/write/execute only)
- Files: `600` (owner read/write only)

---

## Troubleshooting

### Keys Not Working After Migration

**Issue**: Keys configured in localStorage but not working after migration

**Solution**:
1. Go to Settings page
2. Keys from localStorage should be displayed
3. Click "Save Keys" to migrate to server-side storage
4. Keys will now work from any browser/device

### Keys Not Persisting After Restart

**Issue**: Keys configured but lost after server restart

**Solution**:
1. Check `.secure-storage/api-keys.enc` exists and has permissions 600
2. Check encryption key is set: `API_KEYS_ENCRYPTION_KEY` or `CHECKPOINT_TE_ENCRYPTION_KEY`
3. Verify directory permissions: `.secure-storage/` should be 700

### Environment Variables Not Working

**Issue**: Environment variables set but not being used

**Solution**:
1. Verify environment variables are set correctly
2. Restart the application after setting environment variables
3. Check environment variables are accessible: `process.env.OPENAI_API_KEY`
4. Server-side storage takes priority - keys in file storage won't be used if env vars are set

---

## Best Practices

1. **Use Environment Variables for Production**:
   ```bash
   # Set in .env or system environment
   OPENAI_API_KEY=sk-...
   LAKERA_AI_KEY=lak_...
   API_KEYS_ENCRYPTION_KEY=your-strong-random-key
   ```

2. **Set Strong Encryption Key**:
   ```bash
   # Generate a secure 32-byte key
   openssl rand -hex 32
   ```

3. **Backup `.secure-storage/` Directory**:
   ```bash
   # Backup encrypted storage
   tar -czf secure-storage-backup.tar.gz .secure-storage/
   ```

4. **Restrict File Permissions**:
   ```bash
   # Ensure proper permissions
   chmod 700 .secure-storage/
   chmod 600 .secure-storage/*.enc
   chmod 600 .secure-storage/*.hash
   ```

5. **Monitor Access**:
   - Check logs for unauthorized access attempts
   - Monitor `.secure-storage/` directory for changes
   - Use system-level file monitoring if available

---

## API Route Changes

### Updated Routes

1. **`/api/chat`**:
   - Now retrieves keys from server-side storage first
   - Falls back to client keys for backward compatibility
   - Works without client keys if server-side configured

2. **`/api/scan`**:
   - Now retrieves keys from server-side storage first
   - Falls back to client keys for backward compatibility
   - Works without client keys if server-side configured

3. **`/api/keys`** (New):
   - GET: Get key configuration status
   - POST: Set/update keys (encrypted server-side)
   - DELETE: Remove keys (PIN protected)

4. **`/api/keys/retrieve`** (New):
   - GET: Retrieve keys for client-side use
   - Used by components that need keys for API calls

---

## Migration Guide

### For Existing Installations

1. **Keys in localStorage**:
   - Settings page will show keys from localStorage
   - Click "Save Keys" to migrate to server-side
   - Keys will be removed from localStorage after save

2. **Keys in environment variables**:
   - No action needed
   - Environment variables take priority
   - File storage won't override environment variables

3. **Mixed configuration**:
   - Environment variables take priority
   - File storage used for keys not in environment
   - Client keys only used if neither available

---

## Testing

### Test Server-Side Storage

```bash
# Set a key via API
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{"keys":{"openAiKey":"sk-test"}}'

# Check status
curl http://localhost:3000/api/keys

# Verify encrypted file exists
ls -la .secure-storage/api-keys.enc

# Check permissions
stat -c '%a %n' .secure-storage/api-keys.enc
# Should show: 600
```

---

**Last Updated**: 2026-01-XX  
**Version**: 1.0.2  
**Storage**: `.secure-storage/api-keys.enc`  
**Encryption**: AES-256-CBC
