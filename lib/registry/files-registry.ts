/**
 * Persistent file registry (SQLite).
 * Tracks uploaded files: id, storage_key, metadata, deleted_at.
 * Path: ./data/app.db (or REGISTRY_DB_PATH).
 */

import Database from 'better-sqlite3'
import path from 'path'
import { promises as fs } from 'fs'

const PATH_FILE = '.registry-db-path'

/** Resolve path: REGISTRY_PATH_FILE (canonical) > REGISTRY_DB_PATH > path file in data dir > default. */
function resolveRegistryPath(): string {
  const fsSync = require('fs') as typeof import('fs')
  if (process.env.REGISTRY_PATH_FILE && fsSync.existsSync(process.env.REGISTRY_PATH_FILE)) {
    try {
      const stored = fsSync.readFileSync(process.env.REGISTRY_PATH_FILE, 'utf-8').trim()
      if (stored && path.isAbsolute(stored)) return stored
    } catch {
      // ignore
    }
  }
  if (process.env.REGISTRY_DB_PATH) {
    return path.isAbsolute(process.env.REGISTRY_DB_PATH)
      ? process.env.REGISTRY_DB_PATH
      : path.resolve(process.cwd(), process.env.REGISTRY_DB_PATH)
  }
  const dataDir = process.env.DATA_DIR
    ? path.isAbsolute(process.env.DATA_DIR)
      ? process.env.DATA_DIR
      : path.resolve(process.cwd(), process.env.DATA_DIR)
    : path.resolve(process.cwd(), 'data')
  const defaultPath = path.join(dataDir, 'app.db')
  const pathFile = path.join(dataDir, PATH_FILE)
  try {
    if (fsSync.existsSync(pathFile)) {
      const stored = fsSync.readFileSync(pathFile, 'utf-8').trim()
      if (stored && path.isAbsolute(stored)) return stored
    }
    fsSync.mkdirSync(dataDir, { recursive: true, mode: 0o755 })
    fsSync.writeFileSync(pathFile, defaultPath, 'utf-8')
  } catch {
    // ignore
  }
  return defaultPath
}

// Use global so all module instances (e.g. from different Next.js chunks) share the same DB
const globalForRegistry = globalThis as unknown as {
  __registryDb?: Database.Database
  __registryPath?: string
  __registryWarned?: boolean
}

export type PipelineStatus =
  | 'uploaded'
  | 'extracting'
  | 'scanning'
  | 'indexing'
  | 'ready'
  | 'blocked'
  | 'failed'

export interface RegistryFileRow {
  id: string
  storage_key: string
  name: string
  size: number
  type: string
  owner_id: string | null
  session_id: string | null
  uploaded_at: string
  deleted_at: string | null
  scan_status: string
  scan_result: string | null
  scan_details_json: string | null
  checkpoint_te_details_json: string | null
  rag_indexed_at: string | null
  pipeline_status?: string | null
}

/** Shape compatible with StoredFileMetadata / UploadedFile for list and chat */
export interface RegistryFile {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: string
  scanStatus: 'pending' | 'scanning' | 'safe' | 'flagged' | 'error' | 'not_scanned'
  scanResult?: string
  scanDetails?: Record<string, unknown>
  checkpointTeDetails?: Record<string, unknown>
  storage_key: string
  owner_id: string | null
  session_id: string | null
  rag_indexed_at: string | null
  pipeline_status?: PipelineStatus | null
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(path.dirname(resolveRegistryPath()), { recursive: true, mode: 0o755 })
}

function getDb(): Database.Database {
  if (globalForRegistry.__registryDb) {
    return globalForRegistry.__registryDb
  }
  const resolvedPath = resolveRegistryPath()
  globalForRegistry.__registryPath = resolvedPath
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.REGISTRY_DB_PATH &&
    !globalForRegistry.__registryWarned
  ) {
    globalForRegistry.__registryWarned = true
    console.warn(
      '[secure-ai-chat] Production: REGISTRY_DB_PATH is not set. File list and chat RAG may be empty or inconsistent if multiple processes are used. Start with: npm run start (uses data paths) or set REGISTRY_DB_PATH and UPLOADS_DIR to absolute paths.'
    )
  }
  const fsSync = require('fs') as typeof import('fs')
  const dir = path.dirname(resolvedPath)
  try {
    fsSync.mkdirSync(dir, { recursive: true, mode: 0o755 })
    fsSync.writeFileSync(path.join(dir, PATH_FILE), resolvedPath, 'utf-8')
  } catch {
    // ignore
  }
  const db = new Database(resolvedPath)
  globalForRegistry.__registryDb = db
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      storage_key TEXT NOT NULL,
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      type TEXT NOT NULL,
      owner_id TEXT,
      session_id TEXT,
      uploaded_at TEXT NOT NULL,
      deleted_at TEXT,
      scan_status TEXT NOT NULL DEFAULT 'pending',
      scan_result TEXT,
      scan_details_json TEXT,
      checkpoint_te_details_json TEXT,
      rag_indexed_at TEXT,
      pipeline_status TEXT DEFAULT 'uploaded'
    );
    CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at);
  `)
  try {
    const info = db.prepare('PRAGMA table_info(files)').all() as { name: string }[]
    if (!info.some(c => c.name === 'pipeline_status')) {
      db.exec(`ALTER TABLE files ADD COLUMN pipeline_status TEXT DEFAULT 'uploaded'`)
    }
  } catch {
    // ignore
  }
  return db
}

/** Call from API route after async startup if needed; or use getDb() which inits. */
export async function initRegistry(): Promise<void> {
  await ensureDataDir()
  getDb()
}

export function insertFile(row: {
  id: string
  storage_key: string
  name: string
  size: number
  type: string
  owner_id?: string | null
  session_id?: string | null
  scan_status?: string
  scan_result?: string | null
  scan_details?: object | null
  checkpoint_te_details?: object | null
}): void {
  const database = getDb()
  const now = new Date().toISOString()
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO files (id, storage_key, name, size, type, owner_id, session_id, uploaded_at, deleted_at, scan_status, scan_result, scan_details_json, checkpoint_te_details_json, rag_indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL)
  `)
  stmt.run(
    row.id,
    row.storage_key,
    row.name,
    row.size,
    row.type,
    row.owner_id ?? null,
    row.session_id ?? null,
    now,
    row.scan_status ?? 'pending',
    row.scan_result ?? null,
    row.scan_details ? JSON.stringify(row.scan_details) : null,
    row.checkpoint_te_details ? JSON.stringify(row.checkpoint_te_details) : null
  )
}

