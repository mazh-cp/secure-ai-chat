/**
 * Client-safe app version and release notes (no process/env).
 * Use this in client components. Server/API can use lib/app-release.ts.
 */

export const APP_VERSION = '1.1.14'
export const RELEASE_DATE = '2026-10-13'

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Added',
    items: [
      'Extended Anthropic model coverage — 13 Claude models across Claude 5, 4, 3.7, 3.5, and 3 families.',
      '200k context window registered for all Claude models; new model IDs no longer fall through to the 8 192-token default.',
      'Lakera Guard /v2/guard/results support via POST /api/lakera/results with input validation.',
    ],
  },
  {
    title: 'Changed',
    items: [
      'Default Anthropic model updated to claude-sonnet-5-5.',
      'Anthropic model list ordered newest-first in the model picker.',
    ],
  },
  {
    title: 'Security',
    items: [
      'Lakera results route requires session auth; message count and character limits enforced before upstream calls.',
      'All prior security controls preserved — headers, TE/WAF/DLP integrations, injection guardrails.',
    ],
  },
]
