# Changelog

All notable changes to this project will be documented in this file.

## [1.0.11] - 2026-01-16

### Added
- **Azure OpenAI Support**: Full integration with Azure OpenAI endpoints
  - Added Azure OpenAI API key and endpoint configuration in Settings
  - Provider selector on Chat page to switch between OpenAI and Azure OpenAI
  - Automatic endpoint and header handling for Azure OpenAI API calls
  - Support for Azure OpenAI deployments with custom endpoints
  - Provider preference stored in localStorage for persistence
  - Seamless switching between OpenAI and Azure OpenAI without changing core application functionality
  - Azure OpenAI credential validation endpoint (`/api/health/azure-openai`)
  - Real-time validation button in Settings page for Azure OpenAI credentials
  - Automatic model selection (gpt-4o-mini) when switching to Azure provider
  - Predefined Azure-compatible models list (gpt-4o-mini, gpt-4o, gpt-4, gpt-4-turbo)
  - Enhanced error messages for Azure-specific issues (deployment not found, backend unavailable, etc.)
- **Check Point WAF Integration**: Enterprise-grade Web Application Firewall integration
  - Middleware for capturing request metadata and security events
  - WAF logs API endpoint (`/api/waf/logs`) for Check Point WAF consumption
  - WAF health check endpoint (`/api/waf/health`) for monitoring
  - Support for Check Point WAF-specific headers and IP detection
  - Security event logging for blocked requests and threat detection
  - CSV and JSON export formats for log analysis
  - Optional authentication for WAF endpoints (via `WAF_AUTH_ENABLED` and `WAF_API_KEY`)
  - Comprehensive filtering options (by level, service, time range, IP, endpoint, etc.)

### Fixed
- **API Parameter Update**: Fixed `max_completion_tokens` parameter error for GPT-5.x models
  - Changed `max_completion_tokens` to `max_output_tokens` to match updated API specification
  - Updated parameter normalization in AI adapter for Responses API
  - Resolves "Unsupported Parameter, 'max_completion_tokens' in the response API" errors
  - Fixes production errors when using GPT-5.x models with token limits
- **Check Point TE File Upload Error**: Fixed `TypeError: formDataStream is not async iterable` error in Check Point TE file upload route
  - Replaced manual stream handling with `form-data` package's built-in `getBuffer()` method
  - Simplified buffer conversion approach (reduced from 49 lines to 3 lines)
  - Resolves runtime errors when uploading files to Check Point TE API
  - Fixes "Failed to execute error" messages when scanning files
- **Azure OpenAI "No Suitable backend" Error**: Fixed backend routing issues with Azure OpenAI
  - Updated API version from `2024-10-21` to `2025-04-01-preview` (matching Azure OpenAI SDK)
  - Enhanced error detection for "No Suitable backend" errors
  - Improved error messages with specific troubleshooting guidance
  - Better handling of deployment name mismatches and capacity issues
- **Azure OpenAI Key Detection**: Fixed issue where Azure OpenAI keys weren't detected after saving
  - Updated `/api/keys/retrieve` endpoint to return Azure OpenAI keys
  - Fixed ChatInterface to properly load and validate Azure OpenAI credentials
  - Improved key status indicators in Settings page
- **Chat Page Accessibility**: Fixed blocking behavior when one provider has invalid keys
  - Chat page now accessible if at least one provider has valid keys
  - Provider selector always visible to allow switching between providers
  - Non-blocking error messages with suggestions to switch providers
  - Message input disabled only for the currently selected provider if keys are missing
  - RAG functionality works with whichever provider is functional

### Improved
- **API Keys Management**: Enhanced storage and retrieval of Azure OpenAI credentials
  - Azure OpenAI keys stored securely server-side with encryption
  - Support for environment variables (AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT)
  - Validation of Azure OpenAI endpoint URLs
  - Status indicators for Azure OpenAI configuration
  - Real-time validation with detailed error messages
  - Deployment name verification in validation endpoint
