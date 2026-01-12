# Changelog

All notable changes to this project will be documented in this file.

## [1.0.7] - 2026-01-12

### Added
- **Release Notes Page**: New dedicated page for viewing version history and changelog
  - Accessible from Settings page and navigation sidebar
  - Displays version history with categorized changes (Added, Fixed, Improved, Security)
  - Shows current application version
  - Beautiful UI with version badges and type indicators
- **RAG (Retrieval Augmented Generation)**: Chat can now access and answer questions about uploaded files
  - Automatic file content retrieval based on user queries
  - Supports CSV, JSON, and text files
  - Smart content matching and excerpt generation for large files
  - Controlled by "RAG Scan" toggle on Files page
- **Security Verification Script**: Automated script to verify key security (`npm run verify-security`)
  - Checks .gitignore configuration
  - Verifies no keys in git repository
  - Validates file permissions
  - Scans for hardcoded API keys

### Fixed
- **File Scanning Error**: Fixed "Failed to execute 'json' on 'Response'" error for large files
  - Response cloning to avoid stream consumption issues
  - Better error handling for files with 500+ individuals
- **Navigation Issue**: Fixed sidebar navigation - sidebar now always visible on desktop
  - Desktop users can always access navigation links
  - Mobile users can toggle sidebar with hamburger menu
  - Auto-close sidebar on mobile after navigation
- **Checkpoint TE Status**: Fixed status not updating after key save
  - Added 200ms delay before status refresh
  - Periodic status checking in Files page (every 5 seconds)
  - Automatic toggle enable when key is configured
- **Webpack Chunk Errors**: Fixed "Cannot find module" errors
  - Proper cache clearing and rebuild process
  - Fresh dev server startup

### Improved
- **Key Deletion**: Enhanced with proper server-side cache invalidation
- **Status Synchronization**: Better sync between Settings and Files pages
- **System Prompt**: Updated to allow data queries from uploaded files
- **Error Handling**: Enhanced error messages and recovery
- **Documentation**: Comprehensive security and upgrade documentation

### Security
- **Key Security Verification**: Confirmed all API keys excluded from git
- **Persistence Verification**: Confirmed keys persist across restarts and upgrades
- **File Permissions**: Verified correct permissions (700/600) on storage files

## [1.0.6] - 2026-01-12

### Added
- Checkpoint TE (Threat Emulation) integration
- Server-side API key storage with encryption
- PIN verification for sensitive operations

### Fixed
- Form-data stream handling in Checkpoint TE upload
- Key deletion with proper cache invalidation

## [1.0.5] - 2025-01-10

### Added
- **OpenAI Model Selector**: Users can now select different OpenAI models from a dropdown list on the Chat page
  - Model dropdown displays available GPT models based on configured API key
  - Dynamic model list fetched from OpenAI API
  - Model preference persisted in localStorage
  - Model names formatted for readability (e.g., "GPT-4o Mini", "GPT-4o")
  - Models sorted with newest first
  - Secure validation (only gpt-* models allowed)
  - Default model: `gpt-4o-mini`
- **New API Route**: `/api/models` - Fetches available OpenAI models
- **New Component**: `ModelSelector` - Dropdown component for model selection

### Changed
- **Chat API**: Enhanced to accept and use selected model parameter
- **ChatInterface**: Integrated ModelSelector component above chat messages

### Fixed
- **Settings Page - Save Keys Button**: Fixed button not visible in light mode
  - Changed from invalid `var(--primary)` to `rgb(var(--accent))` for proper theme support
  - Button now clearly visible in both light and dark modes
- **Settings Page - Lakera Project ID**: Made Project ID field visible (text input instead of password)
  - Added helpful message about policy verification
  - Current Project ID displayed when configured

### Technical
- Updated version to 1.0.5
- All new features styled with UniFi theme tokens
- Maintained backward compatibility


The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] - 2026-01-XX

### Added
- **UniFi-Style Day/Night Theme System**: Complete theme system with instant switching, no flash on load
  - Light and dark themes with neutral-first palette and single accent color
  - CSS variable-based design tokens for maintainability
  - Theme toggle component with system preference support
  - Bootstrap script prevents theme flash on initial load
- **Status Dots Enhancement**: Visual status indicators for toggles and API key configuration
  - Green dots for enabled/configured states
  - Red dots for disabled/unconfigured states
  - Subtle glow effects for better visibility
