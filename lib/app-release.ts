/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.1.3'

export const RELEASE_DATE = '2026-04-01'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.1.3]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Fixed',
    items: [
      'ESLint ignores `.backups/**` and nested `**/.next/**` so `npm run build:fresh` does not lint old upgrade snapshots.',
      'upgrade-curl-production.sh: after a failed build, `git pull origin main` so retries do not use stale main (missing scripts).',
    ],
  },
  {
    title: 'Changed',
    items: [
      'Default v3 upgrade tag `GIT_REF=v1.1.3`; `.backups/` added to `.gitignore`.',
    ],
  },
]
