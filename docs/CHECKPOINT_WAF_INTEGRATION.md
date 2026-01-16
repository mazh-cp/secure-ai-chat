# Check Point WAF Integration Guide

This document describes how to integrate the Secure AI Chat application behind Check Point Web Application Firewall (WAF) as a reverse proxy.

## Overview

The application is designed to work seamlessly behind Check Point WAF, providing:
- **Request/Response Logging**: All API calls are logged with metadata for WAF monitoring
- **Security Event Tracking**: Security blocks and threat detections are logged
- **Log Access API**: Check Point WAF can read logs via REST API
- **Reverse Proxy Support**: Proper handling of Check Point WAF headers

## Architecture

```
Internet → Check Point WAF → Reverse Proxy (nginx) → Secure AI Chat Application
                              ↓
                         Logs API (/api/waf/logs)
                              ↓
                         Check Point WAF Monitoring
```

## Prerequisites

1. Check Point WAF installed and configured
2. Application running behind Check Point WAF as reverse proxy
3. Network connectivity between Check Point WAF and application server

## Configuration

### 1. Environment Variables

Add these optional environment variables to `.env.local`:

```bash
# Check Point WAF Integration
WAF_AUTH_ENABLED=false          # Enable authentication for WAF log access (recommended: true)
WAF_API_KEY=your-secure-api-key # API key for WAF log access (if auth enabled)
```

### 2. Check Point WAF Configuration

#### Reverse Proxy Setup

Configure Check Point WAF to forward requests to your application:

1. **Backend Server Configuration**:
   - Protocol: HTTP/HTTPS
   - Host: Your application server hostname/IP
   - Port: Application port (default: 3000)
   - Health Check: `GET /api/health`

2. **Header Handling**:
   - Forward original client IP: `X-Forwarded-For`, `X-Real-IP`
   - Check Point WAF may set custom headers like `X-CheckPoint-Client-IP`

#### Security Policies

Configure Check Point WAF security policies:

1. **API Protection**:
   - Protect `/api/*` endpoints
   - Allow health checks: `/api/health`, `/api/waf/health`

2. **Rate Limiting**:
   - Set appropriate rate limits for API endpoints
   - Consider higher limits for health checks

3. **Content Inspection**:
   - Enable content inspection for POST requests to `/api/chat`
   - Scan file uploads at `/api/scan`, `/api/te/upload`

### 3. Application Configuration

The application automatically:
- Detects Check Point WAF headers
- Logs all API requests with WAF metadata
- Handles reverse proxy IP forwarding
- Provides log access endpoints

## API Endpoints for Check Point WAF

### 1. Health Check

**Endpoint**: `GET /api/waf/health`

Check application status and WAF integration health.

**Authentication**: Optional (if `WAF_AUTH_ENABLED=true`)

**Response**:
```json
{
  "status": "ok",
  "service": "secure-ai-chat",
  "waf": {
    "integrated": true,
    "logsEndpoint": "/api/waf/logs",
    "healthEndpoint": "/api/waf/health",
    "authentication": "enabled"
  },
  "statistics": {
    "total": 1234,
    "last24Hours": 456,
    "blocked": 12,
    "threats": 5,
    "errors": 2,
    "warnings": 8
  },
  "recentActivity": [...],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Logs Access

**Endpoint**: `GET /api/waf/logs`

Retrieve API call logs and security events.

**Query Parameters**:
- `level`: Filter by log level (`info`, `warning`, `error`, `debug`)
- `service`: Filter by service name
- `startTime`: ISO timestamp - only return logs after this time
- `endTime`: ISO timestamp - only return logs before this time
- `clientIP`: Filter by client IP address
- `endpoint`: Filter by API endpoint path
- `blocked`: Filter by blocked requests (`true`/`false`)
- `threatDetected`: Filter by threat detection (`true`/`false`)
- `limit`: Maximum number of logs (default: 100, max: 1000)

**Authentication**: Optional (if `WAF_AUTH_ENABLED=true`)

**Example Request**:
```bash
curl -H "Authorization: Bearer your-api-key" \
  "https://your-app.com/api/waf/logs?level=error&blocked=true&limit=50"
