# Canonical Commands Reference

This document lists all available npm scripts and their purposes.

## Development

```bash
npm run dev          # Start development server on 0.0.0.0:3000
```

## Code Quality

```bash
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type check (alias: type-check)
npm run check        # Run typecheck + lint
npm run format       # Format code with Prettier
npm run format:check # Check code formatting (CI-friendly)
```

## Build & Deploy

```bash
npm run build        # Production build
npm run start        # Start production server
```

## Security

```bash
npm run check:secrets    # Check for ThreatCloud API key leakage to client
npm run verify-security  # Verify key security (if available)
```

## Validation

```bash
npm run validate:v1.0.10 # Validate v1.0.10 features are not revoked
```

## Validation

```bash
npm run validate:v1.0.10 # Validate v1.0.10 features are not revoked
```

## Release & Validation

```bash
npm run release-gate     # Run full release gate validation (pre-deployment)
npm run smoke           # Run smoke tests (if available)
npm run validate-env    # Validate environment configuration
```

## Testing

```bash
npm test            # Run tests (currently: no tests configured)
npm run smoke       # Run smoke tests (if available)
```

## Utility

```bash
npm run check:node      # Verify Node.js version matches requirement
npm run check:ci        # CI-friendly check (typecheck + lint + format check)
```

## Command Aliases

- `typecheck` = `type-check` (both run `tsc --noEmit`)

## Release Gate

The release gate (`npm run release-gate`) runs:

1. Repository sanity checks
2. Clean install
3. TypeScript type check
4. ESLint check
5. Security: Client-side key leakage check
6. Production build
7. Security: Build output check
8. **v1.0.10 Feature Validation** (NEW)
9. Secret leakage scan

See [RELEASE.md](../RELEASE.md) for detailed information.
