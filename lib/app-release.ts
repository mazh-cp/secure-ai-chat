/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.0.20'

export const RELEASE_DATE = '2026-03-28'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.0.20]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'Binary upload decode: POST /api/files/store decodes client base64 (PDF/DOCX) via lib/upload-body-buffer.ts instead of storing UTF-8 of base64.',
      'RAG: mammoth + pdf-parse extract text from DOCX/DOC/PDF (lib/extract-text-for-rag.ts) in rag-context and chat fallback.',
      'Production upgrade: scripts/upgrade-remote-production-v2.sh, run-remote-production-upgrade.sh; curl script RUN_TYPECHECK, HEALTH_RETRIES, .storage restore, missing-tag fallback to main.',
    ],
  },
  {
    title: 'Fixed',
    items: [
      'Chat could not answer from uploaded PDF/Word when scans were off — root cause was on-disk bytes + missing text extraction.',
      'Upgrade one-liners: default GIT_REF=main when release tags are not pushed; documented Option A1 curl without v2 wrapper.',
    ],
  },
  {
    title: 'Changed',
    items: [
      'next.config.js: serverExternalPackages for pdf-parse, pdfjs-dist, mammoth.',
    ],
  },
]
