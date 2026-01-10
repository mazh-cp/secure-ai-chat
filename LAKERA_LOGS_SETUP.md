# How to Send Lakera Logs Back to Platform.lakera.ai

**Purpose**: Configure automatic log export from Secure AI Chat to Platform.lakera.ai for analytics, monitoring, and compliance.

---

## 📋 Overview

There are **two methods** to send Lakera logs back to Platform.lakera.ai:

1. **S3 Log Export** (Enterprise Feature - Recommended)
   - Automatic log export to S3 bucket
   - Configured via Platform.lakera.ai Settings
   - Best for SIEM integration and compliance

2. **API Telemetry** (Custom Implementation)
   - Real-time telemetry via API endpoint
   - Integrated in Secure AI Chat
   - Best for immediate analytics

---

## 🚀 Method 1: S3 Log Export (Enterprise - Recommended)

### Overview

Lakera provides an Enterprise feature that automatically exports logs to an S3 bucket. This is the **recommended method** for production deployments.

### Setup Steps

1. **Access Platform.lakera.ai**:
   - Log in to your Lakera account at https://platform.lakera.ai
   - Navigate to **Settings** page
   - Click on **"Export logs"** tab

2. **Configure S3 Bucket Credentials**:
   - Provide S3 bucket credentials:
     - **Access Key** - AWS Access Key ID
     - **Secret Key** - AWS Secret Access Key
     - **Bucket Name** - S3 bucket name
     - **Region** - AWS region (e.g., `us-east-1`)
     - **Path** (Optional) - Path within bucket
   - Click **"Test authentication"** to verify credentials
   - Click **"Save changes"** to enable log export

3. **Log Format**:
   - Logs are exported in JSONL format
   - File naming: `YYYY/MM/DD/hh/YYYY-MM-DDThh:mm:ss+ZONE.jsonl`
   - Example: `2024/01/31/16/2024-01-31T16:36:00+00:00.jsonl`
   - Each line is a separate Guard log entry

4. **Benefits**:
   - ✅ Automatic, no code changes needed
   - ✅ Centralized in Platform.lakera.ai
   - ✅ SIEM integration ready
   - ✅ Compliance and audit trails
   - ✅ Enterprise-grade reliability

### Troubleshooting

- **Invalid Credentials**: Organization admins receive email notifications
- **Access Key Rotation**: Update credentials in Platform.lakera.ai Settings
- **Bucket Removal**: Contact Lakera support if bucket is removed

---

## 📊 Method 2: API Telemetry (Custom Implementation)

### Overview

Secure AI Chat includes a custom telemetry implementation that sends scan results directly to Lakera Platform via API endpoint.

### Configuration

#### Environment Variables

Add to `.env.local` or production environment:

```bash
# Enable/disable Lakera telemetry (default: true)
LAKERA_TELEMETRY_ENABLED=true

# Custom telemetry endpoint (optional)
# Default: https://api.lakera.ai/v2/telemetry
LAKERA_TELEMETRY_ENDPOINT=https://api.lakera.ai/v2/telemetry
```

#### Settings UI Configuration

No additional configuration needed! Telemetry automatically uses:
- Your **Lakera API Key** (configured in Settings)
- Your **Lakera Project ID** (configured in Settings, if provided)

### What Data is Sent

Telemetry payload sent to Platform.lakera.ai:

```json
{
  "timestamp": "2026-01-09T23:45:00.000Z",
  "event_type": "scan" | "blocked" | "allowed",
  "context": {
    "type": "chat" | "file_upload",
    "source": "chat" | "file_upload"
  },
  "scan_result": {
    "flagged": true,
    "categories": { "prompt_injection": true },
    "scores": { "threat": 0.85 },
    "threat_level": "high"
  },
  "metadata": {
    "user_ip": "192.168.1.1",
    "file_name": "document.pdf",
    "file_type": "pdf",
    "file_size": 1024000,
    "message_length": 150,
    "detected_patterns": ["System Override"]
  },
  "project_id": "your-project-id"
}
```

