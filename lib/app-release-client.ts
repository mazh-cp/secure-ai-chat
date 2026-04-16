/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.1.8'
export const RELEASE_DATE = '2026-04-03'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Fixed',
    items: [
      'Standalone `server.js` can live under `.next/standalone/<app>/` — start + verify-build find it.',
    ],
  },
  {
    title: 'Changed',
    items: ['Default production upgrade tag is `v1.1.8`.'],
  },
]
