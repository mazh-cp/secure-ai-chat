/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.1.2'
export const RELEASE_DATE = '2026-04-01'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'Production upgrade v3 script for the 1.1.x line (gated build + default release tag).',
      'Extra checks so API key material is not committed to git.',
    ],
  },
  {
    title: 'Changed',
    items: ['Remote VM upgrades: prefer upgrade-remote-production-v3.sh or USE_V3=1 from your laptop.'],
  },
  {
    title: 'Security',
    items: ['Clarified in docs: pulling from GitHub never includes your stored provider keys.'],
  },
]
