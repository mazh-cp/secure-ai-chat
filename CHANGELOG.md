# Changelog

All notable changes to this project will be documented in this file.

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
