/**
 * Canonical local storage layout (v1.0.16).
 * DATA_DIR/
 *   uploads/<tenant>/<fileId>/raw.bin
 *   uploads/<tenant>/<fileId>/meta.json
 *   derived/<tenant>/<fileId>/extracted.jsonl
 *   derived/<tenant>/<fileId>/lakera.json
 *   derived/<tenant>/<fileId>/status.json
 * Atomic writes: tmp -> rename. All routes must use runtime = "nodejs".
 */

import { promises as fs } from 'fs'
import path from 'path'

const DATA_DIR = process.env.DATA_DIR
  ? path.isAbsolute(process.env.DATA_DIR)
    ? process.env.DATA_DIR
    : path.resolve(process.cwd(), process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data')

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
const DERIVED_DIR = path.join(DATA_DIR, 'derived')

export type PipelineStatus =
  | 'uploaded'
  | 'extracting'
  | 'scanning'
  | 'indexing'
  | 'ready'
  | 'blocked'
  | 'failed'

function sanitize(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_.-]/g, '_')
}

function uploadFileDir(tenant: string, fileId: string): string {
  return path.join(UPLOADS_DIR, sanitize(tenant), sanitize(fileId))
}

function derivedFileDir(tenant: string, fileId: string): string {
  return path.join(DERIVED_DIR, sanitize(tenant), sanitize(fileId))
}

export function getCanonicalDataDir(): string {
  return DATA_DIR
}

export function getCanonicalUploadsDir(): string {
  return UPLOADS_DIR
}

export function getCanonicalDerivedDir(): string {
  return DERIVED_DIR
}

/** Ensure directory exists (mkdir -p). */
async function ensureDir(dir: string, mode = 0o755): Promise<void> {
  await fs.mkdir(dir, { recursive: true, mode })
}

/** Atomic write: write to tmp then rename. */
async function atomicWrite(filePath: string, data: Buffer | string, mode = 0o644): Promise<void> {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`
  await fs.writeFile(tmp, buf, { mode })
  await fs.rename(tmp, filePath)
}

export interface FileMeta {
  fileId: string
  name: string
  size: number
  type: string
  tenant: string
  createdAt: string
  sha256?: string
}

/** Ensure uploads/<tenant>/<fileId> and write raw.bin + meta.json (atomic). */
export async function writeRawAndMeta(
  tenant: string,
  fileId: string,
  raw: Buffer | string,
  meta: FileMeta
): Promise<void> {
  const dir = uploadFileDir(tenant, fileId)
  await ensureDir(UPLOADS_DIR)
  await ensureDir(path.dirname(dir))
  await ensureDir(dir)

  const rawPath = path.join(dir, 'raw.bin')
  const metaPath = path.join(dir, 'meta.json')
  const rawBuf = typeof raw === 'string' ? Buffer.from(raw, 'utf-8') : raw

  await atomicWrite(rawPath, rawBuf)
  await atomicWrite(metaPath, JSON.stringify(meta, null, 0))
}

/** Read raw bytes. Returns null if not found. Tries raw.bin then legacy single file. */
export async function readRaw(tenant: string, fileId: string): Promise<Buffer | null> {
  const dir = uploadFileDir(tenant, fileId)
  const rawPath = path.join(dir, 'raw.bin')
  const legacyPath = path.join(UPLOADS_DIR, sanitize(tenant), sanitize(fileId))
  try {
    return await fs.readFile(rawPath)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      try {
        return await fs.readFile(legacyPath)
      } catch {
        return null
      }
    }
    throw e
  }
}

/** Read meta.json. Returns null if not found. */
export async function readMeta(tenant: string, fileId: string): Promise<FileMeta | null> {
  const metaPath = path.join(uploadFileDir(tenant, fileId), 'meta.json')
  try {
    const raw = await fs.readFile(metaPath, 'utf-8')
    return JSON.parse(raw) as FileMeta
  } catch {
    return null
  }
}

export interface StatusPayload {
  status: PipelineStatus
  updatedAt: string
  message?: string
  error?: string
}

/** Write derived/<tenant>/<fileId>/status.json (atomic). */
export async function writeStatus(
  tenant: string,
  fileId: string,
  payload: StatusPayload
): Promise<void> {
  const dir = derivedFileDir(tenant, fileId)
  await ensureDir(DERIVED_DIR)
  await ensureDir(path.dirname(dir))
  await ensureDir(dir)
  const statusPath = path.join(dir, 'status.json')
  await atomicWrite(statusPath, JSON.stringify(payload, null, 0))
}

/** Read status.json. Returns null if not found. */
export async function readStatus(tenant: string, fileId: string): Promise<StatusPayload | null> {
  const statusPath = path.join(derivedFileDir(tenant, fileId), 'status.json')
  try {
    const raw = await fs.readFile(statusPath, 'utf-8')
    return JSON.parse(raw) as StatusPayload
  } catch {
    return null
  }
}

/** Delete file directory (raw.bin + meta.json) and derived dir. */
export async function deleteFileDir(tenant: string, fileId: string): Promise<void> {
  const dir = uploadFileDir(tenant, fileId)
  const derived = derivedFileDir(tenant, fileId)
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
  try {
    await fs.rm(derived, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

/** Delete all derived/<tenant>/* (status.json etc.). */
export async function clearDerivedForTenant(tenant: string): Promise<void> {
  const dir = path.join(DERIVED_DIR, sanitize(tenant))
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}
