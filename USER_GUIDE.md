# Secure AI Chat - User Guide

**Version 1.0.11**

Welcome to Secure AI Chat! This guide will help you get the most out of the application's features, from secure conversations to file uploads and security scanning. This version includes full Azure OpenAI support, enhanced security features, and improved user experience.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Chat Interface](#chat-interface)
3. [File Upload & RAG](#file-upload--rag)
4. [Security Features](#security-features)
5. [Settings & Configuration](#settings--configuration)
6. [Dashboard & Monitoring](#dashboard--monitoring)
7. [Risk Map](#risk-map)
8. [Health Check & Cache Management](#health-check--cache-management)
9. [Tips & Best Practices](#tips--best-practices)

---

## Getting Started

### First Time Setup

1. **Configure API Keys**
   - Navigate to the **Settings** page (⚙️ icon in the sidebar)
   - Add your **OpenAI API Key** (required for OpenAI provider)
   - Add your **Azure OpenAI API Key** and **Endpoint** (required for Azure OpenAI provider)
   - Add your **Lakera AI API Key** and **Project ID** (for security scanning)
   - Optionally add your **Check Point TE API Key** (for file sandboxing)
   - **Validate Azure OpenAI credentials** using the validation button (shows real-time feedback)
   - Click **Save Keys** to store them securely

2. **Choose Your Provider and Model**
   - On the Chat page, use the **Provider** dropdown to select between **OpenAI** or **Azure OpenAI**
   - Use the **Model** dropdown to select your preferred model
   - When switching to Azure OpenAI, `gpt-4o-mini` is automatically selected (recommended)
   - Your provider and model preferences are saved automatically
   - **Note**: You can use either provider - the chat page remains accessible if at least one provider is configured

3. **Enable Security Features**
   - Toggle **Input Scan** and **Output Scan** on the Chat page for Lakera Guard protection
   - These scans protect against prompt injection and malicious content

---

## Chat Interface

### Basic Usage

The chat interface is your main workspace for AI conversations. Here's what you need to know:

- **Type your message** in the input box at the bottom
- **Press Enter** or click the send button to submit
- **View responses** in the conversation area above
- **Switch models** using the dropdown menu (if you have multiple models available)

### Security Features

**Lakera Guard Protection:**
- **Input Scan**: Scans your messages before sending to the AI
- **Output Scan**: Scans AI responses before displaying them
- Both can be toggled on/off using the switches on the Chat page

**What Gets Blocked:**
- Prompt injection attempts
- Jailbreak attempts
- System override commands
- Malicious instructions
- PII (Personally Identifiable Information) if configured

If a message is blocked, you'll see a clear message explaining why and can rephrase your question.

### Provider and Model Selection

**OpenAI Provider:**
- Choose from available OpenAI models based on your API key
- **gpt-4o-mini** (default) - Fast and cost-effective
- **gpt-4o** - More capable, better for complex tasks
- **gpt-4-turbo** - Latest capabilities
- **gpt-5.x** models - Latest generation (OpenAI only, not available for Azure)

**Azure OpenAI Provider:**
- Uses your Azure OpenAI deployment names (must match exactly, case-sensitive)
- **gpt-4o-mini** (recommended, auto-selected) - Fast and cost-effective
- **gpt-4o** - More capable
- **gpt-4** - Standard GPT-4
- **gpt-4-turbo** - Turbo variant
- **Note**: GPT-5 models are not supported by Azure OpenAI

**Switching Providers:**
- Use the Provider dropdown to switch between OpenAI and Azure OpenAI
- The model selector automatically updates based on your provider choice
- If one provider has invalid keys, you can still use the other provider
- Your provider and model preferences are saved and persist across sessions

---

## File Upload & RAG

### Uploading Files

The Files page allows you to upload documents for use with RAG (Retrieval-Augmented Generation). Here's how it works:

**Multiple File Upload:**
- You can upload **up to 10 files simultaneously** (increased from 5)
- Supported formats: PDF, TXT, MD, JSON, CSV, DOCX
- Maximum file size: **50 MB per file**
- Files are stored persistently on the server

**How to Upload:**
1. Go to the **Files** page (📁 icon in the sidebar)
2. **Drag and drop** files onto the upload area, or **click to browse**
3. Watch the progress bar as files are processed
4. Files appear in the list once uploaded

### File Processing

**Automatic Processing:**
- Files are automatically saved to server storage
- Metadata (name, size, upload date) is tracked
- Files persist across server restarts

**Security Scanning Options:**

1. **Check Point TE Sandboxing** (optional)
   - Scans files for malware and threats
   - Provides detailed threat analysis
   - Must be enabled in Settings first

2. **Lakera Scan** (optional)
   - Scans file content for security threats
   - Can be enabled/disabled via toggle

3. **RAG Auto-Scan** (optional)
   - Automatically scans files on upload
   - Requires Lakera Scan to be enabled

**File Status Indicators:**
- 🟡 **Pending**: File uploaded, waiting for processing
- 🔵 **Scanning**: Currently being scanned
- 🟢 **Safe**: File passed all security checks
- 🔴 **Flagged**: Security threats detected
- ⚪ **Not Scanned**: Scanning was disabled
- ⚠️ **Error**: Processing failed

### Managing Files

- **View Files**: All uploaded files appear in the list
- **Remove Files**: Click the delete button to remove a file
- **Scan Manually**: Use the Scan button to manually trigger security scanning
- **File Details**: Hover over files to see upload date and size

---

## Security Features

### Lakera Guard Integration

Lakera Guard provides comprehensive security for your AI interactions:

**Input Scanning:**
- Scans user messages before they reach the AI
- Blocks prompt injection, jailbreak attempts, and malicious instructions
- Provides detailed threat categorization

**Output Scanning:**
- Scans AI responses before displaying them
- Prevents harmful or inappropriate content
- Ensures safe AI interactions

**Context Scanning:**
- Scans uploaded file content for threats
- Removes malicious chunks before RAG processing
- Protects against document-based attacks

### Check Point Threat Emulation

**File Sandboxing:**
- Uploads files to Check Point's cloud sandbox
- Analyzes files for malware, exploits, and threats
- Provides detailed threat reports with severity levels
- Blocks malicious files automatically

**How It Works:**
1. Enable Check Point TE in Settings
2. Toggle "File Sandboxing" on the Files page
3. Upload files - they're automatically sent for analysis
4. View results in the file status

---

## Settings & Configuration

### API Key Management

**OpenAI API Key:**
- Required for chat functionality
- Stored securely on the server
- Validated automatically when saved
- Status indicator shows if key is valid

**Lakera AI Configuration:**
- **API Key**: Required for security scanning
- **Project ID**: Links to your Lakera Guard policy
- **Endpoint**: Defaults to `https://api.lakera.ai/v2/guard`
- All stored securely on the server
- Project ID remains visible for policy verification

**Azure OpenAI Configuration:**
- **API Key**: Required for Azure OpenAI provider
- **Endpoint**: Your Azure OpenAI resource endpoint (e.g., `https://your-resource.openai.azure.com`)
- Both stored securely on the server
- **Validation Button**: Click "🔍 Validate Azure OpenAI Credentials" to test your configuration
- Validation checks endpoint format, API key, connection, and deployment availability
- Status indicators show configuration status
- Supports environment variables: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`

**Check Point TE API Key:**
- Optional, for file sandboxing
- Stored securely on the server
- Validated when saved
- Status indicator shows configuration status

### Key Validation

The Settings page provides real-time validation:
- 🟡 **Yellow dot**: Validating...
- 🟢 **Green dot**: Key is valid
- 🔴 **Red dot**: Key is invalid or not configured

### Security Options

**PIN Protection** (if enabled):
- Protects sensitive operations
- Required for clearing certain settings
- Adds an extra layer of security

---

## Dashboard & Monitoring

### Activity Dashboard

The Dashboard page provides insights into your application usage:

- **Security Events**: View blocked requests and threats
- **File Uploads**: Track uploaded files and scan results
- **System Status**: Monitor API connectivity
- **Statistics**: See usage patterns and trends

### Logs & Analytics

- **Real-time Logs**: View security events as they happen
- **Filter Options**: Filter by type, severity, or date
- **Export Options**: Download logs for analysis
- **Search Functionality**: Find specific events quickly

---

## Risk Map

### OWASP Top 10 for LLMs

The Risk Map visualizes security risks based on the OWASP Top 10 for LLMs 2025:

**Risk Categories:**
- **LLM01**: Prompt Injection
- **LLM02**: Insecure Output Handling
- **LLM03**: Training Data Poisoning
- **LLM04**: Model Denial of Service
- **LLM05**: Supply Chain Vulnerabilities
- **LLM06**: Sensitive Information Disclosure
- **LLM07**: Insecure Plugin Design
- **LLM08**: Excessive Agency
- **LLM09**: Overreliance
- **LLM10**: Model Theft

**How to Use:**
- Click on any risk to see details
- View associated security events
- Understand mitigation strategies
- Track risk exposure over time

---

## Health Check & Cache Management

### Automatic Cache Cleanup

The application automatically clears uploaded files every **24 hours** to manage storage:

**How It Works:**
- Cleanup runs automatically in the background
- Removes all uploaded files and metadata
- Preserves API keys and system logs
- Logs cleanup statistics

**Manual Control:**

You can check cache status or manually trigger cleanup:

**Check Status:**
```bash
curl http://localhost:3000/api/health/cache
```

**Manually Trigger Cleanup:**
```bash
curl -X POST http://localhost:3000/api/health/cache \
  -H "Content-Type: application/json" \
  -d '{"action": "cleanup"}'
```

**Response Includes:**
- Cleanup service status
- Last cleanup time
- Next scheduled cleanup
- Current storage statistics (file count, total size)

### Health Check Endpoints

**General Health:**
- `GET /api/health` - Basic service health check
- Returns service status and timestamp

**Cache Health:**
- `GET /api/health/cache` - Cache cleanup status and storage stats
- `POST /api/health/cache` - Manually trigger cleanup

**Azure OpenAI Health:**
- `POST /api/health/azure-openai` - Validate Azure OpenAI credentials
  - Body: `{ "apiKey": "your-key", "endpoint": "your-endpoint", "deploymentName": "gpt-4o-mini" }`
  - Returns validation status and deployment information
  - Used by Settings page for real-time validation

**Check Point WAF Integration:**
- `GET /api/waf/health` - WAF integration health check
  - Returns WAF middleware status and endpoint information
  - Verifies middleware is running and capturing requests
- `GET /api/waf/logs` - Retrieve security logs for Check Point WAF
  - Query parameters: `level`, `service`, `startTime`, `endTime`, `clientIP`, `endpoint`, `blocked`, `threatDetected`, `limit`
  - Returns structured logs in JSON format
  - Optional authentication via `WAF_AUTH_ENABLED` and `WAF_API_KEY` environment variables
- `POST /api/waf/logs` - Export logs in Check Point WAF format
  - Body: `{ "format": "json|csv", "startTime": "ISO-timestamp", "endTime": "ISO-timestamp", "services": [], "includeDetails": true }`
  - Supports CSV export for Check Point WAF import
  - Returns filtered logs based on criteria

**Check Point WAF Endpoints Details:**

The application integrates with Check Point Web Application Firewall (WAF) for enterprise-grade security monitoring:

1. **Middleware Integration** (`middleware.ts`):
   - Automatically captures all API request metadata
   - Extracts Check Point WAF-specific headers (`x-checkpoint-*`, `x-cp-*`, `cp-waf-*`)
   - Detects client IP from Check Point WAF headers
   - Logs security events (blocked requests, threat detection)
   - Adds application identification headers to responses

2. **WAF Logs API** (`/api/waf/logs`):
   - **GET**: Retrieve filtered logs for Check Point WAF consumption
     - Filter by log level, service, time range, IP address, endpoint
     - Filter by blocked status and threat detection
     - Maximum 1000 logs per request (default: 100)
   - **POST**: Export logs in specific format (JSON or CSV)
     - CSV format compatible with Check Point WAF import
     - Supports time range and service filtering
   - **Authentication**: Optional via `WAF_AUTH_ENABLED=true` and `WAF_API_KEY` environment variables
   - **Response Format**: Structured JSON with metadata, timestamps, and security event details

3. **WAF Health Check** (`/api/waf/health`):
   - Verifies middleware is running
   - Returns endpoint URLs for logs and health
   - Provides integration status

4. **Security Event Logging**:
   - All blocked requests (403, 401) are logged with WAF metadata
   - Threat detection events include client IP, user agent, request details
   - Logs are stored in system logs and accessible via `/api/waf/logs`
   - Compatible with Check Point WAF log aggregation systems

**Configuration:**
- Set `WAF_AUTH_ENABLED=true` in environment variables to enable authentication
- Set `WAF_API_KEY=your-secret-key` for authentication token
- Check Point WAF should be configured to read from `/api/waf/logs` endpoint
- Recommended: Restrict `/api/waf/*` endpoints to Check Point WAF IP addresses only

---

## Tips & Best Practices

### Security Best Practices

1. **Always Enable Input/Output Scanning**
   - Protects against prompt injection
   - Prevents malicious AI responses
   - Essential for production use

2. **Use Check Point TE for File Uploads**
   - Especially important for untrusted sources
   - Provides comprehensive threat analysis
   - Blocks malicious files automatically

3. **Regularly Review Security Logs**
   - Check the Dashboard for blocked requests
   - Investigate any flagged content
   - Adjust policies as needed

4. **Keep API Keys Secure**
   - Never share API keys
   - Rotate keys periodically
   - Use environment variables in production

### File Upload Tips

1. **Upload Relevant Files**
   - Only upload files needed for RAG
   - Keep file sizes reasonable
   - Use supported formats

2. **Monitor File Status**
   - Check scan results before relying on file content
   - Remove files you no longer need
   - Keep storage clean

3. **Multiple File Uploads**
   - Take advantage of the 5-file limit
   - Upload related files together
   - Watch the progress indicator

### Performance Tips

1. **Model Selection**
   - Use gpt-4o-mini for simple tasks (faster, cheaper)
   - Use gpt-4o for complex reasoning
   - Match model to task complexity

2. **File Management**
   - Remove old files regularly
   - Cache cleanup runs automatically every 24 hours
   - Monitor storage usage via health check

3. **Network Considerations**
   - File uploads require stable connection
   - Large files may take time to process
   - Check Point TE sandboxing adds processing time

---

## Troubleshooting

### Common Issues

**Chat Not Responding:**
- Check OpenAI API key in Settings
- Verify key validation status (green dot)
- Check network connectivity

**Files Not Uploading:**
- Verify file size (max 50 MB)
- Check file format (PDF, TXT, MD, JSON, CSV, DOCX)
- Ensure stable internet connection

**Security Scans Not Working:**
- Verify Lakera API key is configured
- Check Project ID is correct
- Ensure toggles are enabled on Chat/Files pages

**Files Disappearing:**
- Cache cleanup runs every 24 hours
- Files are automatically cleared after 24 hours
- Check `/api/health/cache` for cleanup schedule

### Getting Help

- Check the **Dashboard** for error logs
- Review **Risk Map** for security insights
- Verify API key status in **Settings**
- Check health endpoints for system status

---

## Version Information

**Current Version:** 1.0.5

**Recent Enhancements:**
- ✅ Persistent file storage (files survive server restarts)
- ✅ Multiple file upload (up to 5 files simultaneously)
- ✅ Lakera Guard API v2 compliance
- ✅ Automatic cache cleanup (24-hour interval)
- ✅ Enhanced security scanning
- ✅ Improved file management

**Version Display:**
- Check the bottom left of the sidebar for the current version
- Version is also shown in the footer

---

## Additional Resources

- **API Documentation**: See `/api/health` endpoints for system status
- **Security Best Practices**: Review the Risk Map for OWASP Top 10 guidance
- **Configuration**: Settings page for all API key management
- **Monitoring**: Dashboard for usage analytics and logs

---

**Need Help?** Check the Dashboard for logs, review the Risk Map for security insights, or verify your Settings configuration.

**Last Updated:** Version 1.0.5 - January 2026
