/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.1.2'

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

/** Release notes for current version (matches CHANGELOG.md [1.1.2]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'scripts/upgrade-remote-production-v3.sh — 1.1.x VM upgrade path (default GIT_REF=v1.1.2, USE_BUILD_FRESH=1).',
      'scripts/check-git-no-api-keys.mjs — blocks sk-… / sk-ant-api… tokens in git-tracked files (part of check:secrets).',
    ],
  },
  {
    title: 'Changed',
    items: [
      'Version line 1.1.x — use USE_V3=1 or curl …/upgrade-remote-production-v3.sh for production upgrades.',
      'run-remote-production-upgrade.sh — USE_V3=1 selects the v3 upgrade wrapper.',
    ],
  },
  {
    title: 'Security',
    items: [
      'SECURITY.md documents that GitHub clones do not ship provider API keys; .secure-storage remains gitignored.',
    ],
  },
]
