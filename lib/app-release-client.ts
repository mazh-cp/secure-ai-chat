/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.0.20'
export const RELEASE_DATE = '2026-03-28'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'Correct binary file storage for uploads; DOCX/PDF text extraction for chat RAG.',
      'Stricter VM upgrade script (type-check + health) and SSH helper from your laptop.',
    ],
  },
  {
    title: 'Fixed',
    items: [
      'Questions about uploaded documents (e.g. names, user counts) when Lakera scan was off — files are now read as real PDF/Word text.',
      'Production upgrades when git tag is missing: fall back to main automatically.',
    ],
  },
]
