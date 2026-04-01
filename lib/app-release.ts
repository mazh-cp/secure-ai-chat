/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.0.21'

export const RELEASE_DATE = '2026-03-29'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.0.21]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'GET /api/te/diagnostic for Check Point TE troubleshooting (IP hint, base URLs; no secrets).',
      'Lakera Guard audit logs (lib/lakera-guard-audit.ts): correlate with platform via request_uuid; chat, file scan, RAG ingestion/retrieval.',
      'Chat Lakera metadata includes session_id for platform analytics.',
    ],
  },
  {
    title: 'Changed',
    items: [
      'Check Point TE: TPAPI-shaped query (te.images[]), te_cookie stickiness, CHECKPOINT_TE_AUTH_FORMAT, default TE reports xml; teAuthFormat on /api/te/config.',
      'Lakera: optional LAKERA_TELEMETRY_HTTP for custom ingest; default relies on Guard API + audit logs.',
      'Files page: /api/owner before refetch; clearer sync warnings.',
    ],
  },
  {
    title: 'Fixed',
    items: [
      'Removed default POST to undocumented Lakera /v2/telemetry (404 noise); use Guard dashboard or opt-in HTTP.',
    ],
  },
]
