/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.1.9'
export const RELEASE_DATE = '2026-04-17'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'Lakera verify API and Settings **Verify Lakera** probe.',
      'Remote upgrade helper script and docs pointer.',
    ],
  },
  {
    title: 'Changed',
    items: [
      'Production defaults to **Lakera fail-closed** unless disabled explicitly.',
      'Better Lakera diagnostics in chat logs; input Guard audit even when the LLM step never runs.',
      'Default production upgrade tag **`v1.1.9`**.',
    ],
  },
]
