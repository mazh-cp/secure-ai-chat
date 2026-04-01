/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.1.5'
export const RELEASE_DATE = '2026-04-03'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'Optional `SHARED_ORG_OWNER_ID` for one org-wide file + RAG corpus; check `/api/owner` for `shared_org_corpus`.',
    ],
  },
  {
    title: 'Changed',
    items: ['Default production upgrade tag is `v1.1.5`.'],
  },
]