export function getById(id: string): RegistryFile | null {
  const database = getDb()
  const row = database
    .prepare('SELECT * FROM files WHERE id = ? AND deleted_at IS NULL')
    .get(id) as RegistryFileRow | undefined
  if (!row) return null
  return rowToFile(row)
}

export interface ListFilesOptions {
  owner_id?: string | null
  session_id?: string | null
}

/**
 * List non-deleted files. Optional scope: when owner_id/session_id are provided, filter to those rows.
 * Chat and retrieval must use the same scope so context is found.
 */
export function listFiles(options?: ListFilesOptions): RegistryFile[] {
  const database = getDb()
  let sql = 'SELECT * FROM files WHERE deleted_at IS NULL'
  const params: (string | null)[] = []
  if (options?.owner_id != null && options.owner_id !== '') {
    sql += ' AND owner_id = ?'
    params.push(options.owner_id)
  }
  if (options?.session_id != null) {
    sql += ' AND (session_id IS NULL OR session_id = ?)'
    params.push(options.session_id)
  }
  sql += ' ORDER BY uploaded_at DESC'
  const rows = (
    params.length > 0 ? database.prepare(sql).all(...params) : database.prepare(sql).all()
  ) as RegistryFileRow[]
  return rows.map(rowToFile)
}

function rowToFile(row: RegistryFileRow): RegistryFile {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    type: row.type,
    uploadedAt: row.uploaded_at,
    scanStatus: row.scan_status as RegistryFile['scanStatus'],
    scanResult: row.scan_result ?? undefined,
    scanDetails: row.scan_details_json
      ? (JSON.parse(row.scan_details_json) as Record<string, unknown>)
      : undefined,
    checkpointTeDetails: row.checkpoint_te_details_json
      ? (JSON.parse(row.checkpoint_te_details_json) as Record<string, unknown>)
      : undefined,
    storage_key: row.storage_key,
    owner_id: row.owner_id,
    session_id: row.session_id,
    rag_indexed_at: row.rag_indexed_at,
    pipeline_status: (row.pipeline_status as RegistryFile['pipeline_status']) ?? 'uploaded',
  }
}

export function markDeleted(id: string): boolean {
  const database = getDb()
  const now = new Date().toISOString()
  const result = database
    .prepare('UPDATE files SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
    .run(now, id)
  return result.changes > 0
}

export function updateFileMetadata(
  id: string,
  updates: {
    scan_status?: string
    scan_result?: string | null
    scan_details?: object | null
    checkpoint_te_details?: object | null
    rag_indexed_at?: string | null
    pipeline_status?: PipelineStatus | string | null
  }
): boolean {
  const database = getDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (updates.scan_status !== undefined) {
    sets.push('scan_status = ?')
    values.push(updates.scan_status)
  }
  if (updates.scan_result !== undefined) {
    sets.push('scan_result = ?')
    values.push(updates.scan_result)
  }
  if (updates.scan_details !== undefined) {
    sets.push('scan_details_json = ?')
    values.push(updates.scan_details ? JSON.stringify(updates.scan_details) : null)
  }
  if (updates.checkpoint_te_details !== undefined) {
    sets.push('checkpoint_te_details_json = ?')
    values.push(
      updates.checkpoint_te_details ? JSON.stringify(updates.checkpoint_te_details) : null
    )
  }
  if (updates.rag_indexed_at !== undefined) {
    sets.push('rag_indexed_at = ?')
    values.push(updates.rag_indexed_at)
  }
  if (updates.pipeline_status !== undefined) {
    sets.push('pipeline_status = ?')
    values.push(updates.pipeline_status)
  }
  if (sets.length === 0) return false
  values.push(id)
  const result = database
    .prepare(`UPDATE files SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`)
    .run(...values)
  return result.changes > 0
}

export function getStorageKeyById(id: string): string | null {
  const database = getDb()
  const row = database
    .prepare('SELECT storage_key FROM files WHERE id = ? AND deleted_at IS NULL')
    .get(id) as { storage_key: string } | undefined
  return row ? row.storage_key : null
}

export function closeDb(): void {
  if (globalForRegistry.__registryDb) {
    globalForRegistry.__registryDb.close()
    globalForRegistry.__registryDb = undefined
  }
}
