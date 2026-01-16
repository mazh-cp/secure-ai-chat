# Quick Azure OpenAI Log Testing

## Fast Testing Commands

### 1. Test Validation Endpoint (Invalid Key)

```bash
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "invalid-key-123",
    "endpoint": "https://test.openai.azure.com",
    "deploymentName": "gpt-4o-mini"
  }' | jq .
```

### 2. Test Validation Endpoint (Invalid Endpoint)

```bash
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "valid-key-123456789012345678901234567890",
    "endpoint": "not-a-valid-url"
  }' | jq .
```

### 3. Test Chat Endpoint (Invalid Credentials)

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "model": "gpt-4o-mini",
    "provider": "azure",
    "apiKeys": {
      "azureOpenAiKey": "invalid-key",
      "azureOpenAiEndpoint": "https://test.openai.azure.com"
    }
  }' | jq .
```

### 4. View Server Logs (systemd)

```bash
# Real-time
sudo journalctl -u secure-ai-chat -f

# Last 50 lines
sudo journalctl -u secure-ai-chat -n 50

# Filter Azure errors
sudo journalctl -u secure-ai-chat | grep -i "azure"
```

### 5. Run Automated Test Suite

```bash
./scripts/test-azure-openai-errors.sh
```

## Expected Error Responses

### Invalid API Key
```json
{
  "ok": false,
  "error": "Azure OpenAI authentication failed. Please verify your API key is correct."
}
```

### Invalid Endpoint
```json
{
  "ok": false,
  "error": "Invalid endpoint URL. Must start with http:// or https://"
}
```

### Deployment Not Found
```json
{
  "ok": false,
  "error": "Deployment \"X\" not found. Please verify the deployment name matches exactly..."
}
```

### Network Error
```json
{
  "ok": false,
  "error": "Cannot connect to Azure OpenAI endpoint. Please verify: 1) Endpoint URL..."
}
```

## Log Locations

- **Server Console:** `npm start` output or `sudo journalctl -u secure-ai-chat`
- **Browser Console:** F12 → Console tab
- **API Responses:** Direct curl output or saved JSON files
- **Test Script Logs:** `./azure-openai-test-logs/`
