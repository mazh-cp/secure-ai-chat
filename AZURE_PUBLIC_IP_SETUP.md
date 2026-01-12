# Azure Public IP Setup Guide

**Purpose:** Configure Azure VM to allow public access to Secure AI Chat application

## 🌐 Azure Networking Configuration

### Step 1: Configure Network Security Group (NSG)

1. **Go to Azure Portal**
   - Navigate to your VM
   - Click on **Networking** in the left menu

2. **Add Inbound Port Rule**
   - Click **Add inbound port rule**
   - Configure:
     - **Name:** `secure-ai-chat-http`
     - **Priority:** `1000` (or any available priority)
     - **Source:** `Any` (or specific IP ranges)
     - **Source port ranges:** `*`
     - **Destination:** `Any`
     - **Destination port ranges:** `3000`
     - **Protocol:** `TCP`
     - **Action:** `Allow`
     - **Description:** `Allow HTTP access to Secure AI Chat`

3. **Save the rule**

### Step 2: Verify Public IP

1. **Check Public IP Address**
   - Go to your VM in Azure Portal
   - Click on **Networking**
   - Note the **Public IP address** (or check **Overview** page)

2. **Test Access**
   ```bash
   # From your local machine
   curl http://YOUR_PUBLIC_IP:3000/api/health
   ```

### Step 3: Configure Application Firewall (UFW)

The installation script should have configured UFW, but verify:

```bash
# Check UFW status
sudo ufw status

# Should show port 3000 allowed
# If not, add it:
sudo ufw allow 3000/tcp
sudo ufw reload
```

### Step 4: Verify Network Binding

```bash
# Check if application is listening on 0.0.0.0:3000
sudo ss -tlnp | grep :3000

# Should show: 0.0.0.0:3000 (NOT 127.0.0.1:3000)
```

If it shows `127.0.0.1:3000`, run:

```bash
sudo bash scripts/fix-public-access.sh
```

## 🔧 Complete Azure Setup Procedure

### Option 1: Using Azure Portal

1. **VM → Networking → Add inbound port rule**
   - Port: `3000`
   - Protocol: `TCP`
   - Action: `Allow`

2. **Verify Public IP**
   - VM → Overview → Public IP address

3. **Test Access**
   - `http://YOUR_PUBLIC_IP:3000`

### Option 2: Using Azure CLI

```bash
# Get resource group and VM name
RESOURCE_GROUP="your-resource-group"
VM_NAME="your-vm-name"
NSG_NAME="your-nsg-name"  # Usually: vm-name-nsg

# Add inbound rule
az network nsg rule create \
  --resource-group $RESOURCE_GROUP \
  --nsg-name $NSG_NAME \
  --name secure-ai-chat-http \
  --priority 1000 \
  --protocol Tcp \
  --destination-port-ranges 3000 \
  --access Allow \
  --direction Inbound

# Get public IP
az vm show -d -g $RESOURCE_GROUP -n $VM_NAME --query publicIps -o tsv
```

## 🚨 Troubleshooting

### Issue: Cannot access from public IP

**Check 1: NSG Rules**
- Azure Portal → VM → Networking
- Verify inbound rule for port 3000 exists
- Check rule priority (lower number = higher priority)
- Ensure rule is enabled

**Check 2: Application Binding**
```bash
sudo ss -tlnp | grep :3000
# Should show: 0.0.0.0:3000
```

**Check 3: UFW Firewall**
```bash
sudo ufw status
# Should show: 3000/tcp ALLOW
```

**Check 4: Service Status**
```bash
sudo systemctl status secure-ai-chat
```

**Check 5: Application Logs**
```bash
sudo journalctl -u secure-ai-chat -n 50 --no-pager
```

### Issue: Application only accessible locally

**Fix:**
```bash
# Run diagnostic script
sudo bash scripts/fix-public-access.sh

# Or manually:
# 1. Check .env file has HOSTNAME=0.0.0.0
# 2. Check systemd service has Environment=HOSTNAME=0.0.0.0
# 3. Restart service
sudo systemctl restart secure-ai-chat
```

### Issue: NSG rule not working

**Possible causes:**
1. **Rule priority conflict** - Another rule with higher priority (lower number) is blocking
2. **Rule disabled** - Check if rule is enabled in NSG
3. **Wrong NSG** - Ensure NSG is attached to VM's network interface
4. **Application not running** - Check service status

**Fix:**
```bash
# Check NSG rules priority
az network nsg rule list --resource-group $RESOURCE_GROUP --nsg-name $NSG_NAME --query "[].{Name:name,Priority:priority,Access:access,Port:destinationPortRange}" -o table

# Delete conflicting rule or adjust priority
```

## 📋 Verification Checklist

After setup, verify:

- [ ] NSG inbound rule for port 3000 exists and is enabled
- [ ] Application is listening on `0.0.0.0:3000` (not `127.0.0.1:3000`)
- [ ] UFW allows port 3000 (if UFW is enabled)
- [ ] Service is running (`systemctl status secure-ai-chat`)
- [ ] Health endpoint responds locally (`curl http://localhost:3000/api/health`)
- [ ] Health endpoint responds from public IP (`curl http://YOUR_PUBLIC_IP:3000/api/health`)

## 🔗 Related Documentation

- `FRESH_VM_INSTALL.md` - Complete installation guide
- `PUBLIC_ACCESS_FIX.md` - Troubleshooting public access issues
- `scripts/fix-public-access.sh` - Diagnostic and fix script

## ⚠️ Security Notes

1. **Consider restricting source IPs** in NSG rule instead of "Any"
2. **Use HTTPS** in production (configure reverse proxy with SSL)
3. **Keep Azure VM updated** with security patches
4. **Monitor NSG logs** for suspicious activity
5. **Use Azure Key Vault** for storing API keys in production

---

**Last Updated:** January 12, 2026  
**Status:** ✅ Ready for Azure Deployment
