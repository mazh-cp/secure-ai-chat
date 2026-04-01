/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.1.6'
export const RELEASE_DATE = '2026-04-03'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Fixed',
    items: ['Production build uses webpack so `.next/standalone/server.js` is generated (Next.js 16).'],
  },
  {
    title: 'Changed',
    items: ['Default production upgrade tag is `v1.1.6`.'],
  },
]
