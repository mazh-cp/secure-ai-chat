# Version History Summary - Troubleshooting Reference

This document provides a comprehensive summary of all changes in versions 1.0.4 and 1.0.5 for troubleshooting and bug fix reference.

---

## 📋 Version 1.0.5 Summary

### 🎯 Key Features Added

#### 1. **OpenAI Model Selector**
- **Location**: Chat page, above message input
- **Functionality**: Dropdown to select different OpenAI models
- **API Route**: `/api/models` - Fetches available models from OpenAI
- **Component**: `ModelSelector.tsx`
- **Storage**: Model preference saved in `localStorage`
- **Default**: `gpt-4o-mini`
- **Validation**: Only `gpt-*` models allowed
- **Sorting**: Newest models first

#### 2. **Dynamic Version Display**
- **Location**: Bottom left of sidebar (Layout component)
- **API Endpoint**: `/api/version` - Reads version from `package.json`
- **Implementation**: `app/api/version/route.ts`
- **Behavior**: Automatically reflects `package.json` version after rebuild

#### 3. **Persistent File Storage**
- **Location**: `.storage/` directory (server-side)
- **Functionality**: Files persist across server restarts
- **API Routes**:
  - `POST /api/files/store` - Store file
  - `GET /api/files/list` - List all files
  - `DELETE /api/files/delete` - Delete file
- **Library**: `lib/persistent-storage.ts`

#### 4. **Multiple File Upload**
- **Limit**: Up to 5 files simultaneously
- **Component**: `FileUploader.tsx`
- **UI**: Progress bar showing upload progress
- **File Size**: 50 MB per file limit

#### 5. **API Key Validation**
- **Endpoints**:
  - `/api/keys/validate` - Validate OpenAI and Lakera keys
  - `/api/te/config/validate` - Validate Check Point TE key
  - `/api/keys/values` - Get Lakera Project ID and Endpoint values
- **UI**: Status dots (green=valid, red=invalid, yellow=validating)
- **Settings**: Real-time validation feedback

#### 6. **Lakera Project ID Persistence**
- **Issue Fixed**: Project ID disappearing after reboot
- **Solution**: Server-side storage with `/api/keys/values` endpoint
- **UI**: Project ID field is now visible (text input, not password)

#### 7. **Check Point TE Key Status Fix**
- **Issue Fixed**: "Key not configured" showing after adding new key
- **Solution**: Re-check status from server after save/remove
- **Implementation**: `checkCheckpointTeStatus()` called after operations

#### 8. **Cache Cleanup Service**
- **Functionality**: Automatically clears uploaded files every 24 hours
- **Library**: `lib/cache-cleanup.ts`
- **API**: `/api/health/cache` - Manual trigger and status
- **Initialization**: Auto-starts on server startup

#### 9. **API Key Persistence Protection**
- **Enhancement**: Upgrade script protects `.secure-storage/` directory
- **Verification**: Checks keys exist after upgrade
- **Permissions**: Restores 700/600 permissions after upgrade
- **Documentation**: `API_KEYS_PERSISTENCE.md`

#### 10. **Lakera Guard API v2 Compliance**
- **Changes**:
  - `project_id` moved from header to request body
  - Custom `context` replaced with official `metadata: { ip_address, internal_request_id }`
  - Added `payload: true` and `breakdown: true` parameters
- **Files**: `app/api/chat/route.ts`, `app/api/scan/route.ts`

### 🔧 Bug Fixes

1. **Save Keys Button Visibility (Light Mode)**
   - Fixed: Button not visible in light mode
   - Solution: Changed to `rgb(var(--accent))` for proper theme support

2. **Lakera Project ID Visibility**
   - Fixed: Project ID field was password type (hidden)
   - Solution: Changed to text input with visibility

3. **Version Display Not Updating**
   - Fixed: Hardcoded version in Layout component
   - Solution: Dynamic version from `/api/version` endpoint

4. **Check Point TE Key Status**
   - Fixed: Status not updating after save/remove
   - Solution: Re-check status from server after operations

### 📁 New Files Created

- `app/api/version/route.ts` - Version API endpoint
- `app/api/files/store/route.ts` - File storage endpoint
- `app/api/files/list/route.ts` - File listing endpoint
- `app/api/files/delete/route.ts` - File deletion endpoint
- `app/api/health/cache/route.ts` - Cache cleanup endpoint
- `app/api/keys/validate/route.ts` - Key validation endpoint
- `app/api/te/config/validate/route.ts` - TE key validation endpoint
- `app/api/keys/values/route.ts` - Key values endpoint
- `lib/persistent-storage.ts` - Persistent file storage
- `lib/cache-cleanup.ts` - Cache cleanup service
- `components/ModelSelector.tsx` - Model selector component
- `API_KEYS_PERSISTENCE.md` - Key persistence documentation
- `SECURE_UPDATE_GUIDE_v1.0.5.md` - Secure update guide
- `PRODUCTION_VERIFICATION_COMMANDS.md` - Verification commands
- `USER_GUIDE.md` - Comprehensive user guide