```

**Response**:
```json
{
  "success": true,
  "count": 50,
  "filtered": {
    "level": "error",
    "blocked": true
  },
  "logs": [
    {
      "id": "log-id-123",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "level": "error",
      "service": "checkpoint-waf",
      "message": "API POST /api/chat",
      "metadata": {
        "waf": {
          "clientIP": "192.168.1.100",
          "userAgent": "Mozilla/5.0...",
          "blocked": true,
          "threatDetected": true
        }
      },
      "details": {
        "endpoint": "/api/chat",
        "method": "POST",
        "statusCode": 403,
        "duration": 145,
        "error": "Security block"
      }
    }
  ],
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### 3. Log Export

**Endpoint**: `POST /api/waf/logs`

Export logs in CSV or JSON format.

**Request Body**:
```json
{
  "format": "csv",  // or "json"
  "startTime": "2024-01-15T00:00:00.000Z",
  "endTime": "2024-01-15T23:59:59.999Z",
  "services": ["checkpoint-waf"],
  "includeDetails": true
}
```

**Response**: CSV file or JSON (based on format)

## Logging Structure

### Request Metadata

Each API request logs:
- **Method**: HTTP method (GET, POST, etc.)
- **Path**: API endpoint path
- **Query**: Query string parameters
- **Client IP**: Original client IP (from Check Point WAF headers)
- **User Agent**: Client user agent
- **Check Point Headers**: Check Point WAF-specific headers
- **Request Size**: Content-Length if available
- **Timestamp**: Request timestamp

### Response Metadata

Each API response logs:
- **Status Code**: HTTP status code
- **Response Size**: Response content length (if available)
- **Duration**: Request processing time (ms)
- **Threat Detected**: Whether security threat was detected
- **Blocked**: Whether request was blocked

### Security Events

Security events are logged when:
- **Input Scan Blocked**: User message flagged by Lakera Guard
- **Output Scan Blocked**: AI response flagged by security
- **File Scan Flagged**: Uploaded file contains threats
- **Check Point TE Detection**: File sandbox analysis detects malware

## Integration Examples

### Example 1: Check Point WAF Polling Logs

Set up Check Point WAF to poll for logs every 5 minutes:

```bash
# Cron job or scheduled task
*/5 * * * * curl -H "Authorization: Bearer your-api-key" \
  "https://your-app.com/api/waf/logs?limit=1000&startTime=$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ)" \
  -o /var/log/checkpoint-waf/app-logs.json
```

### Example 2: Real-time Monitoring

Use Check Point WAF to monitor blocked requests:

```bash
# Watch for blocked requests
watch -n 10 'curl -s -H "Authorization: Bearer your-api-key" \
  "https://your-app.com/api/waf/logs?blocked=true&limit=10" | jq ".logs"'
```

### Example 3: CSV Export for Analysis

Export logs to CSV for analysis:

```bash
curl -X POST -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"format":"csv","startTime":"2024-01-15T00:00:00Z","endTime":"2024-01-15T23:59:59Z"}' \
  "https://your-app.com/api/waf/logs" \
  -o waf-logs-2024-01-15.csv
```

## Security Considerations

### 1. Authentication

Enable authentication for WAF log access in production:

```bash
WAF_AUTH_ENABLED=true
WAF_API_KEY=<generate-secure-random-key>
```

### 2. Network Security

- Use HTTPS for all communication
- Restrict access to `/api/waf/*` endpoints to Check Point WAF IPs only
- Use firewall rules to limit access

### 3. Log Data

- Logs may contain sensitive information
- Ensure Check Point WAF connection is encrypted
- Consider log retention policies

### 4. Rate Limiting

The application has built-in rate limiting. Check Point WAF should also implement rate limiting to prevent abuse.

## Troubleshooting

### Issue: Check Point WAF cannot access logs

**Solution**:
1. Verify authentication is configured correctly
2. Check network connectivity between Check Point WAF and application
3. Verify firewall rules allow Check Point WAF IPs
4. Check application logs for errors

### Issue: Client IP shows as Check Point WAF IP

**Solution**:
- Verify Check Point WAF is forwarding original client IP in `X-Forwarded-For` or `X-Real-IP` headers
- Check middleware configuration

### Issue: Logs are empty

**Solution**:
1. Verify middleware is running (check `/api/waf/health`)
2. Check system logs are being written (verify `.secure-storage/system-logs.json`)
3. Ensure API routes are being accessed (middleware only logs `/api/*` routes)

## Best Practices

1. **Enable Authentication**: Always enable `WAF_AUTH_ENABLED` in production
2. **Use HTTPS**: Encrypt all communication between Check Point WAF and application
3. **Monitor Health**: Regularly check `/api/waf/health` endpoint
4. **Log Retention**: Implement log rotation to prevent disk space issues
5. **Filter Logs**: Use query parameters to filter logs on Check Point WAF side
6. **Rate Limit**: Set appropriate limits on log access endpoint

## Support

For issues or questions:
1. Check application logs: `/api/logs/system`
2. Verify Check Point WAF configuration
3. Review this documentation
4. Contact support with log excerpts and configuration details

## Related Documentation

- [API Documentation](./API.md)
- [Security Guide](./SECURITY.md)
- [Deployment Guide](./DEPLOYMENT.md)