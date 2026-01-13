# Release Notes - Version 1.0.8

## 🎉 Secure AI Chat v1.0.8

**Release Date:** January 13, 2025  
**Status:** Stable Release  
**Branch:** `main`  
**Previous Version:** 1.0.7

---

## 🆕 New Features

### Production Installation & Deployment

- **Ubuntu VM Installation Script** (`scripts/install_ubuntu_public.sh`)
  - Single-step installation script for fresh Ubuntu VM deployments
  - Installs system dependencies, Node.js LTS 20.x, clones repository
  - Auto-detects free port starting from 3000 (avoids EADDRINUSE errors)
  - Creates dedicated user (`secureai`) and installs under `/opt/secure-ai-chat`
  - Configures systemd service for auto-start and management
  - Sets up nginx reverse proxy on port 80
  - Configures UFW firewall (SSH + Nginx)
  - Performs smoke checks after installation
  - Idempotent: safe to re-run for updates/repairs
  - Complete documentation in `docs/INSTALL_UBUNTU_VM.md`

- **Safe Remote Upgrade Script** (`scripts/upgrade_remote.sh`)
  - Safely upgrades remote installations to latest version
  - Automatically backs up all settings before upgrade:
    - `.env.local` (all API keys and environment variables)
    - `.secure-storage/` (encrypted server-side keys)
    - `.storage/` (application data)
  - Preserves all configurations during upgrade
  - Verifies upgrade success with version and health checks
  - Rollback capability via backup
  - Complete documentation in `docs/UPGRADE_REMOTE.md`

- **Cleanup/Reset Script** (`scripts/cleanup_reset_vm.sh`)
  - Safely removes application, services, and nginx configuration
  - Stops and disables systemd service
  - Removes nginx site configuration
  - Optionally removes dedicated user
  - Restores default nginx site
  - Kills node/next processes on ports 3000-3999

- **Git Repository Fix Script** (`scripts/fix_git_repo.sh`)
  - Fixes corrupted or missing `.git` repository in installation directory
  - Backs up settings before repair
  - Re-initializes or re-clones repository while preserving user data
  - Restores backed-up settings after repair
  - Rebuilds and restarts service
  - Complete documentation in `FIX_GIT_REPO.md`

### CLI Tools

- **CLI Script to Set API Keys** (`scripts/set-api-keys.sh`)
  - Set API keys via command line (no web UI required)
  - Supports all keys:
    - OpenAI API key
    - Lakera AI key
    - Lakera Project ID
    - Lakera Endpoint
    - Check Point Threat Emulation key
  - Interactive mode for easy key entry
  - Works with local and remote servers
  - Uses existing API endpoints (no application changes)
  - Keys stored server-side in encrypted format (same as web UI)
  - Complete documentation in `docs/CLI_API_KEYS.md`

### Documentation

- **Installation Documentation** (`docs/INSTALL_UBUNTU_VM.md`)
  - Comprehensive guide for Ubuntu VM installation
  - Prerequisites and requirements
  - Quick install command (curl | bash)
  - Post-installation configuration steps
  - Troubleshooting guide (502 errors, EADDRINUSE, service issues)

- **Upgrade Documentation** (`docs/UPGRADE_REMOTE.md`)
  - Safe remote upgrade process
  - What gets preserved during upgrade
  - Manual upgrade steps
  - Rollback instructions

- **API Endpoints Documentation** (`docs/API_ENDPOINTS_FOR_SECURITY.md`)
  - Recommended API endpoints for security configuration
  - Request URI and prompt location details
  - JSONPath expressions for prompt extraction
  - Example requests and responses

- **Merge Safety Reports**
  - `MERGE_SAFETY_VERIFICATION.md` - Detailed technical verification
  - `MERGE_SAFETY_REPORT.md` - Executive summary and risk assessment

---

## 🔧 Improvements

### Installation & Deployment

