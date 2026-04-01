/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.1.3'
export const RELEASE_DATE = '2026-04-01'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Fixed',
    items: [
      'Production `build:fresh` no longer fails ESLint on `.backups/` copies of `.next`.',
      'VM upgrade retry now pulls latest `main` so `package.json` scripts stay in sync.',
    ],
  },
]
