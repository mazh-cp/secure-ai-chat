/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.1.4'
export const RELEASE_DATE = '2026-04-02'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Fixed',
    items: [
      '`/release-notes` shows `### Changed` bullets from CHANGELOG.md (API + page).',
    ],
  },
  {
    title: 'Changed',
    items: ['Default production upgrade tag is `v1.1.4`.'],
  },
]
