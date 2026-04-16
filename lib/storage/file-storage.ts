/**
 * File storage abstraction for uploaded files.
 * Persists file bytes under ./data/uploads (or UPLOADS_DIR).
 * Keys are file IDs (same as registry id); no path traversal.
 */

import { promises as fs } from 'fs'
import path from 'path'

const UPLOADS_PATH_FILE = '.uploads-dir'

/** Resolve uploads dir: UPLOADS_PATH_FILE (canonical) > UPLOADS_DIR > path file in data dir > default. */
function resolveUploadsBase(): string {
  const fsSync = require('fs') as typeof import('fs')
  if (process.env.UPLOADS_PATH_FILE && fsSync.existsSync(process.env.UPLOADS_PATH_FILE)) {
    try {
      const stored = fsSync.readFileSync(process.env.UPLOADS_PATH_FILE, 'utf-8').trim()
      if (stored && path.isAbsolute(stored)) return stored
    } catch {
      // ignore
    }
  }
  if (process.env.UPLOADS_DIR) {
    return path.isAbsolute(process.env.UPLOADS_DIR)
      ? process.env.UPLOADS_DIR
      : path.resolve(process.cwd(), process.env.UPLOADS_DIR)
  }
  const defaultDir = path.resolve(process.cwd(), 'data', 'uploads')
  const pathFile = path.join(process.cwd(), 'data', UPLOADS_PATH_FILE)
  try {
    if (fsSync.existsSync(pathFile)) {
      const stored = fsSync.readFileSync(pathFile, 'utf-8').trim()
      if (stored && path.isAbsolute(stored)) return stored
    }
    fsSync.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true, mode: 0o755 })
    fsSync.writeFileSync(pathFile, defaultDir, 'utf-8')
  } catch {
    // ignore
  }
  return defaultDir
}

const globalForStorage = globalThis as unknown as {
  __uploadsBase?: string
  __uploadsWarned?: boolean
}
function getUploadsBase(): string {
  if (globalForStorage.__uploadsBase) return globalForStorage.__uploadsBase
  const resolved = resolveUploadsBase()
  globalForStorage.__uploadsBase = resolved
  try {
    const pathFile = path.join(path.dirname(resolved), UPLOADS_PATH_FILE)
    require('fs').writeFileSync(pathFile, resolved, 'utf-8')
  } catch {
    // ignore
  }
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.UPLOADS_DIR &&
    !globalForStorage.__uploadsWarned
  ) {
    globalForStorage.__uploadsWarned = true
    console.warn(
      '[secure-ai-chat] Production: UPLOADS_DIR is not set. Chat RAG may not find uploaded file content if multiple processes are used. Start with: npm run start (uses data paths) or set UPLOADS_DIR to an absolute path.'
    )
  }
  return globalForStorage.__uploadsBase
}

function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_.-]/g, '_')
}

function getFilePath(key: string): string {
  return path.join(getUploadsBase(), `${sanitizeKey(key)}.dat`)
}

export async function ensureUploadsDir(): Promise<void> {
  await fs.mkdir(getUploadsBase(), { recursive: true, mode: 0o755 })
}

export async function writeFile(key: string, content: Buffer | string): Promise<void> {
  await ensureUploadsDir()
  const filePath = getFilePath(key)
  const data = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content
  await fs.writeFile(filePath, data, { mode: 0o644 })
}

export async function readFile(key: string): Promise<string | null> {
  try {
    const filePath = getFilePath(key)
    const content = await fs.readFile(filePath, 'utf-8')
    return content
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function readFileBuffer(key: string): Promise<Buffer | null> {
  try {
    const filePath = getFilePath(key)
    return await fs.readFile(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function deleteFile(key: string): Promise<boolean> {
  try {
    const filePath = getFilePath(key)
    await fs.unlink(filePath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export async function exists(key: string): Promise<boolean> {
  try {
    const filePath = getFilePath(key)
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export function getUploadsDir(): string {
  return getUploadsBase()
}
