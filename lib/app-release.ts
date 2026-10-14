/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.3.3'

export const RELEASE_DATE = '2026-10-14'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.3.3]) */
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
      '**Uploaded files searched by default** — chat retrieves file context for any question that is not clearly general knowledge. "What is cholesterol", "explain…", "symptoms of…" and greetings get a model-only answer; questions about people, records or the documents ("H1B visa holders", "top 5 highest paid employees", "what is Linda\'s visa status") use the files (`lib/rag-intent.ts`).',
      '**Default Anthropic model** is now `claude-sonnet-5-5`; Anthropic models are listed newest-first.',
      '**Lower Lakera usage** — retrieved RAG chunks are scanned in batches instead of one Guard call per chunk, and text already scanned (RAG chunks in the chat input scan, uploads at RAG indexing) is not sent to Guard twice.',
    ],
  },
  {
    title: 'Fixed',
    items: [
      '**Files hidden from chat after a Lakera outage** — an upload scan that failed because Lakera was unavailable or out of quota was saved as `flagged` (a threat), so chat skipped the file permanently. It is now saved as `error` ("scan unavailable"); the content is still scanned, fail-closed, at indexing and per chunk at retrieval.',
      '**Missing file answers** — the 1.3.1 question filter only retrieved for a fixed list of lookup phrasings and skipped ordinary file questions; it now only excludes clear general-knowledge questions.',
      '**Diagnostics** — each chat logs a `[chat RAG]` line with counts only (files visible, indexed, flagged, chunks sent to the model), and retrieval/ingestion scans now log Lakera quota errors with the `ErrQuotaExceeded` marker.',
      '**GPT-5.x and o-series models** — `temperature` is no longer sent (these models reject it), with a retry without it for any OpenAI/Azure model that reports it unsupported. Responses API text is now read from `output[].content[]`.',
      '**Lakera 429 handling** — transient rate limits are retried (up to 2 times, `Retry-After` capped at 2s). Quota exhaustion (`ErrQuotaExceeded`) is not retried and is reported as "Lakera usage limit reached" instead of "Security scan unavailable (429)".',
      '**Chat labels** — Guard outages show "Security scan unavailable" instead of "Threat detected".',
    ],
  },
  {
    title: 'Security',
    items: [
      '**No app login required** — chat, files, Dashboard and Settings open without a login (the 1.3.1 production login requirement is removed). The optional login still applies to every non-public API route when `SECURE_CHAT_LOGIN_PASSWORD` is provided.',
      '**PIN to replace or delete stored credentials** — when a verification PIN is set, the server requires it to replace or delete an existing API key, Lakera project ID, Lakera/Azure endpoint or Check Point TE key. Adding a value for the first time needs no PIN. Settings opens the PIN dialog and retries the save.',
      '**PIN attempt limiting** — 5 wrong PINs from one client lock that client out for 15 minutes (HTTP 429), with a global ceiling of 25 failures per 15 minutes.',
      '**No hardcoded session secret** — the built-in HMAC fallback is removed; sessions use `SECURE_CHAT_AUTH_SECRET` or the login password.',
      '**Fail-closed preserved** — when Lakera is unavailable or out of quota, chat and uploads are still blocked; flagged RAG batches are rescanned per chunk so only the offending chunk is dropped.',
      '**Upload scan reuse is exact** — RAG indexing skips its Guard call only when the text matches a SHA-256 of what the upload scan passed as safe; truncated (>50k chars) and binary files are always rescanned.',
      '**All prior controls unchanged** — injection guardrails, rate limiting, security headers (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS in production) and Check Point TE/WAF integrations.',
    ],
  },
]
