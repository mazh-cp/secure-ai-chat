/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.1.14'

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

/** Release notes for current version (matches CHANGELOG.md [1.1.14]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      '**Extended Anthropic model coverage** — 13 Claude models now registered across Claude 5 (Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.1), Claude 4 (Opus 4.5, Sonnet 4.5, Sonnet 4 May 2025), Claude 3.7 Sonnet, Claude 3.5 (Sonnet, Haiku), and Claude 3 (Opus, Sonnet, Haiku).',
      '**200k context window for all Claude models** — explicit token-limit entries in `lib/token-counter.ts` ensure new model IDs never fall through to the 8 192-token default.',
      '**Lakera Guard `/v2/guard/results` support** — new `POST /api/lakera/results` route with input validation (max 32 messages, 120 k chars/message) for calibration and UI detector-confidence overlays.',
      '**`resolveLakeraGuardResultsEndpoint()`** — derives the `/v2/guard/results` URL from the configured Guard base URL without additional env vars.',
    ],
  },
  {
    title: 'Changed',
    items: [
      '**Default Anthropic model** updated from `claude-3-5-sonnet-20241022` → `claude-sonnet-5-5` in `lib/aiAdapter.ts`.',
      '**Model list ordering** — Anthropic models listed newest-first for better UX in the model picker.',
    ],
  },
  {
    title: 'Security',
    items: [
      '**Lakera results route gated** — `POST /api/lakera/results` requires `requireSecureChatSession`; message count and per-message character limits enforced before any upstream call.',
      '**All prior security controls preserved** — injection guardrails, role restrictions, security headers (CSP, X-Frame-Options, HSTS in production), and Check Point TE/WAF/DLP integrations unchanged.',
    ],
  },
]
