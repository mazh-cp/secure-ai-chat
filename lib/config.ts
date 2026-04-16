/**
 * Central env/config loader for Secure AI Chat (v1.0.12).
 * - Reads required and optional env vars.
 * - Provides safe defaults.
 * - In production, can fail fast if critical vars are missing (none required for basic run).
 * - Server-only: do not import from client components.
 */

const isProduction = process.env.NODE_ENV === 'production'

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
   */
  lakeraFailClosed: isProduction
    ? process.env.LAKERA_FAIL_CLOSED !== 'false'
    : process.env.LAKERA_FAIL_CLOSED === 'true',
  /** Timeout in ms for Lakera requests. */
  lakeraTimeoutMs: parseInt(process.env.LAKERA_TIMEOUT_MS ?? '10000', 10) || 10000,
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
