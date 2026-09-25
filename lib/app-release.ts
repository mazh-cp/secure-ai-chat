/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.3.0'

export const RELEASE_DATE = '2026-09-25'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.3.0]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      '**In-app Ollama model install** — Settings → **Ollama models** pulls from the official library by name, imports a `.gguf` on this host via `ollama create`, and lists or deletes installed models. Chat → **Local model** auto-lists the same instance, so a model pulled here is immediately selectable.',
      '**`OLLAMA_MANAGE_ENABLED`** — kill switch for the mutating manage APIs. Status and list keep working when it is off, so you can disable pull/import/delete without losing visibility.',
      '**`OLLAMA_IMPORT_MAX_BYTES`** — import size cap, default 8 GiB. Raise reverse-proxy body limits to match before increasing it.',
    ],
  },
  {
    title: 'Security',
    items: [
      '**No shell interpolation on model install** — `ollama` is invoked with a fixed argv array, never a shell string, and model names pass an allowlist (letters, digits and `. _ : / -`) with a length cap and an explicit `..` rejection.',
      '**GGUF imports are path-contained** — an import is resolved and required to sit under the managed imports directory, so a crafted path cannot write elsewhere on the host.',
      '**Manage routes reuse the existing gate** — `/api/ollama/*` all require `requireSecureChatSession` and are IP rate-limited. The status route takes no client-supplied URL at all; it reads the server-saved base URL, so it adds no SSRF surface.',
    ],
  },
  {
    title: 'Fixed',
    items: [
      '**`GET /api/models?provider=local`** — falls back to the server-saved Local Model Base URL when the client omits `baseUrl`, so the chat model picker matches what Settings shows.',
    ],
  },
]