- **Source Protection**: Enhanced security to prevent casual source code viewing
  - Disabled right-click context menu
  - Disabled keyboard shortcuts (F12, Ctrl+U, Ctrl+Shift+I, etc.)
  - Disabled text selection (except form fields)
  - Disabled image dragging
- **Production Safety Audit**: Comprehensive pre-flight safety audit
  - `docs/SAFETY_AUDIT.md` - Complete audit of runtime entrypoints and production paths
  - `docs/HARDENING_CHANGES.md` - Documentation of all hardening changes
  - Environment variable validation script (`scripts/validate-env.sh`)
- **Environment Configuration**: 
  - `.env.example` file for documentation
  - `validate-env` npm script for startup checks
- **Package Scripts**:
  - Added `typecheck` alias for `type-check`
  - Added `test` script (placeholder)
  - Added `validate-env` script

### Changed
- **Dockerfile**: Updated Node.js version from `20-alpine` to `25-alpine` to match package.json engines
- **Theme System**: Complete refactor to use CSS variables (design tokens) instead of hard-coded colors
- **Files Page**: Added status dots to Lakera Scan, RAG Auto Scan, and File Sandboxing toggles
- **Settings Page**: Added status dots to API key configuration fields
- **Layout**: Enhanced source protection integration

### Security
- ✅ Source protection component prevents casual code inspection
- ✅ Error boundaries verified to not expose secrets
- ✅ Security headers verified and production-ready
- ✅ Docker, systemd, and Kubernetes configurations hardened
- ✅ Environment variable validation (warns, doesn't fail)

### Documentation
- `docs/SAFETY_AUDIT.md` - Comprehensive production safety audit
- `docs/HARDENING_CHANGES.md` - All hardening changes documented
- `docs/THEME_SYSTEM.md` - Theme system architecture and usage guide
- `.env.example` - Environment variable documentation

### Deployment
- ✅ All entrypoints verified (Next.js, Docker, systemd, Kubernetes)
- ✅ Health check endpoint verified (`/api/health`)
- ✅ Build process verified (TypeScript, ESLint, Next.js build)
- ✅ All package scripts verified (lint, typecheck, test, build, start)
- ✅ Backwards compatibility maintained (all changes are non-breaking)

---

## [1.0.3] - 2026-01-XX

### Added
- **Server-Side Encrypted API Key Storage**: All API keys (OpenAI, Lakera, Check Point TE) now stored server-side with AES-256-CBC encryption
- **Universal Access**: Application works from any browser/device once keys are configured (no per-device setup needed)
- **Comprehensive Security Checks**: Enhanced security validation to prevent API key leakage in code, logs, or client bundles
- **API Keys Management API**: New `/api/keys` endpoints for secure server-side key management
- **Documentation**: Added `SERVER_SIDE_KEY_STORAGE.md` with comprehensive storage architecture documentation
- **Post-Change Validation Report**: Added `POST_CHANGE_VALIDATION_V1.0.3.md` with validation results

### Changed
- **API Routes**: Updated chat and scan routes to prioritize server-side keys over client keys
- **Settings UI**: Settings form now saves keys to server-side encrypted storage instead of localStorage
- **Client Components**: Updated ChatInterface, page.tsx, and files.tsx to load keys from server-side
- **Security Validation**: Enhanced `check-security.sh` to check for all API keys (OpenAI, Lakera, Check Point TE)
- **ESLint Rules**: Added restrictions to prevent client-side imports of `api-keys-storage.ts`
- **Release Gate**: Updated release gate script with comprehensive security checks
- **Version Display**: Updated app version to 1.0.3 in Layout.tsx footer

### Security
- ✅ **No Hardcoded Keys**: Verified no API keys hardcoded in source code
- ✅ **Encrypted Storage**: All keys encrypted at rest with AES-256-CBC
- ✅ **Secure Permissions**: Storage files have 600 permissions (owner read/write only)
- ✅ **PIN Protection**: Key deletion operations require PIN verification
- ✅ **Client-Side Prevention**: ESLint rules prevent accidental client-side key imports
- ✅ **Build Output Scan**: Release gate scans build output for leaked keys
- ✅ **Comprehensive Security Checks**: Enhanced security script checks for all API key types

### Migration
- Automatic migration from localStorage to server-side storage
- Existing keys in localStorage are migrated on first Settings save
- Backward compatibility maintained during transition period

### Documentation
- `SERVER_SIDE_KEY_STORAGE.md` - Comprehensive server-side key storage guide
- `POST_CHANGE_VALIDATION_V1.0.3.md` - Post-change validation report
- Updated security check documentation
- Enhanced release gate documentation

## [1.0.2] - 2026-01-XX

### Added
- **Lakera Telemetry Integration**
  - Automatic log export to Platform.lakera.ai for analytics and monitoring
  - Support for S3 log export (Enterprise feature via Platform.lakera.ai Settings)
  - Custom API telemetry endpoint for real-time analytics
  - Non-blocking telemetry that doesn't affect main application flow
  - Configurable via `LAKERA_TELEMETRY_ENABLED` and `LAKERA_TELEMETRY_ENDPOINT` environment variables

- **Production Upgrade Script**
  - Single-command upgrade script (`upgrade.sh`) for production systems
  - Automatic dependency updates, build, and service restart
  - Environment variable configuration support
  - Rollback capability with commit hash tracking

- **Deployment Verification Script**
  - Post-deployment verification script (`verify-deployment.sh`)
  - Comprehensive health checks and service status validation
  - Git commit hash verification

- **Documentation**
  - `LAKERA_TELEMETRY.md` - Technical API reference for Lakera telemetry
  - `LAKERA_LOGS_SETUP.md` - Complete setup guide for S3 export and API telemetry
  - `UPGRADE.md` - Production upgrade documentation
  - `V1.0.2_RELEASE_NOTES.md` - Release notes

### Enhanced
- **Release Gate Automation**
  - Improved security scan to only check for actual API key patterns (not variable names)
  - Better error handling and validation

- **Lakera Integration**
  - Telemetry automatically sent after each scan (chat input/output, file uploads)
  - Uses Lakera API key and Project ID from Settings
  - Privacy-preserving (only metadata, not full content)

### Fixed
- TypeScript errors in LogViewer and SystemLogViewer (unknown type handling)
- ESLint disable comments (removed invalid rule references)
- Build output security scan false positives (variable names vs actual API keys)

### Documentation
- Updated `README.md` with Lakera telemetry configuration options
- Added upgrade instructions and verification steps
- Enhanced release workflow documentation

---

## [1.0.1] - 2026-01-XX

### Added
- **Check Point ThreatCloud / Threat Emulation (TE) Integration**
  - Server-side only API key storage (encrypted at rest in `.secure-storage/checkpoint-te-key.enc`)
  - File sandbox toggle via Check Point ThreatCloud TE
  - Secure API key management in Settings UI with PIN protection
  - File upload sandboxing with ThreatCloud TE proxy endpoints
  - Polling-based query system with bounded timeouts (60s total, 30 attempts)
  - Comprehensive threat detection with detailed log fields from Check Point R81 documentation

- **PIN Verification System**
  - 4-8 digit PIN for protecting sensitive API key operations
  - PBKDF2 hashing with SHA-512 (100,000 iterations)
  - PIN required for removing Check Point TE API key or clearing any API keys
  - Secure storage in `.secure-storage/verification-pin.hash`

- **System Logging**
  - Server-side system logs for debugging and auditing
  - System Logs section in Dashboard with filtering by level and service
  - Detailed error logging for Check Point TE API failures
  - Request IDs for tracking API interactions

- **Security Hard Gates**
  - ESLint rule preventing `checkpoint-te` imports in client components
  - Automated security audit script (`scripts/check-security.sh`)
  - Build output scan for API key leakage
  - Release gate validation script (`scripts/release-gate.sh`)

- **Release Gate Automation**
  - Pre-deployment validation script with package manager detection
  - Comprehensive validation (lint, type-check, build, security scan)
  - Clear PASS/FAIL output with exit codes
  - Release documentation (`RELEASE.md`)

### Enhanced
- **ThreatCloud Proxy Hardening**
  - Request timeouts: 30s upload, 30s query, 60s polling
  - Capped retries with exponential backoff for transient failures
  - Response validation with schema checks
  - Bounded polling with safe "unknown/pending" fallback
  - User-friendly error messages (no stack traces to client)
  - File size limits: 50 MB enforced on frontend and backend
  - File type validation: `.pdf`, `.txt`, `.md`, `.json`, `.csv`, `.docx`

- **Error Handling**
  - Specific error messages for 400, 401, 403, 502, 504
  - Troubleshooting tips for common errors
  - Graceful degradation when ThreatCloud unavailable
  - Fail-safe behavior (app works fully without Check Point TE configured)

- **Stability & Performance**
  - Non-blocking UI (all operations async)
  - Resource-safe file handling (streams, memory-efficient)
  - Parallel uploads handled independently
  - Restart-safe configuration (persistent encrypted storage)
  - Event-loop safety (no blocking operations)

- **Backwards Compatibility**
  - New settings fields optional with safe defaults
  - Existing users continue to work without migrations
  - No breaking changes to file upload flow
  - Existing Lakera scanning continues to work

### Security
- **API Key Protection**
  - Check Point TE API keys stored server-side only (never in client)
  - Encrypted at rest using AES-256-CBC
  - Environment variable support (`CHECKPOINT_TE_API_KEY`)
  - API keys redacted in logs (only prefixes shown)
  - No API keys in localStorage/sessionStorage/client bundle

- **PIN Protection**
  - All API key clearing operations require PIN (when configured)
  - PIN protection for OpenAI, Lakera AI, Lakera Project ID, Lakera Endpoint, and Check Point TE keys
  - Timing-safe PIN verification (prevents timing attacks)

### Fixed
- Hydration error in ThemeToggleButton (server/client render mismatch)
- Form-data stream handling for Check Point TE uploads
- API base URL corrected to `https://te-api.checkpoint.com/tecloud/api/v1/file`
- Response validation for Check Point TE API responses
- TypeScript type errors in system logging interfaces

### Documentation
- Added `RELEASE.md` with release gate documentation
- Added `RELEASE_GATE_SUMMARY.md` with detailed validation summary
- Added `POST_CHANGE_VALIDATION_REPORT.md` with comprehensive validation report
- Added `FINAL_VALIDATION_CHECKLIST.md` with quick reference checklist
- Updated `README.md` with Release Gate section

---

## [0.1.0] - 2024-XX-XX

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2024-12-XX

### Added
- **UI Theme System**: Complete light/dark mode implementation with semantic color tokens
  - Dark mode: Navy blue backgrounds (#141C2C, #1D2839, #323C4E) with light text (#F0EDF4)
  - Light mode: Light gray/white backgrounds (#F6F7FB, #FFFFFF, #EEF1F7) with dark text (#0F172A)
  - Shared brand accents (#8E61F0, #4E4592) consistent across both modes
  - Safe CSS variable fallbacks to prevent rendering crashes
- **Production Hardening**:
  - React Error Boundary component for graceful error handling
  - General health endpoint (`/api/health`) for service monitoring
  - Automated validation scripts (`npm run check`, `npm run check:ci`)
  - Docker Compose configuration with restart policy and healthcheck
  - Dockerfile with multi-stage build and healthcheck support
  - systemd service file with auto-restart (Restart=always, RestartSec=5)
  - Kubernetes deployment manifest with liveness/readiness probes
- **Documentation**: Production hardening guide with restart verification steps

### Changed
- **UI Colors**: All hard-coded colors replaced with semantic theme tokens
  - Backgrounds, text, and borders now adapt to light/dark mode
  - Improved contrast and readability in both themes
- **Error Handling**: Centralized error boundary prevents full app crashes
- **Build Configuration**: Added standalone output mode for Docker deployments

### Security
- CSS variable fallbacks prevent missing token crashes
- Error boundary prevents sensitive error exposure in production

### Infrastructure
- Health check endpoint for Docker/systemd/Kubernetes monitoring
- Auto-restart policies for all deployment methods
- Production-ready Docker and Kubernetes configurations

## [0.1.0] - 2024-01-08

### Added
- Initial release of Secure AI Chat application
- Next.js 14 App Router implementation
- TypeScript support with full type safety
- Chat interface with OpenAI integration
- File upload and scanning with Lakera AI security
- Security dashboard with real-time monitoring
- Risk mapping and OWASP LLM Top 10 integration
- Settings page for API key configuration
- Dark/light theme support
- Comprehensive logging system
- Security headers configuration
- GitHub Actions CI/CD workflow
- Setup scripts for Unix/Linux/macOS and Windows
- Environment variable management with .env.example
- Prettier code formatting
- ESLint configuration
- Comprehensive documentation (README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT)
- GitHub issue and PR templates
- Dependabot configuration

### Security
- Prompt injection detection and blocking
- Input/output scanning with Lakera AI
- Security headers (HSTS, X-Frame-Options, etc.)
- Pre-scan validation for common attack patterns
- Threat level assessment (low, medium, high, critical)

### Documentation
- Installation and setup instructions
- Production build and deployment guide
- Troubleshooting section
- Environment variables documentation
- Contributing guidelines
- Security policy
- Code of conduct

[0.1.0]: https://github.com/your-username/Secure-Ai-Chat/releases/tag/v0.1.0
