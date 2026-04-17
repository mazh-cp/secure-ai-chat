/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.1.10'

export const RELEASE_DATE = '2026-04-18'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.1.10]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      '**Lakera enforcement** — `LAKERA_ENFORCE_STRICT` plus `LAKERA_REQUIRE_PROJECT_ID`, `LAKERA_ENFORCE_INPUT_OUTPUT_SCAN`; `lakeraEnforcement` on **`GET /api/settings/status`** and chat logs.',
      '**`.gitignore`** — `.nvm/`, `.npm/`, `.cache/`, `.config/` when HOME is the app directory.',
    ],
  },
  {
    title: 'Changed',
    items: [
      '**RAG `scanTextWithLakera`** — HTTP 401 handling aligned with chat/file under fail-closed + `LAKERA_FAIL_CLOSED_ON_AUTH_ERROR` / `LAKERA_ENFORCE_STRICT`.',
      'Default pinned upgrade tag **`GIT_REF=v1.1.10`** in v3 / VM scripts and **`UPGRADE_COMMANDS.md`**.',
    ],
  },
]
