# Release Notes v1.0.7

**Release Date:** January 12, 2026  
**Type:** Minor Release

## 🎉 What's New

### Release Notes Page
- **New Dedicated Release Notes Page**: Accessible from Settings page and navigation sidebar
  - Beautiful UI with version badges and type indicators
  - Displays current application version
  - Categorized changes (Added, Fixed, Improved, Security)
  - Complete version history

### RAG (Retrieval Augmented Generation)
- **Chat File Access**: Chat can now access and answer questions about uploaded files
  - Automatic file content retrieval based on user queries
  - Supports CSV, JSON, and text files
  - Smart content matching and excerpt generation for large files
  - Controlled by "RAG Scan" toggle on Files page

### Security Verification
- **Automated Security Script**: New `npm run verify-security` command
  - Checks .gitignore configuration
  - Verifies no keys in git repository
  - Validates file permissions
  - Scans for hardcoded API keys

## 🐛 Bug Fixes

### File Scanning
- **Fixed "Failed to execute 'json' on 'Response'" error** for large files
  - Response cloning to avoid stream consumption issues
  - Better error handling for files with 500+ individuals

### Navigation
- **Fixed sidebar navigation** - sidebar now always visible on desktop
  - Desktop users can always access navigation links
  - Mobile users can toggle sidebar with hamburger menu
  - Auto-close sidebar on mobile after navigation

### Checkpoint TE Status
- **Fixed status not updating after key save**
  - Added 200ms delay before status refresh
  - Periodic status checking in Files page (every 5 seconds)
  - Automatic toggle enable when key is configured

### Webpack Chunk Errors
- **Fixed "Cannot find module" errors**
  - Proper cache clearing and rebuild process
  - Fresh dev server startup

## ⚡ Improvements

- **Key Deletion**: Enhanced with proper server-side cache invalidation
- **Status Synchronization**: Better sync between Settings and Files pages
- **System Prompt**: Updated to allow data queries from uploaded files
- **Error Handling**: Enhanced error messages and recovery
- **Documentation**: Comprehensive security and upgrade documentation

## 🔐 Security

- **Key Security Verification**: Confirmed all API keys excluded from git
- **Persistence Verification**: Confirmed keys persist across restarts and upgrades
- **File Permissions**: Verified correct permissions (700/600) on storage files

## 📦 Package Updates

- Updated all packages to latest patch/minor versions
- No security vulnerabilities found
- All dependencies up to date

## 📝 Documentation Updates

- Updated `CHANGELOG.md` with v1.0.7 changes
- Updated `README.md` with new features
- Created `RELEASE_NOTES_v1.0.7.md` (this file)
- Enhanced security documentation

## 🚀 Upgrade Instructions

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Update dependencies:**
   ```bash
   npm install
   ```

3. **Rebuild application:**
   ```bash
   npm run build
   ```

4. **Restart services:**
   ```bash
   # For systemd
   sudo systemctl restart secure-ai-chat
   
   # For Docker
   docker-compose restart
   ```

## 📋 Accessing Release Notes

- **From Settings Page**: Click "View Release Notes" button in the Release Notes section
- **From Navigation**: Click "Release Notes" in the sidebar
- **Direct URL**: Navigate to `/release-notes`

## ✅ Testing

All features have been tested and validated:
- ✅ Release Notes page loads correctly
- ✅ Navigation links work properly
- ✅ File scanning with large files works
- ✅ RAG functionality works correctly
- ✅ Checkpoint TE status updates properly
- ✅ All pages accessible
- ✅ Build completes successfully

---

**Full Changelog**: See [CHANGELOG.md](CHANGELOG.md) for complete version history.