- **AI Adapter**: Enhanced model-agnostic adapter for multiple providers
  - Unified interface for OpenAI and Azure OpenAI API calls
  - Automatic endpoint selection based on provider
  - Proper header handling (Bearer token for OpenAI, api-key for Azure OpenAI)
  - Updated to use `2025-04-01-preview` API version for Azure OpenAI (matching SDK standards)
  - Enhanced network error handling with specific Azure troubleshooting guidance
  - Better error parsing for non-JSON responses
  - Backward compatible with existing OpenAI configurations
- **Settings Page UI**: Improved layout and user experience
  - Two-column responsive layout for better organization
  - Verification PIN section moved to bottom of page
  - Azure OpenAI validation button with real-time feedback
  - Clear status indicators for all API keys
  - Better visual hierarchy and reduced scrolling
- **Provider Switching**: Enhanced provider selection and model management
  - Provider selector always visible (even if one provider has no keys)
  - Visual indicators showing which providers are configured
  - Automatic model selection when switching providers
  - GPT-5 models blocked for Azure (not supported)
  - Clear error messages with provider switching suggestions
- **Rate Limiting**: Comprehensive rate limiting system to prevent API quota exhaustion
  - In-memory sliding window rate limiter for API calls
  - Model-specific rate limits (GPT-4: 100/min, GPT-4o: 200/min, GPT-5: 50/min)
  - Azure OpenAI support with higher default limits (300/min)
  - Automatic rate limit checking before API calls
  - Proper error handling with Retry-After headers (429 status)
  - Rate limit status tracking and monitoring
- **Token Limit Validation**: Model-specific token limit validation and management
  - Token counting/estimation utility (~4 chars per token approximation)
  - Model-specific context window limits (GPT-4: 8K-128K, GPT-5: 128K)
  - Automatic token validation before API calls
  - Intelligent message truncation when limits are exceeded
  - 10% safety buffer to prevent edge cases
  - Clear error messages with suggestions for resolution
  - Support for all GPT-4 and GPT-5 model variants
- **Error Handling**: Enhanced error handling for rate limits and token limits
  - Specific error types for rate limit (429) and token limit (400) errors
  - User-friendly error messages with actionable suggestions
  - Automatic detection of rate limit errors from API responses
  - Proper HTTP status codes and Retry-After headers
  - Logging of rate limit and token limit violations

## [1.0.10] - 2026-01-13

### Added
- **Enhanced RAG (Retrieval Augmented Generation) System**: Automatic file indexing and intelligent content search
  - Files are automatically indexed when uploaded (no manual configuration needed)
  - Chat client automatically searches uploaded files before using general LLM knowledge
  - Improved content matching algorithm for data/PII queries
  - System message informs LLM about available files and search instructions
  - Enhanced file context formatting with clear file separation
  - Increased file size limit from 5MB to 10MB for RAG processing
  - Increased file count limit from 3 to 5 most relevant files
  - Better handling of large files with intelligent truncation
  - Fallback inclusion for safe files even when keywords don't match
  - Support for CSV, JSON, and TXT files with automatic data file detection

### Improved
- **File Access Control**: More inclusive file filtering for RAG
  - Files with `pending` or `not_scanned` status are now included (only explicitly flagged/malicious files excluded)
  - Better security balance between safety and usability
  - Clear distinction between safe files and malicious files
- **Content Matching**: Enhanced algorithm for finding relevant files
  - Automatic detection of data files (CSV, JSON, TXT)
  - Recognition of data-related queries (users, records, fields, etc.)
  - More lenient keyword matching (words > 2 chars instead of > 3)
  - Intelligent fallback to include safe files when no direct matches found
- **LLM Instructions**: Clear system prompts about file access
  - LLM is explicitly informed about available uploaded files
  - Instructions to search files first, then fall back to general knowledge
  - Requirement to cite source files when providing information
  - Clear instructions for data queries and file analysis

### Fixed
- **File Search Issue**: Fixed chat client not finding uploaded files
  - Previously, chat would say "please upload files" even when files were uploaded
  - Now automatically searches all safe uploaded files
  - Better handling of files with various scan statuses

## [1.0.9] - 2026-01-13

### Added
- **API Errors & Key Failures Section in Logs**: Dedicated section in Logs viewer showing all API errors and key failures with full error details
  - Highlights key failures (401/403) with troubleshooting tips
  - Shows full error messages, response bodies, and stack traces
  - Filters logs by API failures, errors, and HTTP status codes >= 400
  - Visual indicators (🔑 for key failures, 🚫 for access denied, ❌ for other errors)
  - Expandable system details including endpoints, request IDs, and response bodies
