/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.3.0'
export const RELEASE_DATE = '2026-09-25'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'In-app Ollama model install — Settings → Ollama models pulls from the official library, imports a `.gguf` on this host, and lists or deletes installed models.',
      'A model pulled here is immediately selectable in Chat → Local model.',
      '`OLLAMA_MANAGE_ENABLED` kill switch and `OLLAMA_IMPORT_MAX_BYTES` size cap (default 8 GiB).',
    ],
  },
  {
    title: 'Security',
    items: [
      'Model install never uses a shell: fixed argv plus an allowlisted model name with a `..` rejection.',
      'GGUF imports are contained to the managed imports directory.',
      '`/api/ollama/*` reuses the existing session gate and rate limiting; the status route accepts no client URL, so it adds no SSRF surface.',
    ],
  },
  {
    title: 'Fixed',
    items: ['The chat model picker now matches Settings when the client omits the local base URL.'],
  },
]
