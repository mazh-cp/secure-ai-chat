/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.3.2'
export const RELEASE_DATE = '2026-10-13'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'Extended Anthropic model coverage — 13 Claude models across the Claude 5, 4, 3.7, 3.5 and 3 families.',
      '200k context window registered for all Claude models.',
      'Lakera Guard /v2/guard/results support via POST /api/lakera/results.',
    ],
  },
  {
    title: 'Changed',
    items: [
      'Uploaded files are searched only for lookup questions (e.g. "who is taking cholesterol medication"); general questions get a model-only answer.',
      'Default Anthropic model is claude-sonnet-5-5; Anthropic models listed newest-first.',
      'Lower Lakera usage: batched RAG scans and no duplicate scans of the same text.',
    ],
  },
  {
    title: 'Fixed',
    items: [
      'GPT-5.x and o-series models no longer fail with "temperature is not supported".',
      'Brief Lakera rate limits are retried; an exhausted Lakera quota is reported clearly.',
      'Lakera outages are labelled "Security scan unavailable" instead of "Threat detected".',
    ],
  },
  {
    title: 'Security',
    items: [
      'No app login required; the optional login still covers every API route when it is configured.',
      'With a verification PIN set, replacing or deleting an existing API key, project ID, endpoint or TE key requires the PIN.',
      'Repeated wrong PINs lock the client out for 15 minutes.',
      'No built-in session-signing secret.',
      'Fail-closed is preserved: chat and uploads stay blocked when Lakera is unavailable.',
      'Upload scans are reused only for identical, fully scanned text; large and binary files are always rescanned.',
      'All prior controls unchanged — rate limiting, security headers, Check Point TE/WAF.',
    ],
  },
]
