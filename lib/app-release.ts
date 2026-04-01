/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.0.22'

export const RELEASE_DATE = '2026-03-30'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.0.22]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'npm run build:fresh — clears .next, runs check:secrets, typecheck, lint, then production build.',
      'scripts/verify-build.mjs — asserts standalone server.js and static output after next build (npm run build).',
    ],
  },
  {
    title: 'Changed',
    items: [
      'Toolchain: ESLint 9 with flat eslint.config.mjs; eslint-config-next 16 aligned with Next.js 16.',
      'RAG Excel extraction uses exceljs instead of the unmaintained xlsx package (addresses npm audit advisories).',
      'Legacy .xls binary workbooks are not text-extracted for RAG; use .xlsx/.xlsm for indexing.',
    ],
  },
  {
    title: 'Fixed',
    items: [
      'React Compiler / react-hooks lint rules from eslint-plugin-react-hooks v7 (effects, Link for internal nav).',
    ],
  },
]