- **README.md Updates**
  - Added "Quick Install (Ubuntu VM)" section
  - Added "Reset/Cleanup" section
  - Added note about Node.js LTS for server installs
  - Improved installation instructions

- **Port Auto-Detection**
  - Installation script automatically finds free port starting from 3000
  - Prevents EADDRINUSE errors during installation
  - Updates `.env.local` with detected port

- **Idempotent Installation**
  - Installation script can be safely re-run
  - Updates existing installation rather than failing
  - Preserves existing configurations

### Security

- **Server-Side Key Management**
  - CLI script uses same encrypted storage as web UI
  - No changes to key handling mechanisms
  - Keys remain encrypted at rest (AES-256-CBC)

---

## 🐛 Bug Fixes

- **Git Repository Issues**
  - Fixed "fatal: not a git repository" errors on remote installations
  - Added script to repair corrupted git repositories
  - Ensures single repository chain (no double repository issues)

- **Upgrade Process**
  - Fixed 404 errors when downloading upgrade scripts from wrong branch
  - Improved upgrade script error handling
  - Better version detection during upgrades

---

## 📋 Technical Details

### New Scripts

1. `scripts/install_ubuntu_public.sh` - Production installation script
2. `scripts/upgrade_remote.sh` - Safe remote upgrade script
3. `scripts/cleanup_reset_vm.sh` - Cleanup/reset script
4. `scripts/fix_git_repo.sh` - Git repository repair script
5. `scripts/set-api-keys.sh` - CLI script to set API keys

### New Documentation

1. `docs/INSTALL_UBUNTU_VM.md` - Ubuntu VM installation guide
2. `docs/UPGRADE_REMOTE.md` - Remote upgrade guide
3. `docs/CLI_API_KEYS.md` - CLI API keys documentation
4. `docs/API_ENDPOINTS_FOR_SECURITY.md` - API endpoints for security
5. `FIX_GIT_REPO.md` - Git repository fix guide
6. `MERGE_SAFETY_VERIFICATION.md` - Merge safety verification
7. `MERGE_SAFETY_REPORT.md` - Merge safety report

### Updated Files

- `README.md` - Added Quick Install and Reset/Cleanup sections
- `package.json` - Version updated to 1.0.8

---

## 🚀 Installation

### Quick Install (Ubuntu VM)

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_public.sh | bash
```

### Set API Keys via CLI

```bash
bash scripts/set-api-keys.sh \
  --openai-key "sk-..." \
  --lakera-key "lkr_..." \
  --lakera-project-id "proj_..." \
  --checkpoint-te-key "TE_API_KEY_..."
```

### Upgrade Remote Installation

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade_remote.sh | bash
```

---

## 📝 Migration Notes

### From 1.0.7 to 1.0.8

- **No Breaking Changes**: All existing installations continue working
- **No Migration Required**: Settings and keys are automatically preserved
- **Upgrade Process**: Use `upgrade_remote.sh` script for safe upgrades
- **New Features**: All new features are optional and don't affect existing functionality

---

## 🔒 Security

- All API keys remain encrypted server-side
- No changes to key handling or storage mechanisms
- CLI script uses same security as web UI
- All scripts validate inputs and handle errors safely

---

## 📚 Documentation

- Complete installation guide: `docs/INSTALL_UBUNTU_VM.md`
- Upgrade guide: `docs/UPGRADE_REMOTE.md`
- CLI usage: `docs/CLI_API_KEYS.md`
- API endpoints: `docs/API_ENDPOINTS_FOR_SECURITY.md`

---

## 🙏 Acknowledgments

This release focuses on production deployment and operational tooling, making it easier to install, upgrade, and manage Secure AI Chat in production environments.

---

## 📞 Support

For issues or questions:
- Check documentation in `docs/` directory
- Review troubleshooting guides in installation documentation
- Check release notes for known issues

---

**Full Changelog**: See `CHANGELOG.md` for complete version history.