- **Dynamic Release Notes**: Release notes page now dynamically loads from CHANGELOG.md via API endpoint
  - Automatically includes all release notes from CHANGELOG.md
  - No need to manually update release notes page when adding new versions
  - API endpoint (`/api/release-notes`) parses CHANGELOG.md and returns structured data
  - Loading and error states for better UX
- **Lakera Guard API v2 Enhancements**: Full support for official Lakera Guard API v2 specification
  - Added `payload` field extraction (detected threats with locations)
  - Added `breakdown` field extraction (detector results)
  - Enhanced UI to display payload and breakdown data in chat messages, file scans, and system logs
  - Improved threat reporting with exact text positions and detector information
  - Console logging for debugging payload and breakdown data

### Improved
- **Logs Viewer**: Enhanced with dedicated API errors section showing full error details and key failure troubleshooting
  - Better visibility into API failures and authentication issues
  - Comprehensive error information for debugging
  - Key failure detection with actionable troubleshooting tips
- **Release Notes**: Now automatically syncs with CHANGELOG.md, ensuring all versions are always up-to-date
  - Eliminates manual synchronization between CHANGELOG.md and release notes page
  - Single source of truth for version history
  - Automatic parsing and formatting of changelog entries

## [1.0.8] - 2026-01-13

### Added
- **Ubuntu VM Installation Script** (`scripts/install_ubuntu_public.sh`): Single-step installation script for fresh Ubuntu VM deployments
  - Installs system dependencies, Node.js LTS 20.x, clones repository
  - Auto-detects free port starting from 3000 (avoids EADDRINUSE errors)
  - Creates dedicated user (`secureai`) and installs under `/opt/secure-ai-chat`
  - Configures systemd service for auto-start and management
  - Sets up nginx reverse proxy on port 80
  - Configures UFW firewall (SSH + Nginx)
  - Performs smoke checks after installation
  - Idempotent: safe to re-run for updates/repairs
- **Safe Remote Upgrade Script** (`scripts/upgrade_remote.sh`): Safely upgrades remote installations to latest version
  - Automatically backs up all settings before upgrade (`.env.local`, `.secure-storage/`, `.storage/`)
  - Preserves all configurations during upgrade
  - Verifies upgrade success with version and health checks
  - Rollback capability via backup
- **Cleanup/Reset Script** (`scripts/cleanup_reset_vm.sh`): Safely removes application, services, and nginx configuration
- **Git Repository Fix Script** (`scripts/fix_git_repo.sh`): Fixes corrupted or missing `.git` repository in installation directory
- **CLI Script to Set API Keys** (`scripts/set-api-keys.sh`): Set API keys via command line
  - Supports all keys: OpenAI, Lakera AI, Lakera Project ID, Lakera Endpoint, Check Point TE
  - Interactive mode for easy key entry
  - Works with local and remote servers
  - Uses existing API endpoints (no application changes)
- **Installation Documentation** (`docs/INSTALL_UBUNTU_VM.md`): Comprehensive guide for Ubuntu VM installation
- **Upgrade Documentation** (`docs/UPGRADE_REMOTE.md`): Safe remote upgrade process
- **API Endpoints Documentation** (`docs/API_ENDPOINTS_FOR_SECURITY.md`): Recommended API endpoints for security configuration
- **CLI API Keys Documentation** (`docs/CLI_API_KEYS.md`): CLI usage guide
- **Merge Safety Reports**: Detailed verification and risk assessment reports
- **API Errors & Key Failures Section in Logs**: Dedicated section in Logs viewer showing all API errors and key failures with full error details
  - Highlights key failures (401/403) with troubleshooting tips
  - Shows full error messages, response bodies, and stack traces
  - Filters logs by API failures, errors, and HTTP status codes >= 400
- **Dynamic Release Notes**: Release notes page now dynamically loads from CHANGELOG.md via API endpoint
  - Automatically includes all release notes from CHANGELOG.md
  - No need to manually update release notes page when adding new versions
  - API endpoint (`/api/release-notes`) parses CHANGELOG.md and returns structured data
