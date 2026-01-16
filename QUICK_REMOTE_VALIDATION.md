# Quick Remote VM Validation - v1.0.11

**Quick Reference**: Curl commands for validating Secure AI Chat on remote VM via public IP

---

## 🚀 Quick Start

Replace `YOUR_VM_PUBLIC_IP` with your actual VM IP address.

```bash
# Set your VM IP
export VM_IP="YOUR_VM_PUBLIC_IP"

# Or use domain name
export VM_IP="your-domain.com"
```

---

## ✅ Essential Validation Commands

### 1. Check if Server is Running
```bash
curl http://$VM_IP:3000/api/health
```
**Expected**: `{"status":"ok"}`

### 2. Verify Version
```bash
curl http://$VM_IP:3000/api/version
```
**Expected**: `{"version":"1.0.11"}`

### 3. Check WAF Integration
```bash
curl http://$VM_IP:3000/api/waf/health
```
**Expected**: `{"waf":{"integrated":true}}`

### 4. Check API Keys Status
```bash
curl http://$VM_IP:3000/api/keys
```

### 5. Get Recent Errors
```bash
curl "http://$VM_IP:3000/api/logs/system?level=error&limit=10"
```

---

## 📊 Generate Complete Logs Report

### Automated Script
```bash
# Download and run validation script
./scripts/validate-remote-vm.sh $VM_IP

# Generate comprehensive logs
./scripts/generate-remote-logs.sh $VM_IP
```

### Manual Logs Export
```bash
# Export all logs to files
mkdir -p remote-logs
curl -s http://$VM_IP:3000/api/health > remote-logs/health.json
curl -s http://$VM_IP:3000/api/version > remote-logs/version.json
curl -s http://$VM_IP:3000/api/waf/health > remote-logs/waf-health.json
curl -s "http://$VM_IP:3000/api/logs/system?limit=100" > remote-logs/system-logs.json
curl -s "http://$VM_IP:3000/api/logs/system?level=error&limit=50" > remote-logs/errors.json
curl -s "http://$VM_IP:3000/api/waf/logs?limit=100" > remote-logs/waf-logs.json

# Export WAF logs as CSV
curl -X POST http://$VM_IP:3000/api/waf/logs \
  -H "Content-Type: application/json" \
  -d '{"format":"csv","limit":1000}' > remote-logs/waf-logs.csv
```

---

## 🔧 Environment Fix Commands

### Check Configuration Status
```bash
# See which keys are from environment vs storage
curl http://$VM_IP:3000/api/keys | jq '.source'
```

### Validate Azure OpenAI
```bash
curl -X POST http://$VM_IP:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_KEY",
    "endpoint": "https://your-resource.openai.azure.com",
    "deploymentName": "gpt-4o-mini"
  }'
```

---

## 🚨 Troubleshooting

### Connection Refused
```bash
# Check if port is accessible
telnet $VM_IP 3000
# or
nc -zv $VM_IP 3000
```

### Timeout Issues
```bash
# Increase timeout
curl --connect-timeout 30 --max-time 60 \
  http://$VM_IP:3000/api/health
```

---

## 📝 One-Liner Diagnostic

```bash
VM_IP="YOUR_VM_PUBLIC_IP" && \
echo "Health: $(curl -s http://$VM_IP:3000/api/health | jq -r '.status')" && \
echo "Version: $(curl -s http://$VM_IP:3000/api/version | jq -r '.version')" && \
echo "WAF: $(curl -s http://$VM_IP:3000/api/waf/health | jq -r '.waf.integrated')" && \
echo "Errors: $(curl -s "http://$VM_IP:3000/api/logs/system?level=error&limit=5" | jq 'length')"
```

---

**For complete guide**: See `REMOTE_VM_VALIDATION_GUIDE.md`
