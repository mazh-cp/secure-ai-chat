/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.3.1'

export const RELEASE_DATE = '2026-10-13'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.3.1]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      '**Extended Anthropic model coverage** — 13 Claude models across Claude 5 (Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.1), Claude 4 (Opus 4.5, Sonnet 4.5, Sonnet 4 May 2025), Claude 3.7 Sonnet, Claude 3.5 (Sonnet, Haiku) and Claude 3 (Opus, Sonnet, Haiku).',
      '**200k context window for all Claude models** — explicit entries in `lib/token-counter.ts` so new model IDs never fall back to the 8,192-token default.',
      '**Lakera Guard `/v2/guard/results` support** — `POST /api/lakera/results` for calibration and detector-confidence overlays, with input validation (max 32 messages, 120k chars per message).',
    ],
  },
  {
    title: 'Changed',
    items: [
      '**RAG only for lookup questions** — uploaded-file context is retrieved only for lookups such as "who is taking cholesterol medication" or "which patients…". General questions such as "what is cholesterol" get a model-only answer (`lib/rag-intent.ts`).',
      '**Default Anthropic model** is now `claude-sonnet-5-5`; Anthropic models are listed newest-first.',
      '**Lower Lakera usage** — retrieved RAG chunks are scanned in batches instead of one Guard call per chunk, and text already scanned (RAG chunks in the chat input scan, uploads at RAG indexing) is not sent to Guard twice.',
    ],
  },
  {
    title: 'Fixed',
    items: [
      '**GPT-5.x and o-series models** — `temperature` is no longer sent (these models reject it), with a retry without it for any OpenAI/Azure model that reports it unsupported. Responses API text is now read from `output[].content[]`.',
      '**Lakera 429 handling** — transient rate limits are retried (up to 2 times, `Retry-After` capped at 2s). Quota exhaustion (`ErrQuotaExceeded`) is not retried and is reported as "Lakera usage limit reached" instead of "Security scan unavailable (429)".',
      '**Chat labels** — Guard outages show "Security scan unavailable" instead of "Threat detected".',
    ],
  },
  {
    title: 'Security',
    items: [
      '**Central API session gate** — every `/api/*` route now requires a session except health, version, release notes, the login flow and `/api/waf/health`. 27 routes previously had no check, including `POST /api/keys`.',
      '**Login required in production** — without `SECURE_CHAT_LOGIN_PASSWORD`, API routes return 503 "Login not configured" and the UI shows a setup notice. `ALLOW_UNAUTHENTICATED=1` is an explicit opt-out for network-restricted hosts.',
      '**No hardcoded session secret** — the built-in HMAC fallback is removed; sessions use `SECURE_CHAT_AUTH_SECRET` or the login password.',
      '**Fail-closed preserved** — when Lakera is unavailable or out of quota, chat and uploads are still blocked; flagged RAG batches are rescanned per chunk so only the offending chunk is dropped.',
      '**Upload scan reuse is exact** — RAG indexing skips its Guard call only when the text matches a SHA-256 of what the upload scan passed as safe; truncated (>50k chars) and binary files are always rescanned.',
      '**All prior controls unchanged** — injection guardrails, rate limiting, security headers (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS in production) and Check Point TE/WAF integrations.',
    ],
  },
]
