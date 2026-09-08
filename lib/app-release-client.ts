/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.2.0'
export const RELEASE_DATE = '2026-09-08'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'Local model provider — chat against any OpenAI-compatible server (Ollama, LM Studio, llama.cpp, vLLM). Prompts never leave the host.',
      'Mock provider — deterministic in-process replies with no key, no network and no GPU, for testing the Lakera scanners on their own.',
      'Model picker now enumerates models from a local server via `GET /api/models?provider=local`.',
    ],
  },
  {
    title: 'Security',
    items: [
      'SSRF guard on the local model base URL — loopback only, credentials rejected, hostname resolved before any request goes out.',
      '`LOCAL_MODEL_ALLOWED_HOSTS` is the only way to widen beyond loopback, and is read server-side only.',
      'Local and mock providers add no new unauthenticated surface — the existing session gate and rate limiting still apply.',
    ],
  },
]
