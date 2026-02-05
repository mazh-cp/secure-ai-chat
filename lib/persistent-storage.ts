/**
 * Server-side persistent file storage under ./data/uploads/<ownerId>/<fileId>.
 * Bytes on disk; metadata is in SQLite (registry) only.
 * Paths are stable and absolute.
 */

import { promises as fs } from 'fs'
import path from 'path'

const DATA_DIR = process.env.DATA_DIR
  ? (path.isAbsolute(process.env.DATA_DIR) ? process.env.DATA_DIR : path.resolve(process.cwd(), process.env.DATA_DIR))
  : path.resolve(process.cwd(), 'data')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

function sanitize(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_.-]/g, '_')
}

function ownerDir(ownerId: string): string {
  return path.join(UPLOADS_DIR, sanitize(ownerId))
}

function filePath(ownerId: string, fileId: string): string {
  return path.join(ownerDir(ownerId), sanitize(fileId))
}

/** Resolved DATA_DIR (absolute). For diagnostics only. */
export function getDataDir(): string {
  return DATA_DIR
}

/** Resolved UPLOADS_DIR (absolute). For diagnostics only. */
export function getUploadsDir(): string {
  return UPLOADS_DIR
}

/** Absolute path for owner/file (server-side verification only; do not send to client). */
export function getOwnerFilePath(ownerId: string, fileId: string): string {
  return path.resolve(UPLOADS_DIR, sanitize(ownerId), sanitize(fileId))
}

/**
 * Ensure directory ./data/uploads/<ownerId> exists.
 */
export async function ensureOwnerDir(ownerId: string): Promise<void> {
  const dir = ownerDir(ownerId)
  await fs.mkdir(dir, { recursive: true, mode: 0o755 })
}

/**
 * Write file bytes under ./data/uploads/<ownerId>/<fileId>.
 */
export async function writeOwnerFile(ownerId: string, fileId: string, data: Buffer | string): Promise<void> {
  await ensureOwnerDir(ownerId)
  const p = filePath(ownerId, fileId)
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data
  await fs.writeFile(p, buf, { mode: 0o644 })
}

/**
 * Read file bytes from ./data/uploads/<ownerId>/<fileId>. Returns null if not found.
 */
export async function readOwnerFile(ownerId: string, fileId: string): Promise<string | null> {
  try {
    const p = filePath(ownerId, fileId)
    const content = await fs.readFile(p, 'utf-8')
    return content
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/**
 * Read file as Buffer from ./data/uploads/<ownerId>/<fileId>. Returns null if not found.
 */
export async function readOwnerFileBuffer(ownerId: string, fileId: string): Promise<Buffer | null> {
  try {
    const p = filePath(ownerId, fileId)
    return await fs.readFile(p)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/**
 * Delete file at ./data/uploads/<ownerId>/<fileId>. Returns true if deleted, false if not found.
 */
export async function deleteOwnerFile(ownerId: string, fileId: string): Promise<boolean> {
  try {
    const p = filePath(ownerId, fileId)
    await fs.unlink(p)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

/**
 * Delete all files under ./data/uploads/<ownerId>/.
 */
export async function clearOwnerFiles(ownerId: string): Promise<number> {
  const dir = ownerDir(ownerId)
  let count = 0
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      if (e.isFile()) {
        await fs.unlink(path.join(dir, e.name))
        count++
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  return count
}

/**
 * List files on disk for an owner (filenames + sizes). For diagnostics.
 */
export async function listOwnerFilesOnDisk(ownerId: string): Promise<Array<{ name: string; size: number }>> {
  const dir = ownerDir(ownerId)
  const out: Array<{ name: string; size: number }> = []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isFile()) continue
      const fp = path.join(dir, e.name)
      const stat = await fs.stat(fp)
      out.push({ name: e.name, size: stat.size })
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  return out
}

/**
 * Check if UPLOADS_DIR exists on disk.
 */
export async function uploadsDirExists(): Promise<boolean> {
  try {
    await fs.access(UPLOADS_DIR)
    return true
  } catch {
    return false
  }
}

/**
 * Storage stats for health/cache: walk ./data/uploads and count files / total size.
 */
export async function getStorageStats(): Promise<{
  fileCount: number
  totalSize: number
  oldestFile?: string
  newestFile?: string
}> {
  let fileCount = 0
  let totalSize = 0
  let oldestMs: number | null = null
  let newestMs: number | null = null
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true, mode: 0o755 })
    const owners = await fs.readdir(UPLOADS_DIR, { withFileTypes: true })
    for (const owner of owners) {
      if (!owner.isDirectory()) continue
      const ownerPath = path.join(UPLOADS_DIR, owner.name)
      const files = await fs.readdir(ownerPath, { withFileTypes: true })
      for (const f of files) {
        if (!f.isFile()) continue
        const fp = path.join(ownerPath, f.name)
        const stat = await fs.stat(fp)
        fileCount++
        totalSize += stat.size
        const m = stat.mtimeMs
        if (oldestMs == null || m < oldestMs) oldestMs = m
        if (newestMs == null || m > newestMs) newestMs = m
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  return {
    fileCount,
    totalSize,
    oldestFile: oldestMs != null ? new Date(oldestMs).toISOString() : undefined,
    newestFile: newestMs != null ? new Date(newestMs).toISOString() : undefined,
  }
}

/**
 * No-op for backward compatibility with scripts that import migrateStorage.
 */
export async function migrateStorage(): Promise<void> {}

/**
 * Clear all file bytes under ./data/uploads (all owner dirs). Used by 24h cache cleanup.
 * Does not touch registry or RAG index.
 */
export async function clearAllFiles(): Promise<{ deletedFiles: number; deletedMetadata: boolean }> {
  let deletedFiles = 0
  try {
    const owners = await fs.readdir(UPLOADS_DIR, { withFileTypes: true })
    for (const owner of owners) {
      if (!owner.isDirectory()) continue
      const n = await clearOwnerFiles(owner.name)
      deletedFiles += n
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  return { deletedFiles, deletedMetadata: false }
}
