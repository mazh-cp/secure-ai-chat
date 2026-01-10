# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
