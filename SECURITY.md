# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please send an email to the maintainers with the following information:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact and severity
- Suggested fix (if any)

We will acknowledge receipt of your report within 48 hours and provide a detailed response within 7 days indicating the next steps in handling your report.

After the vulnerability has been addressed, we will credit you (if desired) in our security acknowledgments.

## API keys and cloning from GitHub

**Pulling or upgrading from this repository does not give you anyone else’s OpenAI, Anthropic, or Lakera keys.** The public repo contains only application source and configuration templates.

### What stays on your machine (never in git)

- **Environment files**: `.env`, `.env.local`, `.env.*` (except `.env.example`) are listed in `.gitignore`.
- **Encrypted key store**: `.secure-storage/` (e.g. `api-keys.enc`, Check Point TE key material) is **gitignored**. Keys saved via the Settings UI are written here on the server, not to the repo.
- **Uploads and local DB**: `.storage/`, `data/` are gitignored.

### What the repo may contain

- **`.env.example`** — placeholder variable names only; all real secrets are commented out. Copy to `.env.local` and fill in locally; never commit that file.
- **No `NEXT_PUBLIC_*` secrets** — Only `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_APP_VERSION` are treated as safe for the browser. The app warns if other `NEXT_PUBLIC_` vars look like secrets (see `lib/env-validation.ts`).

### Server API behavior

- **`GET /api/keys/retrieve`** returns **configured / not configured** and non-secret metadata (e.g. default Lakera URL). It does **not** return raw API key strings.
- **Provider keys** for chat and Lakera are loaded server-side from encrypted storage and/or environment variables; they are not bundled for the client. ESLint blocks importing server-only key modules from client components (`check-no-client-secrets` in CI).

### Checks you can run locally

```bash
npm run check:secrets   # client import gate + git-tracked file leak patterns
```

If you ever committed a real key, **rotate it** at the provider and remove it from git history (e.g. `git filter-repo` or GitHub support); assume compromise.

## Security Best Practices

When using this application:

1. **Never commit API keys or secrets** — Use `.env.local` and/or the Settings UI (server encrypted storage).
2. **Run `npm run check:secrets` before push** — Catches forbidden client imports and obvious `sk-…` tokens in tracked files.
3. **Keep dependencies updated** — `npm audit` and `npm run build:fresh` for release builds.
4. **Use HTTPS in production** — HSTS is enabled in production via `next.config.js`.
5. **Set `API_KEYS_ENCRYPTION_KEY`** in production — Improves encryption-at-rest for `.secure-storage/` (see deployment docs).
6. **Review logs** — Do not log full request bodies containing user secrets; production Lakera debug detail is restricted.

## Known Security Considerations

- **Optional client fallback** — Some API routes may merge **server** keys with optional client-supplied key fields for backward compatibility. Prefer configuring keys only on the server (Settings or env) so keys are not sent from the browser.
- **Encryption key** — Without `API_KEYS_ENCRYPTION_KEY`, a deterministic fallback is used (see `lib/api-keys-storage.ts`); set a strong env secret in production.
- **Rate limiting** — Add edge or reverse-proxy rate limits for production exposure.
- **Authentication** — Optional app login (`SECURE_CHAT_LOGIN_PASSWORD`); harden and monitor as needed for your deployment.

See `PRODUCTION_KEY_SECURITY.md` and the main `README.md` for storage layout and upgrade backup behavior (`.secure-storage` is preserved across VM upgrades, not re-fetched from GitHub).
