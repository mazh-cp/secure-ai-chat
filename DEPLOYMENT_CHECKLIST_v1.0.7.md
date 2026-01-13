# Deployment Checklist - Version 1.0.7

**Version**: 1.0.7  
**Target**: Fresh Ubuntu VM Installation  
**Status**: Pre-Deployment

---

## Pre-Deployment Checklist

Before pushing to remote repository, complete all items below:

### ✅ Code Quality

- [ ] **TypeScript Compilation**: `npm run type-check` passes
- [ ] **ESLint Validation**: `npm run lint` passes (warnings OK, no errors)
- [ ] **Production Build**: `npm run build` succeeds
- [ ] **Release Gate**: `npm run release-gate` passes (all checks PASS)

### ✅ Version Verification

- [ ] **package.json**: Version is `1.0.7`
- [ ] **CHANGELOG.md**: Version 1.0.7 entry exists and is complete
- [ ] **README.md**: Version references are accurate (if any)
- [ ] **Git Tag**: `v1.0.7` tag created and ready to push

### ✅ Documentation

- [ ] **FRESH_UBUNTU_INSTALLATION_v1.0.7.md**: Installation guide created and reviewed
- [ ] **RELEASE_GATE_CHECKLIST.md**: Checklist is up to date
- [ ] **INSTALL.md**: Installation instructions are current
- [ ] **README.md**: Main documentation is accurate

### ✅ Security

- [ ] **No API Keys in Code**: `npm run release-gate` confirms no keys in client code
- [ ] **No Keys in Build**: Build output scan passes
- [ ] **No Keys in Git**: Git secret scan passes
- [ ] **.gitignore**: `.secure-storage` and `.storage` are ignored
- [ ] **Security Audit**: `npm run verify-security` passes (if available)

### ✅ Installation Scripts

- [ ] **install-ubuntu.sh**: Script is up to date and tested
- [ ] **validate-installation.sh**: Validation script works correctly
- [ ] **release-gate.sh**: Release gate script passes locally

### ✅ Configuration Files

- [ ] **.env.example**: Example environment file is current (if exists)
- [ ] **systemd service**: `secure-ai-chat.service` template is accurate
- [ ] **docker-compose.yml**: Docker configuration is current (if using Docker)

---

## Deployment Steps

### Step 1: Local Verification

```bash
# 1. Ensure you're in the correct directory
cd secure-ai-chat

# 2. Verify Node.js version
node -v  # Should be: v25.2.1

# 3. Run release gate
npm run release-gate

# 4. Verify version
cat package.json | grep '"version"'
# Should show: "version": "1.0.7"

# 5. Check git status
git status
git log --oneline -5
```

### Step 2: Commit All Changes

```bash
# Add all changes
git add .

# Commit with descriptive message
git commit -m "Prepare v1.0.7 for fresh Ubuntu VM installation

- Version set to 1.0.7
- Fresh installation guide created
- Deployment checklist created
- All release gate requirements verified"

# Verify commit
git log --oneline -1
```

### Step 3: Create Git Tag

```bash
# Create annotated tag for v1.0.7
git tag -a v1.0.7 -m "Release version 1.0.7 - Fresh Ubuntu VM installation ready"

# Verify tag
git tag -l v1.0.7
git show v1.0.7
```

### Step 4: Push to Remote Repository

```bash
# Push commits to main branch
git push origin main

# Push tags
git push origin v1.0.7

# Verify remote
git ls-remote --tags origin | grep v1.0.7
```

---

## Post-Deployment Verification

After pushing to remote repository:

### ✅ Remote Repository

- [ ] **GitHub**: Repository is accessible
- [ ] **Version Tag**: `v1.0.7` tag exists on GitHub
- [ ] **Main Branch**: Latest code is on main branch
- [ ] **Installation Script**: `scripts/install-ubuntu.sh` is accessible via GitHub raw URL

### ✅ Installation Script Accessibility

Test the installation script URL:

```bash
# Test script download
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | head -20

# Should show script content, not 404
```

**Note**: Replace `mazh-cp/secure-ai-chat` with your actual GitHub username and repository name.

---

## Fresh VM Installation Verification

After deployment, test installation on a fresh Ubuntu VM:

### ✅ Installation Steps

- [ ] **Script Download**: Installation script downloads successfully
- [ ] **System Dependencies**: All system packages install correctly
- [ ] **Node.js Installation**: Node.js v25.2.1 installs via nvm
- [ ] **Repository Clone**: Repository clones successfully
- [ ] **Dependencies Install**: `npm ci` completes without errors
- [ ] **Build Succeeds**: `npm run build` completes successfully
- [ ] **Firewall Configuration**: UFW rules are configured correctly

### ✅ Application Verification

- [ ] **Service Starts**: systemd service starts successfully
- [ ] **Health Endpoint**: `curl http://localhost:3000/api/health` returns OK
- [ ] **Version Endpoint**: `curl http://localhost:3000/api/version` returns `1.0.7`
- [ ] **Application Accessible**: Browser loads `http://VM_IP:3000`
- [ ] **Release Gate Passes**: `npm run release-gate` passes on VM
- [ ] **Installation Validation**: `scripts/validate-installation.sh` passes (if exists)

### ✅ Functional Testing

- [ ] **Chat Functionality**: Chat works with OpenAI API key
- [ ] **File Upload**: File upload works (if configured)
- [ ] **Theme Toggle**: Light/dark theme toggle works
- [ ] **Theme Persistence**: Theme persists after page refresh
- [ ] **Settings Page**: Settings page loads and saves correctly
- [ ] **API Key Configuration**: API keys can be configured (server-side storage)

---

## Deployment Command Summary

Quick reference for deployment commands:

```bash
# 1. Local verification
cd secure-ai-chat
npm run release-gate

# 2. Commit changes
git add .
git commit -m "Prepare v1.0.7 for fresh Ubuntu VM installation"

# 3. Create and push tag
git tag -a v1.0.7 -m "Release version 1.0.7"
git push origin main
git push origin v1.0.7

# 4. Verify remote
git ls-remote --tags origin | grep v1.0.7

# 5. Test installation script (from Ubuntu VM)
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

---

## Rollback Plan

If deployment issues occur:

```bash
# 1. Revert last commit (if not pushed)
git reset --soft HEAD~1

# 2. Delete tag (if not pushed)
git tag -d v1.0.7

# 3. Force push revert (if already pushed - use with caution)
# git revert HEAD
# git push origin main

# 4. Delete remote tag (if already pushed)
# git push origin --delete v1.0.7
```

---

## Support and Documentation

- **Installation Guide**: `FRESH_UBUNTU_INSTALLATION_v1.0.7.md`
- **Release Gate Checklist**: `RELEASE_GATE_CHECKLIST.md`
- **Installation Guide**: `INSTALL.md`
- **Release Gate Summary**: `RELEASE_GATE_FINAL.md`

---

**Version**: 1.0.7  
**Last Updated**: January 2025  
**Status**: Ready for Deployment
