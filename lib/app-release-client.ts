/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.0.21'
export const RELEASE_DATE = '2026-03-29'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'TE diagnostic API and Lakera Guard audit logging aligned with platform.lakera.ai.',
      'Chat sends session metadata to Lakera for better tracing.',
    ],
  },
  {
    title: 'Changed',
    items: [
      'Check Point TE requests aligned with official TPAPI shapes; Files sync messaging improved.',
      'Lakera: platform logs via Guard; optional HTTP telemetry when enabled.',
    ],
  },
  {
    title: 'Fixed',
    items: ['Default Lakera telemetry no longer hits a non-ingest endpoint.'],
  },
]
