/**
 * Single source of truth for app version and release notes.
 * Keep in sync with CHANGELOG.md when cutting a new release.
 */

export const APP_VERSION = '1.1.14'

export const RELEASE_DATE = '2026-05-12'

/** Build identifier; set at build time or leave empty for dev (server-side only in API) */
export function getBuildId(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env.BUILD_ID ?? process.env.VERCEL_BUILD_ID ?? ''
}

export interface ReleaseNoteItem {
  title: string
  items: string[]
}

/** Release notes for current version (matches CHANGELOG.md [1.1.14]) */
export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: 'Security',
    items: [
      '**Lakera Guard monitoring-only mode** — `LAKERA_GUARD_MONITORING_ONLY=1` enables shadow/pilot mode for safe policy calibration without blocking traffic.',
      '**`GET /api/lakera/last`** — per-process snapshot of the last Guard decision for operator dashboards and live debugging.',
      '**Multi-turn Guard coverage** — prior conversation turns are now passed to Guard as context, enabling detection of split-payload injection attacks spread across multiple messages.',
      '**`project_id` enforced in production** — `LAKERA_REQUIRE_PROJECT_ID` defaults to `true` when a Lakera key is configured, ensuring Guard applies your tuned project policy rather than the Lakera default.',
      '**`/api/scan` auth + rate limiting** — endpoint now requires session authentication and is rate-limited by IP to prevent unauthenticated Lakera quota drain and policy enumeration.',
      '**Circuit breaker for Guard HTTP** — `CLOSED/OPEN/HALF_OPEN` state machine in `postLakeraGuard()` prevents latency cascades when Guard is unavailable.',
      '**Tool message scanning** — `ChatGuardCallOptions.toolMessages` supports function-calling flows in future OpenAI/Anthropic tool-use integrations.',
      '**Output PII policy unification** — local regex output PII block removed; Guard portal policy (via `payload: true`) is now the single authoritative PII detection plane.',
    ],
  },
  {
    title: 'Changed',
    items: [
      '`LAKERA_GUARD_INPUT_SCOPE` — set to `raw` to scan only the original user message instead of the RAG-augmented turn.',
      'Default pinned upgrade tag **`GIT_REF=v1.1.14`**; **`proxy.ts`** fallback version **1.1.14**.',
    ],
  },
  {
    title: 'Documentation',
    items: [
      '**`LAKERA_TELEMETRY.md`** rewritten — removes reference to non-existent `/v2/telemetry` endpoint, documents `request_uuid` correlation, monitoring-only mode, last-snapshot endpoint, and full env-var reference table.',
    ],
  },
]
