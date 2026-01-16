# Quick Install Fix for v1.0.11

## 🚀 Quick Fix Commands

### Install v1.0.11 on Remote VM

```bash
# Recommended: Install specific version
TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

### If Installation Fails

```bash
# 1. Manual clone and checkout
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat
git checkout v1.0.11

# 2. Install Node.js v25.2.1
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 25.2.1
nvm use 25.2.1

# 3. Install dependencies
npm install

# 4. Build
npm run build

# 5. Configure
cp .env.example .env.local
nano .env.local  # Add API keys

# 6. Start
npm start
```

### Fix npm ci Errors

```bash
cd secure-ai-chat
rm -rf node_modules package-lock.json
npm install
npm run build
```

## ✅ Verify Installation

```bash
curl http://localhost:3000/api/version
# Should return: {"version":"1.0.11"}
```

---

**For detailed troubleshooting**: See [INSTALLATION_FIX_v1.0.11.md](./INSTALLATION_FIX_v1.0.11.md)
