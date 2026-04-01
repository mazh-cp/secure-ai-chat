/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.0.22'
export const RELEASE_DATE = '2026-03-30'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'Hardened release build: build:fresh and post-build verification for standalone output.',
    ],
  },
  {
    title: 'Changed',
    items: [
      'Updated ESLint/Next toolchain; safer Excel parsing for uploaded spreadsheets (RAG).',
    ],
  },
  {
    title: 'Fixed',
    items: ['Lint and navigation fixes for the latest React hooks rules.'],
  },
]
