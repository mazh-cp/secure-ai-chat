/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.0.16'
export const RELEASE_DATE = '2026-02-05'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

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
