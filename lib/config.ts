/**
 * Central env/config loader for Secure AI Chat (v1.0.12).
 * - Reads required and optional env vars.
 * - Provides safe defaults.
 * - In production, can fail fast if critical vars are missing (none required for basic run).
 * - Server-only: do not import from client components.
 */

const isProduction = process.env.NODE_ENV === 'production'

function envTruthy(name: string): boolean {
  const v = process.env[name]
  return v === '1' || v === 'true' || v === 'yes'
}

/** One switch for hardened Lakera posture (production operators). */
const lakeraEnforceStrict = envTruthy('LAKERA_ENFORCE_STRICT')

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10) || 3000,
  hostname: process.env.HOSTNAME ?? '0.0.0.0',

  /** Registry DB path (optional; app resolves via files-registry default). */
  registryDbPath: process.env.REGISTRY_DB_PATH ?? undefined,
  /** Uploads directory (optional; app resolves via file-storage default). */
  uploadsDir: process.env.UPLOADS_DIR ?? undefined,
  /** Data directory for default paths. */
  dataDir: process.env.DATA_DIR ?? undefined,
  /** Storage directory (e.g. .storage). */
  storageDir: process.env.STORAGE_DIR ?? undefined,

  /** Base URL for app (smoke tests, callbacks). */
  baseUrl: process.env.BASE_URL ?? (typeof window === 'undefined' ? undefined : ''),

  /** Lakera: enabled when API key is set. */
  lakeraEnabled: !!(process.env.LAKERA_API_KEY || process.env.LAKERA_AI_KEY),
  lakeraApiKey: process.env.LAKERA_API_KEY || process.env.LAKERA_AI_KEY || undefined,
  lakeraProjectId: process.env.LAKERA_PROJECT_ID ?? undefined,
  lakeraEndpoint: process.env.LAKERA_ENDPOINT ?? undefined,
  /**
   * On Lakera API errors / timeouts: block traffic when true (enterprise).
   * Production defaults to fail-closed unless LAKERA_FAIL_CLOSED=false.
   * Non-production defaults to fail-open unless LAKERA_FAIL_CLOSED=true.
   * HTTP 401 from Guard is treated as fail-open when fail-closed (misconfigured key — no scan ran);
   * set LAKERA_FAIL_CLOSED_ON_AUTH_ERROR=1 to block in that case too.
   */
  lakeraFailClosed: isProduction
    ? process.env.LAKERA_FAIL_CLOSED !== 'false'
    : process.env.LAKERA_FAIL_CLOSED === 'true',
  /**
   * When fail-closed, block on HTTP 401 from Guard (bad key) instead of allowing traffic with no scan.
   * Also enabled when LAKERA_ENFORCE_STRICT=1.
   */
  lakeraFailClosedOnAuthError:
    lakeraEnforceStrict ||
    envTruthy('LAKERA_FAIL_CLOSED_ON_AUTH_ERROR'),
  /**
   * If a Lakera API key is in use, refuse to call Guard without project_id (forces your portal policy).
   * Also enabled when LAKERA_ENFORCE_STRICT=1.
   */
  lakeraRequireProjectId: lakeraEnforceStrict || envTruthy('LAKERA_REQUIRE_PROJECT_ID'),
  /**
   * When a Lakera key is configured, always run input/output Guard on chat regardless of client toggles.
   * Also enabled when LAKERA_ENFORCE_STRICT=1.
   */
  lakeraEnforceInputOutputScan: lakeraEnforceStrict || envTruthy('LAKERA_ENFORCE_INPUT_OUTPUT_SCAN'),
  /** Master: require project id + enforce chat scans + fail-closed on 401 (when fail-closed is on). */
  lakeraEnforceStrict,
  /** Timeout in ms for Lakera requests. */
  lakeraTimeoutMs: parseInt(process.env.LAKERA_TIMEOUT_MS ?? '10000', 10) || 10000,
  /**
   * When false (default): if Lakera Guard returns 200 with flagged=false, regex pre-scan does not
   * override (portal policy wins). Set LAKERA_PRESCAN_MERGE_AFTER_GUARD=1 to restore legacy merge.
   */
  lakeraPrescanMergeAfterGuard:
    process.env.LAKERA_PRESCAN_MERGE_AFTER_GUARD === '1' ||
    process.env.LAKERA_PRESCAN_MERGE_AFTER_GUARD === 'true' ||
    process.env.LAKERA_PRESCAN_MERGE_AFTER_GUARD === 'yes',
}

/** Vars that must be set in production (empty = no hard requirement for app to start). */
const PRODUCTION_REQUIRED_VARS: string[] = [
  // Add var names here if we ever require them, e.g. 'REGISTRY_DB_PATH'
]

/**
 * Validate config. In production, throws if any PRODUCTION_REQUIRED_VARS are missing.
 * In dev, only logs warnings.
 */
export function validateConfig(): void {
  if (!isProduction) return
  for (const key of PRODUCTION_REQUIRED_VARS) {
    const value = process.env[key]
    if (value === undefined || value === '') {
      throw new Error(
        `[config] Production required env var missing: ${key}. Set it or remove from PRODUCTION_REQUIRED_VARS in lib/config.ts.`
      )
    }
  }
}
