# Secure AI Chat

[![CI](https://github.com/your-username/Secure-Ai-Chat/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/Secure-Ai-Chat/actions/workflows/ci.yml)

A modern, secure AI chat application built with Next.js, TypeScript, and a focus on privacy and security. This application provides end-to-end encryption capabilities and security best practices for AI conversations.

## Features

- 🔒 **Security First**: Built with security headers and best practices
- 💬 **Real-time Chat Interface**: Clean, modern UI for AI conversations
- 🔐 **Encryption Ready**: Infrastructure for end-to-end message encryption
- 🎨 **Modern Design**: Beautiful UI with Tailwind CSS and light/dark theme support
- 🌓 **Theme System**: Semantic color tokens with automatic light/dark mode switching
- ⚡ **Next.js 14**: Built with the latest Next.js App Router
- 📱 **Responsive**: Works seamlessly on desktop and mobile devices
- 🛡️ **Type Safety**: Full TypeScript support
- 🔄 **Production Ready**: Auto-restart policies, health checks, error boundaries
- 🐳 **Docker Support**: Complete Docker and Docker Compose configuration
- ☸️ **Kubernetes Ready**: Deployment manifests with liveness/readiness probes
- 📋 **Release Notes**: Dedicated page for version history and changelog
- 🔍 **RAG (Retrieval Augmented Generation)**: Chat can access and answer questions about uploaded files
- 🛡️ **File Scanning**: Lakera AI and Checkpoint TE integration for file security
- 🔐 **Check Point WAF Integration**: Full support for Check Point WAF as reverse proxy with logging and monitoring

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Security**: Custom security headers, encryption utilities
- **Date Formatting**: date-fns

## Prerequisites

- Node.js v24.13.0 (LTS) (pinned via .nvmrc) for development
- npm, yarn, or pnpm
- **Note**: For production server installs on Ubuntu VM, Node.js v24.13.0 (LTS) is automatically installed/upgraded by the install script

## Installation

### Quick Install (Ubuntu VM)

For a fresh Ubuntu VM installation with nginx reverse proxy:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_public.sh | bash
```

**What it does:**
- Installs system dependencies (curl, git, build tools, nginx)
- Creates dedicated user (`secureai`)
- Installs/Upgrades Node.js to v24.13.0 (LTS) via nvm (automatically upgrades if different version detected)
- Clones repository to `/opt/secure-ai-chat`
- Installs dependencies and builds application
- Configures systemd service for auto-start
- Configures nginx reverse proxy on port 80
- Auto-detects free port starting from 3000 (avoids EADDRINUSE)
- Configures UFW firewall (SSH + Nginx)

**Post-installation:**
1. Add API keys: `sudo nano /opt/secure-ai-chat/.env.local`
2. Restart service: `sudo systemctl restart secure-ai-chat`
3. Access: `http://YOUR_VM_IP`

For detailed installation guide, see [docs/INSTALL_UBUNTU_VM.md](docs/INSTALL_UBUNTU_VM.md).

### Reset/Cleanup

To completely remove the installation:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/cleanup_reset_vm.sh | bash
```

Or to also remove the user:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/cleanup_reset_vm.sh | bash -s -- --remove-user
```

See [docs/INSTALL_UBUNTU_VM.md](docs/INSTALL_UBUNTU_VM.md) for more details.

### Upgrade Remote Installation

To safely upgrade your remote installation to the latest version (e.g. v1.0.14 — fixes file upload blank screen):

```bash
# Replace mazh-cp/secure-ai-chat with YOUR GitHub org/repo if you use a fork or different repo
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade_remote.sh | bash
```

**If you get 404:** The URL must match where your code lives. Use your actual repo (e.g. `https://raw.githubusercontent.com/YOUR_ORG/YOUR_REPO/main/scripts/upgrade_remote.sh`). If the repo is private, the raw URL may 404; use the **in-place upgrade** below instead (from the app directory on the server, which already has the code).

To upgrade using the in-place deploy script (on the server, no curl):

**Step 1 – Find your app directory** (if you don’t know it). On the VM run:

```bash
# Option A: from systemd (if the app runs as a service)
sudo grep WorkingDirectory /etc/systemd/system/secure-ai-chat.service 2>/dev/null || true

# Option B: search for the app
sudo find /home /opt /var/www -name "package.json" -path "*secure*" 2>/dev/null | head -5
# Use the directory that contains package.json (e.g. /home/ubuntu/secure-ai-chat).
```

**Step 2 – Run the upgrade** from that directory (replace `APP_DIR` with the path you found):

```bash
APP_DIR=/opt/secure-ai-chat   # ← use the path from Step 1
cd "$APP_DIR" || { echo "Directory $APP_DIR not found. Find it with the commands in Step 1."; exit 1; }
sudo bash scripts/deploy/upgrade.sh --app-dir "$APP_DIR" --ref v1.0.14
# Or pull latest from main:
sudo bash scripts/deploy/upgrade.sh --app-dir "$APP_DIR" --ref main
```

If `scripts/deploy/upgrade.sh` doesn’t exist in that directory, the app tree may be incomplete; clone the repo there or use the curl upgrade command with a valid repo URL instead.

The curl script automatically:
- Backs up all settings and API keys
- Pulls latest code
- Preserves all configurations
- Rebuilds and restarts the service

See [docs/UPGRADE_REMOTE.md](docs/UPGRADE_REMOTE.md) for detailed upgrade instructions.

### Single-Step Installation (Ubuntu/Debian)

⚠️ **Important**: Before using the remote installation script, ensure the repository is pushed to GitHub first:
```bash
./scripts/push-to-github.sh "Initial release"
```

**For fresh Ubuntu VM installation:**

```bash
# Option 1: Install v1.0.12 (recommended - Anthropic, RAG, local start)
TAG=v1.0.12 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash

# Option 2: Install latest from main branch
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash

# Option 3: Install by branch (e.g. restore-local-stability)
BRANCH=restore-local-stability curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash

# Option 4: Using wget with v1.0.12
TAG=v1.0.12 wget -qO- https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash

# Option 5: Local (if you have the script)
TAG=v1.0.12 bash scripts/install-ubuntu.sh
```

This script will automatically:
- Install system dependencies (curl, git, build tools)
- Install Node.js v24.13.0 (LTS) via nvm
- Clone the repository
- Install all npm dependencies
- Set up environment configuration
- Build the production application

**If the script doesn't start**: The repository may not be on GitHub yet. See [INSTALLATION_TROUBLESHOOTING.md](INSTALLATION_TROUBLESHOOTING.md) for solutions.

**New remote VM (v1.0.12):** See [docs/INSTALL_REMOTE_VM_v1.0.12.md](docs/INSTALL_REMOTE_VM_v1.0.12.md) for one-command install by tag or branch.

**After installation:**
1. Edit `.env.local` to add your API keys
2. Run `npm run dev` for development or `npm start` for production
3. Open the exact URL printed by the dev server (e.g. `http://localhost:3000`; if it shows 3001, use that). Using the wrong port causes cookie/origin mismatch and files will not persist.

### Quick Setup (Manual - Unix/Linux/macOS)

**Unix/Linux/macOS:**
```bash
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat
chmod +x scripts/setup.sh
./scripts/setup.sh
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat
.\scripts\setup.ps1
```

### Manual Setup

1. **Clone the repository:**
```bash
git clone <repository-url>
cd Secure-Ai-Chat
```

2. **Install dependencies:**
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. **Run smoke tests (recommended after installation):**
```bash
npm run smoke
# This verifies lint and build pass - catches restart issues early
```

4. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys and configuration values. See `.env.example` for required variables.

5. **Run the development server:**
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

6. **Open the exact URL printed by the dev server in your browser.**  
   Use the same host and port the terminal shows (e.g. `http://localhost:3000` or `http://localhost:3001` if port 3000 was in use). Do not change the host or port—cookies are scoped by origin; using a different port will cause files to appear to vanish. If the server prints a different port (e.g. 3001), always use that URL.

## Production Build

### Build for Production

```bash
npm run build
# or
yarn build
# or
pnpm build
```

**Build warnings (npm):** If you see `npm warn Unknown env config "devdir"`, that comes from your **user** npm config (not this project). It will stop working in a future major npm version. To fix it once, run:

```bash
npm config delete devdir
```

See [docs/DATA_STORAGE_AND_REINSTALL.md](docs/DATA_STORAGE_AND_REINSTALL.md#build-and-npm-warnings-stability) for details.

### Start Production Server

```bash
npm run start
# or
yarn start
# or
pnpm start
```

The production server will start on port 3000 by default. You can change this by setting the `PORT` environment variable.

**If http://localhost:3000 is not accessible in your browser:**

1. **Run the server in your system terminal** (macOS **Terminal.app** or **iTerm**), not from Cursor’s Run/background. Close Cursor’s terminal for this and use a normal OS terminal.
2. **Free port 3000 and start bound to 127.0.0.1** (recommended):
   ```bash
   cd "/Users/mhamayun/Downloads/Cursor Workbooks/Secure-Ai-Chat-V1.0.1/secure-ai-chat"
   npm run start:local:safe
   ```
   This kills any process on port 3000, then starts the app at **http://127.0.0.1:3000**.
3. In your browser open **http://127.0.0.1:3000** (prefer this over localhost if you have issues).
4. If you prefer to keep an existing server and only restart: `lsof -ti :3000 | xargs kill -9` then `npm run start:local`.

### Production Deployment

The application includes production-ready configurations for multiple deployment methods:

**Docker:**
```bash
docker-compose up -d
# Health check: curl http://localhost:3000/api/health
```

**systemd:**
```bash
sudo cp secure-ai-chat.service /etc/systemd/system/
sudo systemctl enable secure-ai-chat
sudo systemctl start secure-ai-chat
```

**Kubernetes:**
```bash
kubectl apply -f k8s-deployment.yaml
```

**Deployment Guide**: See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete deployment workflows:
- **Upgrade Existing Installation**: Safe, idempotent, rollback-friendly upgrades
- **Clean Install on New Server**: Full setup from scratch
- **Stable Build Validation**: Release gate and smoke tests
- **Systemd Service Configuration**: Service management and troubleshooting

**Release Process**: See [RELEASE.md](RELEASE.md) for:
- Release gate validation
- GitHub publishing steps
- Security hard gates
- Pre-deployment checklist

See [INSTALL.md](INSTALL.md) for detailed installation instructions and restart verification steps.

### Environment Variables for Production

Make sure to set all required environment variables in your production environment. See `.env.example` for reference.

## Environment Variables

The application uses environment variables for configuration. Copy `.env.example` to `.env.local` and fill in your values:

### Required Variables

- `OPENAI_API_KEY` - Your OpenAI API key (required for chat functionality)
  - Get it from: https://platform.openai.com/api-keys

### Optional Variables

- `LAKERA_AI_KEY` - Your Lakera AI API key (for security scanning)
  - Get it from: https://platform.lakera.ai/
- `LAKERA_ENDPOINT` - Lakera API endpoint (defaults to `https://api.lakera.ai/v2/guard`)
- `LAKERA_PROJECT_ID` - Your Lakera project ID (if using project-specific keys)
- `LAKERA_TELEMETRY_ENABLED` - Enable/disable sending logs to Platform.lakera.ai (default: `true`)
- `LAKERA_TELEMETRY_ENDPOINT` - Custom telemetry endpoint (default: `https://api.lakera.ai/v2/telemetry`)
- `CHECKPOINT_TE_API_KEY` - Your Check Point ThreatCloud / Threat Emulation API key (for file sandboxing)
  - Can also be configured via Settings page (stored server-side)
  - Get it from: https://te.checkpoint.com/
- `WAF_AUTH_ENABLED` - Enable authentication for Check Point WAF log access (default: `false`, recommended: `true` in production)
- `WAF_API_KEY` - API key for Check Point WAF log access (required if `WAF_AUTH_ENABLED=true`)
- `NEXT_PUBLIC_APP_NAME` - Application name (defaults to "Secure AI Chat")
- `NEXT_PUBLIC_APP_VERSION` - Application version (defaults to "0.1.0")
- `PORT` - Server port (defaults to 3000)
- `HOSTNAME` - Server hostname (defaults to "0.0.0.0")

**Note:** API keys can also be configured through the Settings page in the application. Lakera and OpenAI keys are stored in localStorage (client-side), while Check Point TE API key is stored server-side for security. For production, consider using environment variables or a secure key management service.

See `.env.example` for a complete list of available variables.

## Project Structure

```
Secure-Ai-Chat/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── chat/         # Chat API endpoint
│   │   └── scan/         # File scan API endpoint
│   ├── dashboard/        # Dashboard page
│   ├── files/            # Files page
│   ├── risk-map/         # Risk map page
│   ├── settings/         # Settings page
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home page
│   └── globals.css       # Global styles
├── components/           # React components
│   ├── ChatInterface.tsx # Main chat component
│   ├── MessageList.tsx   # Message list component
│   ├── MessageBubble.tsx # Individual message bubble
│   ├── MessageInput.tsx  # Message input form
│   └── SecurityIndicator.tsx # Security status indicator
├── lib/                  # Utility functions
│   ├── logging.ts        # Logging utilities
│   └── security.ts       # Security utilities
├── types/                # TypeScript type definitions
├── scripts/              # Setup scripts
│   ├── setup.sh          # Unix/Linux/macOS setup script
│   └── setup.ps1         # Windows setup script
└── package.json          # Dependencies and scripts
```

## Security Features

- **Security Headers**: Configured in `next.config.js` with:
  - Strict-Transport-Security (HSTS)
  - X-Frame-Options
  - X-Content-Type-Options
  - X-XSS-Protection
  - Referrer-Policy
  - Permissions-Policy

- **Check Point WAF Integration**: 
  - Full support for Check Point WAF as reverse proxy
  - Request/response logging for WAF monitoring
  - Log access API endpoints for Check Point WAF
  - Security event tracking and reporting
  - See [docs/CHECKPOINT_WAF_INTEGRATION.md](docs/CHECKPOINT_WAF_INTEGRATION.md) for details

- **Encryption Utilities**: Placeholder functions in `lib/security.ts` for:
  - Message encryption/decryption
  - Input sanitization
  - Secure connection validation

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run check` - Run type-check and lint (validates code before commit)
- `npm run check:ci` - Run type-check, lint, and format check (for CI/CD)
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run smoke` - Run smoke tests (lint + build verification)

## Development

### Release Gate (STRICT - Must Pass)

Before deploying, **MUST** run the Release Gate validation:

```bash
npm run release-gate
```

**What it checks** (ALL must pass):
- ✅ Clean install (fresh dependencies)
- ✅ TypeScript type checking (no errors)
- ✅ ESLint validation (no errors, warnings OK)
- ✅ Security: Client-side key leakage prevention
- ✅ Security: Build output scan (no keys in bundle)
- ✅ Security: Git history scan (no keys in tracked files)
- ✅ Production build (must succeed)

**Exit Code**: `0` = ✅ PASS (ready for deployment), `1` = ❌ FAIL (do NOT deploy)

**If FAIL**: Fix all errors and re-run until all checks pass.

See `RELEASE.md` for detailed documentation and Release Gate checklist.

### Smoke Tests

Before starting development or after pulling changes, run smoke tests to verify everything is working:

```bash
npm run smoke
```

This script:
- Verifies Node.js and npm versions
- Runs linting checks
- Builds the production bundle
- Catches restart issues and build problems early

**When to run smoke tests:**
- After `npm install` or dependency updates
- Before committing changes
- After pulling from git
- Before deploying to production
- When troubleshooting build issues

### Adding AI Integration

API keys are configured through the Settings page in the application. The application uses localStorage to store API keys securely.

### Implementing Encryption

Update the encryption functions in `lib/security.ts` with your preferred encryption library (e.g., crypto-js, Web Crypto API).

## Security Considerations

⚠️ **Important**: This is a starter template. Before deploying to production:

1. Implement actual encryption algorithms (replace placeholders in `lib/security.ts`)
2. Set up proper authentication and authorization
3. Validate and sanitize all user inputs
4. Use HTTPS in production
5. Secure your API keys and environment variables
6. Implement rate limiting
7. Add proper error handling and logging
8. Conduct security audits

## Troubleshooting

### Build Errors

**Error: Module not found**
- Run `npm install` to ensure all dependencies are installed
- Delete `node_modules` and `package-lock.json`, then run `npm install` again

**Error: TypeScript errors**
- Run `npm run type-check` to see detailed error messages
- Ensure all types are properly defined (avoid `any` types)

**Error: ESLint errors**
- Run `npm run lint` to see linting issues
- Run `npm run format` to auto-fix formatting issues

### Deprecated Package Warnings

**npm warn deprecated eslint@8.57.1**
- This warning is **expected and safe to ignore**
- ESLint 8.x is required for Next.js 14 compatibility
- All other deprecated packages (inflight, rimraf@3, glob@7, @humanwhocodes) have been resolved via npm overrides
- See [DEPRECATED_PACKAGES_FIX.md](./DEPRECATED_PACKAGES_FIX.md) for details

**Other deprecated warnings during installation**
- If you see warnings for inflight, rimraf@3, glob@7, or @humanwhocodes packages, ensure `package-lock.json` is up-to-date
- Run `npm ci` for production deployments to use exact versions from lock file

### Runtime Errors

**Port already in use**
- Change the port: `PORT=3001 npm run dev`
- Or kill the process using port 3000

**API key errors**
- Verify your API keys are correctly set in Settings or `.env.local`
- Check that API keys have the necessary permissions
- Ensure API keys are not expired

**Lakera API errors**
- Verify your Lakera API key is valid
- Check your API endpoint URL is correct
- Ensure you have sufficient API credits/quota

### Development Issues

**Hot reload not working**
- Restart the development server
- Clear `.next` directory: `rm -rf .next` (Unix) or `rmdir /s .next` (Windows)

**TypeScript errors in IDE**
- Restart your IDE/editor
- Run `npm run type-check` to verify types
- Ensure your IDE is using the workspace TypeScript version

## How to Publish a Release

1. **Update version** in `package.json`:
   ```json
   "version": "0.2.0"
   ```

2. **Update CHANGELOG.md** with release notes following [Keep a Changelog](https://keepachangelog.com/) format

3. **Commit changes**:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore: bump version to 0.2.0"
   ```

4. **Create a git tag**:
   ```bash
   git tag -a v0.2.0 -m "Release version 0.2.0"
   git push origin v0.2.0
   ```

5. **Push to main branch**:
   ```bash
   git push origin main
   ```

6. **Create a GitHub Release**:
   - Go to the repository on GitHub
   - Click "Releases" → "Draft a new release"
   - Select the tag you just created
   - Copy the changelog entry as the release description
   - Publish the release

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- Read our [Code of Conduct](CODE_OF_CONDUCT.md)
- Check our [Security Policy](SECURITY.md) for reporting vulnerabilities
- See [CHANGELOG.md](CHANGELOG.md) for recent changes

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](README.md)
- 🐛 [Report a Bug](https://github.com/your-username/Secure-Ai-Chat/issues/new?template=bug_report.md)
- 💡 [Request a Feature](https://github.com/your-username/Secure-Ai-Chat/issues/new?template=feature_request.md)
- 💬 [Open a Discussion](https://github.com/your-username/Secure-Ai-Chat/discussions)

---

Built with ❤️ for secure AI conversations
