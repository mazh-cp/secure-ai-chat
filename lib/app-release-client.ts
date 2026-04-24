/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.1.11'
export const RELEASE_DATE = '2026-04-24'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      '**Google Gemini (text)** — New chat provider; API key in Settings; env **`GEMINI_API_KEY`** or **`GOOGLE_API_KEY`**.',
    ],
  },
  {
    title: 'Fixed',
    items: [
      '**Local dev 404** — Polling-based webpack watch options to avoid **`EMFILE`** breaking all routes.',
    ],
  },
  {
    title: 'Changed',
    items: [
      'Default production upgrade tag **`v1.1.11`**.',
    ],
  },
]
