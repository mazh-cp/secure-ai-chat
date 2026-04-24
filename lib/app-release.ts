/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.1.11'

export const RELEASE_DATE = '2026-04-24'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.1.11]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      '**Google Gemini (text)** — Chat provider, **`geminiApiKey`** / Settings, **`GEMINI_API_KEY`** or **`GOOGLE_API_KEY`**, **`GET /api/models?provider=google`**, **`POST /api/chat`** with **`provider: google`**.',
    ],
  },
  {
    title: 'Fixed',
    items: [
      '**Dev 404 / EMFILE** — Webpack dev + **`watchOptions.poll`** in **`next.config.js`**; **`npm run dev`** uses **`WATCHPACK_POLLING`** and **`--webpack`**.',
    ],
  },
  {
    title: 'Changed',
    items: [
      'Default pinned upgrade tag **`GIT_REF=v1.1.11`** in v3 / VM scripts and **`UPGRADE_COMMANDS.md`**.',
      '**`proxy.ts`** — `X-Application-Version` fallback **1.1.11** when **`NEXT_PUBLIC_APP_VERSION`** is unset.',
    ],
  },
]
