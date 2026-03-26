/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.0.18'

export const RELEASE_DATE = '2026-03-26'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.0.12]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'Freeze baseline: code prior to 2026-01-19 tagged as v1.0.11-freeze (immutable). New work lives on release/1.0.12.',
      'CI guard: scripts/guard-prejan19.sh fails CI if changes vs v1.0.11-freeze are outside file/RAG/security paths.',
      'File/RAG/Security: Persistent file storage (registry + ./data/uploads), unified file registry with owner/session scoping.',
      'Deterministic delete/clear (bytes + metadata + vectors), RAG reindex endpoint POST /api/files/:id/reindex.',
      'RAG readiness in list (ragStatus: queued/ready), Lakera at upload and on retrieved chunks before OpenAI.',
      'Stability smoke script: npm run smoke:stability.',
    ],
  },
  {
    title: 'Compatibility',
    items: [
      'No routes or response fields removed or renamed; only new fields (e.g. ragStatus) and new endpoints (e.g. /api/files/:id/reindex) added.',
    ],
  },
]