### 🔄 Modified Files

- `package.json` - Version updated to 1.0.5
- `components/Layout.tsx` - Dynamic version display
- `components/SettingsForm.tsx` - Key validation, Project ID persistence
- `components/ChatInterface.tsx` - Model selector integration
- `components/FileUploader.tsx` - Multiple file upload support
- `app/files/page.tsx` - Persistent storage integration
- `app/api/chat/route.ts` - Lakera Guard v2 compliance
- `app/api/scan/route.ts` - Lakera Guard v2 compliance
- `scripts/upgrade-production.sh` - API key persistence protection

---

## 📋 Version 1.0.4 Summary

### 🎯 Key Features Added

#### 1. **UniFi-Style Day/Night Theme System**
- **Complete Theme Overhaul**: Light and dark themes with neutral-first palette
- **CSS Variables**: Design tokens for maintainability
- **Theme Toggle**: Component with system preference support
- **Bootstrap Script**: Prevents theme flash on initial load
- **Documentation**: `docs/THEME_SYSTEM.md`

#### 2. **Status Dots Enhancement**
- **Visual Indicators**: Green/red dots for enabled/disabled states
- **Locations**: 
  - Files page toggles (Lakera Scan, RAG Auto Scan, File Sandboxing)
  - Settings page API key fields
- **Effects**: Subtle glow effects for better visibility

#### 3. **Source Protection**
- **Security Features**:
  - Disabled right-click context menu
  - Disabled keyboard shortcuts (F12, Ctrl+U, Ctrl+Shift+I, etc.)
  - Disabled text selection (except form fields)
  - Disabled image dragging
- **Component**: `SourceProtection.tsx`
- **Integration**: Layout component

#### 4. **Production Safety Audit**
- **Comprehensive Audit**: `docs/SAFETY_AUDIT.md`
- **Hardening Changes**: `docs/HARDENING_CHANGES.md`
- **Validation Script**: `scripts/validate-env.sh`
- **Environment Config**: `.env.example` file

#### 5. **Environment Configuration**
- **Validation**: `validate-env` npm script for startup checks
- **Documentation**: `.env.example` for reference
- **Package Scripts**: Added `typecheck` alias, `test` placeholder, `validate-env`

### 🔧 Changes

1. **Dockerfile**: Updated Node.js from `20-alpine` to `25-alpine`
2. **Theme System**: Complete refactor to CSS variables (design tokens)
3. **Files Page**: Added status dots to toggles
4. **Settings Page**: Added status dots to API key fields
5. **Layout**: Enhanced source protection integration

### 🔒 Security Enhancements

