# Lakera Telemetry / Logging Integration

**Purpose**: Send Lakera scan results and logs back to Platform.lakera.ai for analytics and monitoring

---

## 📋 Overview

This integration automatically sends Lakera scan results back to Platform.lakera.ai, enabling:
- Analytics and insights on security events
- Threat intelligence and pattern detection
- Performance monitoring and optimization
- Compliance and audit trails

---

## 🔧 Configuration

### Environment Variables

Add these to your `.env.local` or production environment:

```bash
# Enable/disable Lakera telemetry (default: true)
LAKERA_TELEMETRY_ENABLED=true

# Custom telemetry endpoint (optional, uses default if not set)
# Default: https://api.lakera.ai/v2/telemetry
# Alternative: https://platform.lakera.ai/api/v2/telemetry
LAKERA_TELEMETRY_ENDPOINT=https://api.lakera.ai/v2/telemetry
```

### Settings UI Configuration

No additional configuration needed! The telemetry automatically uses:
- Your **Lakera API Key** (configured in Settings)
- Your **Lakera Project ID** (configured in Settings, if provided)

---

## 📊 What Data is Sent

### Telemetry Payload

The following data is sent to Platform.lakera.ai:

```typescript
{
  timestamp: "2026-01-09T23:45:00.000Z",
  event_type: "scan" | "blocked" | "allowed",
  context: {
    type: "chat" | "file_upload",
    source: "chat" | "file_upload"
  },
  scan_result: {
    flagged: boolean,
    categories: { prompt_injection: true, ... },
    scores: { threat: 0.85, ... },
    threat_level: "low" | "medium" | "high" | "critical"
  },
  metadata: {
    user_ip: "192.168.1.1",
    file_name: "document.pdf",
    file_type: "pdf",
    file_size: 1024000,
    message_length: 150,
    detected_patterns: ["System Override", "Jailbreak Attempt"]
  },
  project_id: "your-project-id" // Optional
}
```

### What is NOT Sent

- **Full message/content**: Only metadata (length, file info) is sent
- **Sensitive user data**: User IP can be excluded if needed
- **API keys**: Never sent in telemetry

---

## 🚀 How It Works

### Automatic Telemetry

Telemetry is automatically sent after each Lakera scan:

1. **Chat Input/Output Scans**: Sent after each message scan
2. **File Upload Scans**: Sent after each file scan

### Non-Blocking

- Telemetry is sent **asynchronously** (fire and forget)
- Failures **do not** block the main application flow
- Errors are logged but don't affect user experience

---

## 📝 Implementation Details

### Files Modified

1. **`lib/lakera-telemetry.ts`** (New)
   - Core telemetry functions
   - Payload conversion utilities
   - Error handling

2. **`app/api/scan/route.ts`** (Modified)
   - Sends telemetry after file scans
   - Uses `sendLakeraTelemetryFromLog()`

3. **`app/api/chat/route.ts`** (Modified)
   - Sends telemetry after input/output scans
   - Uses `sendLakeraTelemetryFromLog()`

### Telemetry Endpoint

The default endpoint is:
```
https://api.lakera.ai/v2/telemetry
```

If this doesn't work, try:
```
https://platform.lakera.ai/api/v2/telemetry
```

You can override via `LAKERA_TELEMETRY_ENDPOINT` environment variable.

---

## 🔒 Security & Privacy

### Data Protection

- ✅ **Authentication**: Uses your Lakera API key (Bearer token)
- ✅ **Project Isolation**: Uses your Lakera Project ID (if configured)
- ✅ **Minimal Data**: Only sends necessary metadata, not full content
- ✅ **Optional IP**: User IP can be excluded if needed
- ✅ **HTTPS Only**: All telemetry sent over encrypted HTTPS

### Compliance

- Telemetry is sent **only** to Lakera Platform (your trusted security provider)
- No data is sent to third parties
- You control what is sent via environment variables

---

## 🐛 Troubleshooting

### Telemetry Not Sending

1. **Check Environment Variable**:
   ```bash
   echo $LAKERA_TELEMETRY_ENABLED
   # Should be "true" or not set (defaults to true)
   ```

2. **Check Lakera API Key**:
   - Ensure Lakera API key is configured in Settings
   - Verify API key is valid

3. **Check Server Logs**:
   ```bash
   # Check application logs for telemetry errors
   sudo journalctl -u secure-ai-chat | grep -i telemetry
   ```

### Disable Telemetry

To disable telemetry completely:

```bash
# Set in .env.local or production environment
LAKERA_TELEMETRY_ENABLED=false
```

Or remove the telemetry calls from the code if needed.

---

## 📚 API Reference

### Functions

#### `sendLakeraTelemetry(payload, apiKey, projectId?)`
Sends telemetry payload to Lakera Platform.

**Parameters**:
- `payload`: `LakeraTelemetryPayload` - Telemetry data
- `apiKey`: `string` - Lakera API key
- `projectId?`: `string` - Optional Lakera Project ID

**Returns**: `Promise<LakeraTelemetryResponse>`

#### `sendLakeraTelemetryFromLog(logEntry, apiKey, projectId?)`
Converts log entry to telemetry and sends it (convenience function).

**Parameters**:
- `logEntry`: Application log entry with Lakera decision
- `apiKey`: `string` - Lakera API key
- `projectId?`: `string` - Optional Lakera Project ID

**Returns**: `Promise<void>` (fire and forget)

#### `convertLogToTelemetry(logEntry)`
Converts application log entry to Lakera telemetry payload.

**Parameters**:
- `logEntry`: Application log entry

**Returns**: `LakeraTelemetryPayload | null` (null if not Lakera-related)

---

## 🔍 Verification

### Check if Telemetry is Working

1. **Enable Logging**:
   ```bash
   # Check console logs for telemetry messages
   npm run dev
   # Look for: "Sending telemetry to Lakera Platform" or "Telemetry sent successfully"
   ```

2. **Check Lakera Platform**:
   - Log in to Platform.lakera.ai
   - Navigate to your project dashboard
   - Check for incoming telemetry events

3. **Test Scan**:
   - Perform a chat message or file upload scan
   - Check server logs for telemetry confirmation

---

## 📖 Additional Resources

- **Lakera Platform**: https://platform.lakera.ai/
- **Lakera API Documentation**: https://platform.lakera.ai/docs
- **Lakera Guard API**: https://api.lakera.ai/v2/guard

---

## ✅ Benefits

1. **Analytics**: Track security events and threats across your application
2. **Threat Intelligence**: Get insights on attack patterns and trends
3. **Performance**: Monitor scan performance and optimize configurations
4. **Compliance**: Maintain audit trails for security events
5. **Visibility**: Centralized view of all security scans in Lakera Platform

---

**Last Updated**: 2026-01-XX  
**Maintained By**: Development Team
