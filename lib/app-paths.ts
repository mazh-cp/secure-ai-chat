/**
 * Resolved paths for durable server-side files (outside Next standalone cwd).
 * Server-only — do not import from client components.
 */

import path from 'path'

/**
 * Repo / install directory (contains package.json, .secure-storage).
 * Next standalone runs with cwd = `.next/standalone/…`; start-standalone sets this env var.
 */
export function getAppRootDir(): string {
  const raw = process.env.SECURE_AI_CHAT_APP_ROOT?.trim()
  if (raw) return path.resolve(raw)
  return process.cwd()
}

/** Encrypted keys, PIN, TE key, logs — always under install root after fix for standalone cwd. */
export function getSecureStorageDir(): string {
  return path.join(getAppRootDir(), '.secure-storage')
}