- ✅ Source protection component prevents casual code inspection
- ✅ Error boundaries verified to not expose secrets
- ✅ Security headers verified and production-ready
- ✅ Docker, systemd, and Kubernetes configurations hardened
- ✅ Environment variable validation (warns, doesn't fail)

### 📁 New Files Created

- `docs/SAFETY_AUDIT.md` - Production safety audit
- `docs/HARDENING_CHANGES.md` - Hardening changes documentation
- `docs/THEME_SYSTEM.md` - Theme system architecture
- `.env.example` - Environment variable documentation
- `components/SourceProtection.tsx` - Source protection component
- `components/ThemeToggle.tsx` - Theme toggle component
- `components/ThemeBootstrap.tsx` - Theme bootstrap script
- `lib/theme/bootstrap.ts` - Theme bootstrap logic
- `lib/theme/setTheme.ts` - Theme setting logic
- `lib/theme/tokens.ts` - Theme tokens
- `lib/theme/tokens.css` - Theme CSS variables

### 🔄 Modified Files

- `package.json` - Version updated to 1.0.4, new scripts
- `components/Layout.tsx` - Source protection integration
- `app/files/page.tsx` - Status dots for toggles
- `components/SettingsForm.tsx` - Status dots for API keys
- `Dockerfile` - Node.js version update
- `app/globals.css` - Theme system integration

---

## 🐛 Common Issues & Troubleshooting

### Version 1.0.5 Issues

#### Issue: Version not showing correctly after upgrade
- **Cause**: Hardcoded version in Layout component
- **Fix**: Use `/api/version` endpoint (already implemented)
- **Verification**: `curl http://localhost:3000/api/version`

#### Issue: Check Point TE key shows "not configured" after adding
- **Cause**: Status not re-checked after save
- **Fix**: `checkCheckpointTeStatus()` called after save/remove (already implemented)
- **Verification**: Check Settings page status dot

#### Issue: API keys lost after upgrade
- **Cause**: `.secure-storage/` not protected during upgrade
- **Fix**: Upgrade script now protects and verifies keys (already implemented)
- **Verification**: Check `.secure-storage/` directory exists after upgrade

#### Issue: Lakera Project ID disappears after reboot
- **Cause**: Not persisted server-side
- **Fix**: `/api/keys/values` endpoint and server-side storage (already implemented)
- **Verification**: Check Settings page after reboot

### Version 1.0.4 Issues

#### Issue: Theme flash on page load
- **Cause**: Theme not set before React hydration
- **Fix**: Bootstrap script sets theme immediately (already implemented)
- **Verification**: Check `components/ThemeBootstrap.tsx`

#### Issue: Source code easily accessible
- **Cause**: No protection against casual inspection
- **Fix**: Source protection component (already implemented)
- **Verification**: Try right-click, F12, Ctrl+U (should be blocked)

---

## 📝 Key Technical Details

### API Endpoints (v1.0.5)

- `GET /api/version` - Get application version
- `POST /api/files/store` - Store uploaded file
- `GET /api/files/list` - List all stored files
- `DELETE /api/files/delete` - Delete stored file
- `GET /api/health/cache` - Cache cleanup status
- `POST /api/health/cache` - Trigger cache cleanup
- `POST /api/keys/validate` - Validate API keys
- `POST /api/te/config/validate` - Validate Check Point TE key
- `GET /api/keys/values` - Get key values (Project ID, Endpoint)

### Storage Locations

- **API Keys**: `.secure-storage/api-keys.enc` (encrypted)
- **Check Point TE Key**: `.secure-storage/checkpoint-te-key.enc` (encrypted)
- **PIN Hash**: `.secure-storage/verification-pin.hash`
- **Uploaded Files**: `.storage/` directory
- **System Logs**: `.secure-storage/system-logs.json`

### Environment Variables

- `OPENAI_API_KEY` - OpenAI API key (optional, can use Settings UI)
- `LAKERA_API_KEY` - Lakera AI API key (optional, can use Settings UI)
- `LAKERA_PROJECT_ID` - Lakera Project ID (optional, can use Settings UI)
- `CHECKPOINT_TE_API_KEY` - Check Point TE API key (optional, can use Settings UI)
- `API_KEYS_ENCRYPTION_KEY` - Encryption key for API keys storage
- `CHECKPOINT_TE_ENCRYPTION_KEY` - Encryption key for TE key storage

---

## 🔍 Debugging Commands

### Check Version
```bash
curl http://localhost:3000/api/version
cd /home/adminuser/secure-ai-chat && node -p "require('./package.json').version"
```

### Check API Keys
```bash
curl http://localhost:3000/api/keys
curl http://localhost:3000/api/te/config
ls -la .secure-storage/
```

### Check Files
```bash
curl http://localhost:3000/api/files/list
ls -la .storage/
```

### Check Service
```bash
sudo systemctl status secure-ai-chat
sudo journalctl -u secure-ai-chat -n 50
```

### Check Git Status
```bash
cd /home/adminuser/secure-ai-chat
git branch --show-current
git log --oneline -5
```

---

## 📚 Documentation Files

### Version 1.0.5
- `API_KEYS_PERSISTENCE.md` - Key persistence guide
- `SECURE_UPDATE_GUIDE_v1.0.5.md` - Secure update instructions
- `PRODUCTION_VERIFICATION_COMMANDS.md` - Verification commands
- `USER_GUIDE.md` - Comprehensive user guide
- `CURL_UPGRADE_COMMAND_v1.0.5.md` - CURL upgrade commands

### Version 1.0.4
- `docs/SAFETY_AUDIT.md` - Production safety audit
- `docs/HARDENING_CHANGES.md` - Hardening changes
- `docs/THEME_SYSTEM.md` - Theme system documentation
- `RELEASE_NOTES_v1.0.4.md` - Release notes
- `V1.0.4_ENHANCEMENTS.md` - Enhancement details

---

**Last Updated**: January 2026  
**Current Version**: 1.0.6  
**Maintained For**: Troubleshooting and bug fix reference
