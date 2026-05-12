/**
 * Lightweight in-process circuit breaker for Lakera Guard HTTP calls.
 *
 * State machine: CLOSED → OPEN → HALF_OPEN → CLOSED
 *
 * - CLOSED (normal): all Guard calls go through.
 * - OPEN (tripped): after FAILURE_THRESHOLD consecutive availability errors, Guard calls
 *   are skipped immediately — no network round-trip. fail-closed logic in guard-client.ts
 *   then applies (block or allow depending on config.lakeraFailClosed).
 * - HALF_OPEN (probe): after OPEN_DURATION_MS, one probe request is allowed through.
 *   If it succeeds SUCCESS_THRESHOLD times in a row, circuit closes. If it fails, re-opens.
 *
 * Only HTTP 5xx and 429 count as availability failures. 4xx (auth, bad request) are
 * Guard responding correctly — not availability failures.
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

const FAILURE_THRESHOLD = 5       // consecutive availability errors before opening
const OPEN_DURATION_MS = 30_000   // 30s open before allowing a probe (HALF_OPEN)
const SUCCESS_THRESHOLD = 2       // consecutive successes in HALF_OPEN to close circuit

let state: CircuitState = 'CLOSED'
let consecutiveFailures = 0
let consecutiveSuccesses = 0
let openedAt: number | null = null

export function getCircuitState(): CircuitState {
  return state
}

export function recordGuardSuccess(): void {
  consecutiveFailures = 0
  if (state === 'HALF_OPEN') {
    consecutiveSuccesses++
    if (consecutiveSuccesses >= SUCCESS_THRESHOLD) {
      state = 'CLOSED'
      consecutiveSuccesses = 0
      console.log('[Lakera Circuit] CLOSED — Guard responding normally')
    }
  }
}

export function recordGuardFailure(): void {
  consecutiveSuccesses = 0
  consecutiveFailures++
  if (state === 'CLOSED' && consecutiveFailures >= FAILURE_THRESHOLD) {
    state = 'OPEN'
    openedAt = Date.now()
    console.warn(
      `[Lakera Circuit] OPENED after ${consecutiveFailures} consecutive Guard errors — ` +
        `fast-failing for ${OPEN_DURATION_MS / 1000}s (fail-closed policy still applies)`
    )
  } else if (state === 'HALF_OPEN') {
    state = 'OPEN'
    openedAt = Date.now()
    console.warn('[Lakera Circuit] Re-OPENED — probe request failed')
  }
}

/**
 * Returns true when Guard calls should be skipped (circuit is OPEN and not yet probe-ready).
 * Auto-transitions OPEN → HALF_OPEN when OPEN_DURATION_MS has elapsed.
 */
export function isCircuitOpen(): boolean {
  if (state === 'CLOSED') return false
  if (state === 'OPEN') {
    const elapsed = Date.now() - (openedAt ?? 0)
    if (elapsed >= OPEN_DURATION_MS) {
      state = 'HALF_OPEN'
      consecutiveSuccesses = 0
      console.log('[Lakera Circuit] HALF_OPEN — allowing one probe request')
      return false
    }
    return true
  }
  // HALF_OPEN: allow the probe through
  return false
}
