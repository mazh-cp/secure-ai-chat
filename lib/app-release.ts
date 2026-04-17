/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.1.9'

export const RELEASE_DATE = '2026-04-17'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.1.9]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      '`POST /api/lakera/verify` — minimal Guard probe for connectivity and project_id (JSON response).',
      'Settings: **Verify Lakera (Guard probe)** button.',
      '`scripts/remote-production-upgrade.sh` — canonical entry; `REMOTE-UPGRADE.md` cross-link.',
    ],
  },
  {
    title: 'Changed',
    items: [
      '**Lakera fail-closed in production** by default (`LAKERA_FAIL_CLOSED` unset); set `LAKERA_FAIL_CLOSED=false` to opt out. **HTTP 401** from Guard is fail-open (bad key) unless `LAKERA_FAIL_CLOSED_ON_AUTH_ERROR=1`.',
      '**Lakera:** after Guard returns unflagged, local regex no longer overrides unless `LAKERA_PRESCAN_MERGE_AFTER_GUARD=1`; broader PII detector tokens for policy/breakdown alignment.',
      'Chat: **Lakera input audit** (`lakera_guard` system log) emitted immediately after input Guard so token/rate-limit failures still leave an audit trail.',
      'Chat: **API Keys Status** log includes Lakera flags and `lakeraEnvSet` (env overrides file storage).',
      'Default pinned upgrade tag **`GIT_REF=v1.1.9`** in v3 / remote VM scripts and `UPGRADE_COMMANDS.md`.',
    ],
  },
]
