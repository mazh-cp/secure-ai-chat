/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.1.13'

export const RELEASE_DATE = '2026-05-11'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.1.13]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Changed',
    items: [
      '**Theme tokens** — Import **`tokens.css`** from **`app/layout.tsx`** before globals (bundler-friendly).',
      '**Tailwind / PostCSS** — Runtime **`dependencies`** plus **`postcss` plugins** in **`package.json`**.',
      'Default pinned upgrade tag **`GIT_REF=v1.1.13`**; **`proxy.ts`** fallback version **1.1.13**.',
    ],
  },
]