- **Lakera Guard API v2 Enhancements**: Full support for official Lakera Guard API v2 specification
  - Added `payload` field extraction (detected threats with locations)
  - Added `breakdown` field extraction (detector results)
  - Enhanced UI to display payload and breakdown data in chat, files, and logs
  - Improved threat reporting with exact text positions and detector information

### Fixed
- **Git Repository Issues**: Fixed "fatal: not a git repository" errors on remote installations
- **Upgrade Process**: Fixed 404 errors when downloading upgrade scripts from wrong branch
- **Port Conflicts**: Auto-detection of free ports prevents EADDRINUSE errors

### Improved
- **README.md**: Added "Quick Install (Ubuntu VM)" and "Reset/Cleanup" sections
- **Port Auto-Detection**: Installation script automatically finds free port starting from 3000
- **Idempotent Installation**: Installation script can be safely re-run
- **Documentation**: Comprehensive guides for installation, upgrade, and CLI usage
- **Logs Viewer**: Enhanced with dedicated API errors section showing full error details and key failure troubleshooting
- **Release Notes**: Now automatically syncs with CHANGELOG.md, ensuring all versions are always up-to-date

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
- **GPT-5.x Support**: Full support for GPT-5.x models with automatic API migration
  - Model-agnostic adapter (`lib/aiAdapter.ts`) for unified LLM calls
  - Automatic API selection (Responses API for GPT-5.x, Chat Completions for GPT-4)
  - Message normalization (messages[] to single input for GPT-5.x)
  - Token parameter conversion (`max_tokens` to `max_completion_tokens`)
  - Runtime auto-fallback (GPT-5.2 → GPT-5.1 → GPT-4o)
- **Release Gate System**: Comprehensive pre-deployment validation
  - Strict PASS/FAIL checklist for all deployments
  - Automated release gate script (`npm run release-gate`)
  - Single copy/paste release command pack
  - Security scans (client-side key leakage, build output, git history)
  - Complete command documentation in RELEASE.md
- **Security Verification Script**: Automated script to verify key security (`npm run verify-security`)
  - Checks .gitignore configuration
  - Verifies no keys in git repository
  - Validates file permissions
  - Scans for hardcoded API keys
- **Installation Validation Script**: Comprehensive installation validation (`scripts/validate-installation.sh`)
  - Build & type check validation
  - Key storage configuration verification
  - Persistent storage validation
  - Application server status checks
  - API key storage & retrieval verification

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
- **TypeScript Errors**: All type errors resolved
- **ESLint Errors**: All critical errors fixed (only expected warnings remain)

### Improved
- **Key Deletion**: Enhanced with proper server-side cache invalidation
- **Status Synchronization**: Better sync between Settings and Files pages
- **System Prompt**: Updated to allow data queries from uploaded files
- **Error Handling**: Enhanced error messages and recovery
- **Documentation**: Comprehensive security and upgrade documentation
- **File Upload Stability**: Enhanced concurrency control with error isolation
  - Sequential file processing to prevent event loop blocking
  - 100ms delay between files to prevent overwhelming system
  - Proper error isolation (one failure doesn't block others)
- **Logging Security**: Authorization header and API key redaction in system logs
  - Automatic redaction of Authorization headers (first 30 chars only)
  - API key pattern redaction in request/response bodies
  - Header redaction for any header containing "api-key" or "apikey"

### Security
- **Key Security Verification**: Confirmed all API keys excluded from git
- **Persistence Verification**: Confirmed keys persist across restarts and upgrades
- **File Permissions**: Verified correct permissions (700/600) on storage files
- **Client-Side Key Leakage Prevention**: 
  - ESLint rule blocks `checkpoint-te` and `api-keys-storage` imports in client components
  - Check Point TE API key never reaches client (server-side only)
  - `checkpointTeKey` state cleared immediately after save (never persisted)
  - All TE operations use server-side API routes (`/api/te/*`)
- **Release Gate Security Scans**: Automated security checks in release gate
  - Client-side key leakage detection
  - Build output scan for API keys
  - Git history scan for secrets
  - Hard-gate failure on any security violation

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
