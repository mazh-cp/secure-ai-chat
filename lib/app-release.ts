/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.2.0'

export const RELEASE_DATE = '2026-09-08'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.2.0]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      '**Local model provider** — chat against any OpenAI-compatible server (Ollama, LM Studio, llama.cpp, vLLM, LocalAI). Set the base URL in Settings and pick the model in the chat header; prompts never leave the host.',
      '**Mock provider** — deterministic in-process replies with no key, no network and no GPU, so the Lakera input/output scanners can be exercised on their own (CI, offline demos, laptops without a GPU).',
      '**`GET /api/models?provider=local`** — enumerates whatever the local server is serving, so the model picker works the same way it does for hosted providers.',
    ],
  },
  {
    title: 'Security',
    items: [
      '**SSRF guard on the local model base URL** — the URL is supplied by the browser and fetched server-side, so `assertLocalBaseUrlAllowed()` restricts the scheme, rejects embedded credentials, and resolves the hostname requiring every answer to be a loopback address before any request leaves the process.',
      '**`LOCAL_MODEL_ALLOWED_HOSTS`** — the only way to widen beyond loopback, read from the environment and never from the request payload so a client cannot widen its own reach.',
      '**No new unauthenticated surface** — the local and mock providers reuse the existing `requireSecureChatSession` gate and rate limiting on `/api/chat`, `/api/scan` and `/api/models`.',
    ],
  },
  {
    title: 'Documentation',
    items: [
      '**`docs/local-models.md`** — setup for each local runtime, the mock provider triggers, the SSRF reasoning, and how to verify the guardrails still fire.',
    ],
  },
]
