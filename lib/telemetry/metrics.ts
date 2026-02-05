/**
 * RAG telemetry: counters and timings (Secure RAG - Phase B).
 *
 * Phase F will wire these to real metrics. Phase B provides the interface and in-memory store.
 *
 * Track:
 * - ingestion_scan_latency_ms
 * - retrieval_latency_ms
 * - generation_latency_ms
 * - chunks_retrieved_count
 * - chunks_dropped_by_security_count
 * - not_enough_context_rate
 * - thumbs_down_rate
 */

export type MetricName =
  | 'ingestion_scan_latency_ms'
  | 'retrieval_latency_ms'
  | 'generation_latency_ms'
  | 'chunks_retrieved_count'
  | 'chunks_dropped_by_security_count'
  | 'not_enough_context_count'
  | 'not_enough_context_rate'
  | 'retrieval_attempts'
  | 'thumbs_down_count'
  | 'thumbs_down_rate'
  | 'thumbs_up_count'

const counters: Record<string, number> = {}
const timings: Record<string, number[]> = {}

function getCounter(name: string): number {
  return counters[name] ?? 0
}

function incCounter(name: string, delta = 1): void {
  counters[name] = (counters[name] ?? 0) + delta
}

/**
 * Record a timing sample (e.g. latency in ms).
 */
export function recordTiming(name: MetricName, valueMs: number): void {
  if (!timings[name]) timings[name] = []
  timings[name].push(valueMs)
  // Keep last 1000 samples
  if (timings[name].length > 1000) timings[name] = timings[name].slice(-1000)
}

/**
 * Record a count increment (e.g. chunks_retrieved_count += n).
 */
export function recordCount(name: MetricName, delta = 1): void {
  incCounter(name, delta)
}

/**
 * Get current counter value.
 */
export function getCount(name: MetricName): number {
  return getCounter(name)
}

/**
 * Get timing stats (avg, p95, count) for a metric.
 */
export function getTimingStats(name: MetricName): { avg: number; p95: number; count: number } {
  const samples = timings[name] ?? []
  if (samples.length === 0) return { avg: 0, p95: 0, count: 0 }
  const sorted = [...samples].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  const p95Index = Math.floor(sorted.length * 0.95)
  return {
    avg: sum / sorted.length,
    p95: sorted[p95Index] ?? 0,
    count: sorted.length,
  }
}

/**
 * Compute not_enough_context_rate = not_enough_context_count / (retrieval attempts).
 * Call recordCount('not_enough_context_count') when NOT_ENOUGH_CONTEXT; recordCount('retrieval_attempts') on every retrieve (Phase F can add retrieval_attempts).
 */
export function getNotEnoughContextRate(): number {
  const notEnough = getCounter('not_enough_context_count')
  const total = getCounter('retrieval_attempts') || 1
  return notEnough / total
}

/**
 * Compute thumbs_down_rate = thumbs_down_count / (thumbs_up_count + thumbs_down_count).
 */
export function getThumbsDownRate(): number {
  const down = getCounter('thumbs_down_count')
  const up = getCounter('thumbs_up_count')
  const total = up + down
  return total === 0 ? 0 : down / total
}

/**
 * Reset all counters and timings (for tests).
 */
export function resetMetrics(): void {
  Object.keys(counters).forEach((k) => delete counters[k])
  Object.keys(timings).forEach((k) => delete timings[k])
}
