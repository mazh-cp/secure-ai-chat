# Azure API Management (APIM) Gateway Endpoint Support

**Version**: 1.0.11  
**Date**: January 16, 2026  
**Feature**: Support for Azure API Management gateway endpoints

---

## 🎯 Overview

The application now supports both:
1. **Standard Azure OpenAI endpoints**: `https://resource.openai.azure.com`
2. **Azure API Management (APIM) gateway endpoints**: `https://gateway.azure-api.net/path/`

---

## 📋 Supported Endpoint Formats

### Standard Azure OpenAI Endpoint
```
https://your-resource.openai.azure.com
```

**Constructed URL:**
```
https://your-resource.openai.azure.com/openai/deployments/{model}/chat/completions?api-version=2025-04-01-preview
```

### Azure API Management (APIM) Gateway Endpoint
```
https://staging-openai.azure-api.net/openai-gw-proxy-dev/
```

**Constructed URL:**
```
https://staging-openai.azure-api.net/openai-gw-proxy-dev/openai/deployments/{model}/chat/completions?api-version=2025-04-01-preview
```

---

## 🔧 How It Works

The application automatically detects APIM gateway endpoints by checking:
- If the endpoint contains `azure-api.net`
- If the endpoint has a path component (more than 3 segments when split by `/`)

### Detection Logic

```typescript
const isApimGateway = baseEndpoint.includes('azure-api.net') && baseEndpoint.split('/').length > 3
```

### Endpoint Construction

Both endpoint types use the same path structure:
- `/openai/deployments/{model}/chat/completions?api-version=2025-04-01-preview`

The difference is:
- **Standard**: Base URL is just the domain
- **APIM**: Base URL includes the gateway path

---

## ✅ Configuration

### Using APIM Gateway Endpoint

1. **In Settings Page:**
   - Navigate to Settings
   - Enter Azure OpenAI Endpoint: `https://staging-openai.azure-api.net/openai-gw-proxy-dev/`
   - Enter Azure OpenAI API Key
   - Click "Validate Azure OpenAI Credentials"

2. **Via Environment Variable:**
   ```bash
   AZURE_OPENAI_ENDPOINT=https://staging-openai.azure-api.net/openai-gw-proxy-dev/
   AZURE_OPENAI_KEY=your-api-key
   ```

3. **Via API Keys Storage:**
   - Use the Settings page to save the endpoint
   - Endpoint is stored securely server-side

---

## 🔍 Validation

The validation endpoint (`/api/health/azure-openai`) supports both formats:

### Test Standard Endpoint
```bash
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "your-key",
    "endpoint": "https://your-resource.openai.azure.com",
    "deploymentName": "gpt-4o-mini"
  }'
```

### Test APIM Gateway Endpoint
```bash
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "your-key",
    "endpoint": "https://staging-openai.azure-api.net/openai-gw-proxy-dev/",
    "deploymentName": "gpt-4o-mini"
  }'
```

---

## 📝 Examples

### Example 1: Standard Azure OpenAI
**Endpoint:** `https://myresource.openai.azure.com`

**Full URL:**
```
https://myresource.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2025-04-01-preview
```

### Example 2: APIM Gateway (Staging)
**Endpoint:** `https://staging-openai.azure-api.net/openai-gw-proxy-dev/`

**Full URL:**
```
https://staging-openai.azure-api.net/openai-gw-proxy-dev/openai/deployments/gpt-4o-mini/chat/completions?api-version=2025-04-01-preview
```

### Example 3: APIM Gateway (Production)
**Endpoint:** `https://prod-openai.azure-api.net/openai-gw-proxy/`

**Full URL:**
```
https://prod-openai.azure-api.net/openai-gw-proxy/openai/deployments/gpt-4o-mini/chat/completions?api-version=2025-04-01-preview
```

---

## 🛠️ Troubleshooting

### Issue: Endpoint Not Recognized as APIM

**Check:**
- Endpoint contains `azure-api.net`
- Endpoint has a path component (e.g., `/openai-gw-proxy-dev/`)
- No trailing slash issues

**Solution:**
- Ensure endpoint format: `https://gateway.azure-api.net/path/`
- Include the full path in the endpoint URL

### Issue: 404 Not Found

**Possible causes:**
- Path structure is incorrect
- Deployment name doesn't match
- APIM gateway routing not configured

**Solution:**
1. Verify endpoint URL in Azure Portal/APIM
2. Check APIM gateway routing configuration
3. Ensure deployment name matches exactly

### Issue: Authentication Failed

**Possible causes:**
- API key format is different for APIM
- APIM subscription key required instead

**Solution:**
- Verify API key format for APIM gateway
- Check if APIM requires subscription key header
- Consult APIM gateway documentation

---

## 🔐 Security Notes

### API Key Storage
- API keys are stored securely server-side
- Never expose keys in client-side code
- Use environment variables for production

### Endpoint Validation
- Endpoint URLs are validated before use
- Must start with `http://` or `https://`
- APIM endpoints are automatically detected

---

## 📊 Supported Features

Both endpoint types support:
- ✅ Chat completions
- ✅ Deployment validation
- ✅ Health checks
- ✅ Error handling
- ✅ Timeout management
- ✅ Automatic retry logic

---

## 🎯 Best Practices

### Endpoint Configuration
1. **Use HTTPS**: Always use HTTPS for endpoints
2. **Include Full Path**: For APIM, include the complete gateway path
3. **No Trailing Slash**: Trailing slashes are automatically handled
4. **Validate First**: Use validation endpoint before using in chat

### APIM Gateway Setup
1. **Configure Routing**: Ensure APIM gateway routes to Azure OpenAI
2. **Set Policies**: Configure APIM policies for rate limiting, etc.
3. **Test Endpoint**: Test the endpoint URL before configuring
4. **Monitor Usage**: Use APIM analytics to monitor usage

---

## 📞 Support

If you encounter issues with APIM gateway endpoints:

1. **Verify Endpoint Format**: Check endpoint URL matches expected format
2. **Test Connectivity**: Use curl to test endpoint directly
3. **Check APIM Configuration**: Verify APIM gateway routing
4. **Review Logs**: Check application logs for detailed errors

---

**Feature Version**: 1.0.11  
**Last Updated**: January 16, 2026
