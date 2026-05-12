/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.1.14'
export const RELEASE_DATE = '2026-05-12'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Security',
    items: [
      'Lakera Guard monitoring-only mode for safe policy calibration (`LAKERA_GUARD_MONITORING_ONLY`).',
      'Multi-turn Guard coverage — prior conversation turns passed as context to detect split-payload attacks.',
      '`project_id` enforced by default in production — Guard applies your project policy, not Lakera default.',
      '`/api/scan` now requires session auth and is rate-limited by IP.',
      'Circuit breaker prevents Guard outage latency cascades.',
    ],
  },
  {
    title: 'Changed',
    items: [
      'New `GET /api/lakera/last` — last Guard decision snapshot for operator dashboards.',
      'Default production upgrade tag **`v1.1.14`**.',
    ],
  },
]