### When Telemetry is Sent

- ✅ **After each chat input scan** (if Lakera scanning enabled)
- ✅ **After each chat output scan** (if Lakera scanning enabled)
- ✅ **After each file upload scan** (if Lakera scanning enabled)

### Security & Privacy

- ✅ **Authentication**: Uses your Lakera API key (Bearer token)
- ✅ **Project Isolation**: Uses your Lakera Project ID (if configured)
- ✅ **Minimal Data**: Only metadata, not full content
- ✅ **HTTPS Only**: All telemetry sent over encrypted HTTPS
- ✅ **Non-Blocking**: Failures don't affect main application flow

### Disable Telemetry

To disable API telemetry:

```bash
# Set in .env.local or production environment
LAKERA_TELEMETRY_ENABLED=false
```

---

## 🔍 Verification

### Check if Logs are Being Sent (S3 Method)

1. **Check S3 Bucket**:
   ```bash
   # List recent log files
   aws s3 ls s3://your-bucket-name/2024/01/31/16/ --recursive
   ```

2. **Check Platform.lakera.ai**:
   - Log in to Platform.lakera.ai
   - Navigate to Settings → Export logs
   - Check export status and recent exports

### Check if Telemetry is Being Sent (API Method)

1. **Check Server Logs**:
   ```bash
   # Check application logs
   sudo journalctl -u secure-ai-chat | grep -i telemetry
   ```

2. **Check Console Logs**:
   ```bash
   # In development
   npm run dev
   # Look for: "Sending telemetry to Lakera Platform" messages
   ```

3. **Check Lakera Platform**:
   - Log in to Platform.lakera.ai
   - Navigate to your project dashboard
   - Check for incoming telemetry events

---

## 📚 API Documentation

### Lakera Platform Resources

- **Platform**: https://platform.lakera.ai/
- **API Documentation**: https://docs.lakera.ai/docs/platform
- **Guard API**: https://api.lakera.ai/v2/guard
- **Export Logs Guide**: See Platform.lakera.ai Settings → Export logs

---

## 🎯 Recommendation

### For Production:

**Use Method 1 (S3 Log Export)** if you have Enterprise access:
- ✅ Most reliable
- ✅ No code dependencies
- ✅ Built-in SIEM integration
- ✅ Enterprise support

**Use Method 2 (API Telemetry)** if:
- S3 export not available
- Need real-time analytics
- Custom integration requirements

### For Development:

Both methods work, but S3 Export is preferred for production-grade logging.

---

## 🐛 Troubleshooting

### S3 Export Not Working

1. **Check Credentials**: Verify S3 bucket credentials in Platform.lakera.ai
2. **Check Permissions**: Ensure AWS credentials have S3 write permissions
3. **Check Bucket**: Verify bucket exists and is accessible
4. **Check Email**: Organization admins receive email notifications for issues

### API Telemetry Not Working

1. **Check Environment Variable**:
   ```bash
   echo $LAKERA_TELEMETRY_ENABLED
   # Should be "true" or not set (defaults to true)
   ```

2. **Check Lakera API Key**: Ensure API key is configured in Settings

3. **Check Endpoint**: Verify telemetry endpoint is accessible:
   ```bash
   curl -X POST https://api.lakera.ai/v2/telemetry \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

4. **Check Server Logs**: Look for telemetry errors:
   ```bash
   sudo journalctl -u secure-ai-chat | grep -i telemetry
   ```

---

## ✅ Summary

**To send Lakera logs to Platform.lakera.ai:**

1. **Enterprise Customers (Recommended)**:
   - Configure S3 log export in Platform.lakera.ai Settings
   - No code changes needed

2. **All Users (Alternative)**:
   - Ensure `LAKERA_TELEMETRY_ENABLED=true` (default)
   - Configure Lakera API key in Settings
   - Telemetry is automatically sent after each scan

**Both methods are secure, privacy-preserving, and production-ready.**

---

**Last Updated**: 2026-01-XX  
**Maintained By**: Development Team
