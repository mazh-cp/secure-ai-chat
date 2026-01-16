#!/bin/bash
# Generate Comprehensive Logs Report from Remote VM
# Usage: ./generate-remote-logs.sh <VM_PUBLIC_IP> [PORT] [OUTPUT_DIR]

if [ -z "$1" ]; then
  echo "Usage: $0 <VM_PUBLIC_IP> [PORT] [OUTPUT_DIR]"
  echo "Example: $0 203.0.113.45"
  echo "Example: $0 203.0.113.45 3000 ./logs"
  exit 1
fi

VM_IP="$1"
PORT="${2:-3000}"
OUTPUT_DIR="${3:-./remote-logs-$(date +%Y%m%d-%H%M%S)}"
BASE_URL="http://$VM_IP:$PORT"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)

echo "=========================================="
echo "Generating Remote VM Logs Report"
echo "VM IP: $VM_IP"
echo "Port: $PORT"
echo "Output Directory: $OUTPUT_DIR"
echo "=========================================="
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to fetch and save
fetch_and_save() {
  local name="$1"
  local url="$2"
  local filename="$3"
  
  echo "Fetching $name..."
  response=$(curl -s --connect-timeout 10 --max-time 30 "$url" 2>/dev/null)
  
  if [ $? -eq 0 ] && [ -n "$response" ]; then
    echo "$response" > "$OUTPUT_DIR/$filename"
    echo "  ✅ Saved to $filename"
  else
    echo "  ❌ Failed to fetch $name"
    echo "Connection failed or timeout" > "$OUTPUT_DIR/$filename.error"
  fi
}

# 1. Health and Status
fetch_and_save "Health Check" "$BASE_URL/api/health" "01-health.json"
fetch_and_save "Version" "$BASE_URL/api/version" "02-version.json"
fetch_and_save "WAF Health" "$BASE_URL/api/waf/health" "03-waf-health.json"

# 2. Configuration
fetch_and_save "API Keys Status" "$BASE_URL/api/keys" "04-api-keys.json"
fetch_and_save "Settings Status" "$BASE_URL/api/settings/status" "05-settings-status.json"
fetch_and_save "Cache Status" "$BASE_URL/api/health/cache" "06-cache-status.json"

# 3. Logs
fetch_and_save "System Logs (Last 100)" "$BASE_URL/api/logs/system?limit=100" "07-system-logs.json"
fetch_and_save "System Errors (Last 50)" "$BASE_URL/api/logs/system?level=error&limit=50" "08-system-errors.json"
fetch_and_save "System Warnings (Last 50)" "$BASE_URL/api/logs/system?level=warning&limit=50" "09-system-warnings.json"

# 4. WAF Logs
fetch_and_save "WAF Logs (Last 100)" "$BASE_URL/api/waf/logs?limit=100" "10-waf-logs.json"
fetch_and_save "WAF Blocked Requests" "$BASE_URL/api/waf/logs?blocked=true&limit=50" "11-waf-blocked.json"
fetch_and_save "WAF Threats" "$BASE_URL/api/waf/logs?threatDetected=true&limit=50" "12-waf-threats.json"

# 5. Export WAF Logs as CSV
echo "Exporting WAF logs as CSV..."
curl -s -X POST "$BASE_URL/api/waf/logs" \
  -H "Content-Type: application/json" \
  -d '{"format":"csv","limit":1000}' \
  --connect-timeout 10 --max-time 30 \
  > "$OUTPUT_DIR/13-waf-logs.csv" 2>/dev/null

if [ -s "$OUTPUT_DIR/13-waf-logs.csv" ]; then
  echo "  ✅ Saved to 13-waf-logs.csv"
else
  echo "  ❌ Failed to export CSV"
fi

# 6. Files
fetch_and_save "Files List" "$BASE_URL/api/files/list" "14-files-list.json"

# 7. Release Notes
fetch_and_save "Release Notes" "$BASE_URL/api/release-notes" "15-release-notes.json"

# 8. Generate Summary Report
echo ""
echo "Generating summary report..."
{
  echo "=========================================="
  echo "Remote VM Logs Report"
  echo "Generated: $(date)"
  echo "VM IP: $VM_IP"
  echo "Port: $PORT"
  echo "=========================================="
  echo ""
  
  echo "=== Health Status ==="
  if [ -f "$OUTPUT_DIR/01-health.json" ]; then
    cat "$OUTPUT_DIR/01-health.json" | jq '.' 2>/dev/null || cat "$OUTPUT_DIR/01-health.json"
  fi
  echo ""
  
  echo "=== Version ==="
  if [ -f "$OUTPUT_DIR/02-version.json" ]; then
    cat "$OUTPUT_DIR/02-version.json" | jq '.' 2>/dev/null || cat "$OUTPUT_DIR/02-version.json"
  fi
  echo ""
  
  echo "=== WAF Status ==="
  if [ -f "$OUTPUT_DIR/03-waf-health.json" ]; then
    cat "$OUTPUT_DIR/03-waf-health.json" | jq '.waf, .statistics' 2>/dev/null || cat "$OUTPUT_DIR/03-waf-health.json"
  fi
  echo ""
  
  echo "=== API Keys Configuration ==="
  if [ -f "$OUTPUT_DIR/04-api-keys.json" ]; then
    cat "$OUTPUT_DIR/04-api-keys.json" | jq '.configured' 2>/dev/null || cat "$OUTPUT_DIR/04-api-keys.json"
  fi
  echo ""
  
  echo "=== Error Summary ==="
  if [ -f "$OUTPUT_DIR/08-system-errors.json" ]; then
    error_count=$(cat "$OUTPUT_DIR/08-system-errors.json" | jq 'length' 2>/dev/null || echo "0")
    echo "Total errors: $error_count"
    if [ "$error_count" -gt 0 ]; then
      echo ""
      echo "Recent errors:"
      cat "$OUTPUT_DIR/08-system-errors.json" | jq '.[0:5] | .[] | {timestamp, service, message}' 2>/dev/null || echo "Unable to parse"
    fi
  fi
  echo ""
  
  echo "=== WAF Statistics ==="
  if [ -f "$OUTPUT_DIR/03-waf-health.json" ]; then
    cat "$OUTPUT_DIR/03-waf-health.json" | jq '.statistics' 2>/dev/null || echo "Unable to parse"
  fi
  echo ""
  
  echo "=== Files ==="
  if [ -f "$OUTPUT_DIR/14-files-list.json" ]; then
    file_count=$(cat "$OUTPUT_DIR/14-files-list.json" | jq 'length' 2>/dev/null || echo "0")
    echo "Total files: $file_count"
  fi
  echo ""
  
  echo "=========================================="
  echo "Report Complete"
  echo "All logs saved to: $OUTPUT_DIR"
  echo "=========================================="
  
} > "$OUTPUT_DIR/00-SUMMARY.txt"

echo ""
echo "=========================================="
echo "Logs Generation Complete"
echo "=========================================="
echo "Output Directory: $OUTPUT_DIR"
echo ""
echo "Files Generated:"
ls -lh "$OUTPUT_DIR" | tail -n +2 | awk '{print "  " $9 " (" $5 ")"}'
echo ""
echo "Summary Report: $OUTPUT_DIR/00-SUMMARY.txt"
echo ""
