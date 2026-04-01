/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.1.6'

export const RELEASE_DATE = '2026-04-03'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.1.6]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Fixed',
    items: [
      '`npm run build` uses `next build --webpack` so standalone output and `verify-build` succeed on Next.js 16.',
    ],
  },
  {
    title: 'Changed',
    items: [
      'Default v3 upgrade tag `GIT_REF=v1.1.6` in scripts and upgrade docs.',
    ],
  },
]
