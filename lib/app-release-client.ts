/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.1.10'
export const RELEASE_DATE = '2026-04-18'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      '**Lakera strict mode** — `LAKERA_ENFORCE_STRICT` and related env vars; enforcement flags on **Settings → status** API.',
      '**`.gitignore`** — nvm/npm cache dirs when the repo is the app user HOME.',
    ],
  },
  {
    title: 'Changed',
    items: [
      '**RAG Lakera** — 401 vs fail-closed matches chat when using auth-error blocking.',
      'Default production upgrade tag **`v1.1.10`**.',
    ],
  },
]
