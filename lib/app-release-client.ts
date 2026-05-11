/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.1.13'
export const RELEASE_DATE = '2026-05-11'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Changed',
    items: [
      '**Theme tokens** — Loaded from **`layout.tsx`** before global styles.',
      '**Tailwind / PostCSS** — Declared as app **`dependencies`** for reliable production installs.',
      'Default production upgrade tag **`v1.1.13`**.',
    ],
  },
]
