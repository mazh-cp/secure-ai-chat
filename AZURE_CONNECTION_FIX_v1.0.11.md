# Azure OpenAI Connection Fix for v1.0.11

**Version**: 1.0.11  
**Date**: January 16, 2026  
**Issue**: "fetch failed" error when using Azure OpenAI provider

---

## 🔍 Problem Summary

When using Azure OpenAI provider, the application throws:
```
Error: Failed to connect to Azure OpenAI API. Please verify: fetch failed 1) Your endpoint URL is correct...
```

This indicates a network-level connection failure before the request reaches Azure OpenAI.

---

## ✅ Fixes Applied

### 1. Enhanced Network Error Handling

Added comprehensive error handling for:
- **Timeout errors**: 30-second timeout with clear messages
- **DNS failures**: Specific error for hostname resolution issues
- **Connection refused**: Clear message for connection problems
- **SSL/TLS errors**: Certificate validation errors
- **Generic fetch errors**: Better error messages

### 2. Request Timeout

Added 30-second timeout to prevent hanging requests:
- Uses `AbortController` for proper timeout handling
- Clear timeout error messages
- Prevents indefinite waiting

### 3. Better Error Diagnostics

Error messages now include:
- Specific error type (timeout, DNS, connection, etc.)
- Troubleshooting steps for each error type
- Endpoint URL validation guidance

---

## 🔧 Common Issues and Solutions

### Issue 1: "Request timeout (30 seconds)"

**Possible causes:**
- Azure OpenAI service is slow or overloaded
- Network latency is high
- Endpoint is incorrect

**Solutions:**
```bash
# 1. Test endpoint connectivity
curl -v https://your-resource.openai.azure.com

# 2. Check network latency
ping your-resource.openai.azure.com

# 3. Verify endpoint URL format
# Should be: https://your-resource.openai.azure.com
# NOT: https://your-resource.openai.azure.com/openai/deployments
```

### Issue 2: "DNS resolution failed"

**Possible causes:**
- Endpoint hostname is incorrect
- DNS server issues
- Network configuration problems

**Solutions:**
```bash
# 1. Test DNS resolution
nslookup your-resource.openai.azure.com

# 2. Verify endpoint URL in Azure Portal
# Go to: Azure Portal > Your Resource > Keys and Endpoint
# Copy the exact endpoint URL

# 3. Check DNS configuration
cat /etc/resolv.conf
```

### Issue 3: "Connection refused"

**Possible causes:**
- Endpoint URL is incorrect
- Port is blocked
- Service is not available

**Solutions:**
```bash
# 1. Test HTTPS connection
curl -I https://your-resource.openai.azure.com

# 2. Check firewall rules
sudo ufw status
# Ensure outbound HTTPS (port 443) is allowed

# 3. Verify endpoint in Azure Portal
```

### Issue 4: "Network connection failed"

**Possible causes:**
- Firewall blocking outbound connections
- Network configuration issues
- Proxy settings required

**Solutions:**
```bash
# 1. Test outbound HTTPS
curl -I https://api.openai.com
# If this works, test Azure endpoint
curl -I https://your-resource.openai.azure.com

# 2. Check firewall
sudo ufw status
sudo iptables -L OUTPUT

# 3. Check proxy settings (if behind corporate proxy)
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

---

## 📋 Endpoint URL Format

### ✅ Correct Format
```
https://your-resource.openai.azure.com
```

### ❌ Incorrect Formats
```
https://your-resource.openai.azure.com/openai/deployments  # Too specific
http://your-resource.openai.azure.com                      # Must be HTTPS
your-resource.openai.azure.com                             # Missing protocol
```

### Getting Correct Endpoint

1. Go to **Azure Portal**
2. Navigate to your **Azure OpenAI resource**
3. Go to **Keys and Endpoint** section
4. Copy the **Endpoint** value (should end with `.openai.azure.com`)
5. Use this exact value (without trailing slash or paths)

---

## 🔍 Debugging Steps

### 1. Verify Endpoint URL

```bash
# Test endpoint accessibility
curl -v https://your-resource.openai.azure.com

# Expected: Should return HTTP response (even if 404/401)
# If connection fails, check network/firewall
```

### 2. Test with API Key

```bash
# Test with actual API call
curl -X GET \
  "https://your-resource.openai.azure.com/openai/deployments?api-version=2025-04-01-preview" \
  -H "api-key: YOUR_API_KEY"

# Expected: Should return deployment list or error with status code
# If "fetch failed", it's a network issue
```

### 3. Check Application Logs

```bash
# View application logs
sudo journalctl -u secure-ai-chat -f

# Look for:
# - "Azure OpenAI request:" log entries
# - Error messages with endpoint details
# - Network error details
```

### 4. Network Diagnostics

```bash
# Test DNS
nslookup your-resource.openai.azure.com

# Test connectivity
ping -c 4 your-resource.openai.azure.com

# Test HTTPS
openssl s_client -connect your-resource.openai.azure.com:443 -showcerts

# Check routing
traceroute your-resource.openai.azure.com
```

---

## 🛠️ Manual Testing

### Test Azure OpenAI Connection

```bash
# From the server, test the endpoint
curl -X POST \
  "https://your-resource.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2025-04-01-preview" \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "test"}],
    "max_tokens": 5
  }'
```

**Expected results:**
- **Success**: Returns JSON with chat completion
- **401**: Authentication error (check API key)
- **404**: Deployment not found (check deployment name)
- **Connection error**: Network/firewall issue

---

## 📝 Configuration Checklist

Before using Azure OpenAI, verify:

- [ ] **Endpoint URL** is correct (from Azure Portal)
- [ ] **API Key** is valid and not expired
- [ ] **Deployment name** matches exactly (case-sensitive)
- [ ] **Network** allows outbound HTTPS (port 443)
- [ ] **DNS** can resolve the endpoint hostname
- [ ] **Firewall** allows connections to Azure
- [ ] **Endpoint format** is correct (https://resource.openai.azure.com)

---

## 🔄 Retry Logic

The application now includes:
- **30-second timeout** to prevent hanging
- **Clear error messages** for each failure type
- **Automatic cleanup** of timeouts

If you see timeout errors:
1. Check Azure OpenAI service status
2. Verify network connectivity
3. Try again (may be temporary)

---

## 🎯 Best Practices

### Endpoint Configuration
1. Always copy endpoint from Azure Portal
2. Don't add paths (like `/openai/deployments`)
3. Use HTTPS (never HTTP)
4. Remove trailing slashes

### Network Configuration
1. Ensure outbound HTTPS is allowed
2. Check DNS resolution works
3. Verify no proxy blocking Azure
4. Test connectivity before configuring

### Deployment Names
1. Use exact name from Azure Portal (case-sensitive)
2. Common names: `gpt-4o-mini`, `gpt-4o`, `gpt-4`
3. Verify deployment status is "Succeeded"

---

## 📞 Support

If connection still fails after these fixes:

1. **Check error message** - It now provides specific guidance
2. **Test connectivity** - Use curl commands above
3. **Verify Azure Portal** - Ensure resource and deployment are correct
4. **Check network** - Verify firewall and DNS settings
5. **Review logs** - Check application logs for detailed errors

---

**Fix Version**: 1.0.11  
**Last Updated**: January 16, 2026
