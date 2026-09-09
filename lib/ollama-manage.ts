/**
 * Ollama host management — pull from the official registry, list/delete models,
 * and import a staged .gguf via `ollama create`.
 *
 * Management traffic always targets the server-saved local base URL (or the
 * Ollama default), after the same SSRF loopback checks as chat. Clients cannot
 * supply an alternate host on these APIs.
 */

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { lookup } from 'node:dns/promises'

import {
  assertLocalBaseUrlAllowed,
  DEFAULT_LOCAL_BASE_URL,
  InvalidBaseUrlError,
} from '@/lib/localModelAdapter'
import { getCanonicalDataDir } from '@/lib/storage-canonical'

export const DEFAULT_OLLAMA_OPENAI_BASE = DEFAULT_LOCAL_BASE_URL
export const DEFAULT_OLLAMA_IMPORT_MAX_BYTES = 8 * 1024 * 1024 * 1024 // 8 GiB
const PULL_TIMEOUT_MS = 30 * 60 * 1000
const CREATE_TIMEOUT_MS = 30 * 60 * 1000
const STATUS_TIMEOUT_MS = 5_000
const MAX_MODEL_NAME_LEN = 128

export class OllamaManageError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'OllamaManageError'
    this.status = status
  }
}

export function isOllamaManageEnabled(): boolean {
  const raw = process.env.OLLAMA_MANAGE_ENABLED?.trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false
  return true
}

export function getOllamaImportMaxBytes(): number {
  const raw = process.env.OLLAMA_IMPORT_MAX_BYTES?.trim()
  if (!raw) return DEFAULT_OLLAMA_IMPORT_MAX_BYTES
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_OLLAMA_IMPORT_MAX_BYTES
  return Math.floor(n)
}

/**
 * Ollama model names: library tags like `llama3.2`, `llama3.2:latest`,
 * `library/mistral`, or custom import names. Reject path tricks.
 */
export function assertSafeOllamaModelName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new OllamaManageError('Model name is required.')
  }
  if (trimmed.length > MAX_MODEL_NAME_LEN) {
    throw new OllamaManageError(`Model name must be at most ${MAX_MODEL_NAME_LEN} characters.`)
  }
  if (trimmed.includes('..')) {
    throw new OllamaManageError('Model name must not contain "..".')
  }
  if (!/^[a-zA-Z0-9._:/-]+$/.test(trimmed)) {
    throw new OllamaManageError(
      'Model name may only contain letters, digits, and . _ : / - (e.g. llama3.2 or mistral:7b).'
    )
  }
  return trimmed
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/**
 * Turn an OpenAI-compatible base (`…/v1`) into the Ollama native origin
 * (`http://127.0.0.1:11434`). Always SSRF-checked.
 */
export async function resolveOllamaOrigin(localBaseUrl?: string | null): Promise<string> {
  const raw = (localBaseUrl?.trim() || DEFAULT_OLLAMA_OPENAI_BASE).replace(/\/+$/, '')
  const forCheck = /\/v1$/i.test(raw) ? raw : `${raw}/v1`
  const url = await assertLocalBaseUrlAllowed(forCheck)
  let pathname = url.pathname.replace(/\/+$/, '')
  if (pathname.toLowerCase().endsWith('/v1')) {
    pathname = pathname.slice(0, -3)
  }
  url.pathname = pathname || '/'
  url.search = ''
  url.hash = ''
  return stripTrailingSlash(url.toString())
}

export function getOllamaImportsDir(): string {
  return path.join(getCanonicalDataDir(), 'ollama-imports')
}

export async function ensureOllamaImportsDir(): Promise<string> {
  const dir = getOllamaImportsDir()
  await fs.mkdir(dir, { recursive: true })
  return dir
}

/** Safe staging folder name derived from the model name. */
export function stagingDirNameForModel(modelName: string): string {
  return modelName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'model'
}

export interface OllamaListedModel {
  id: string
  size?: number
  modifiedAt?: string
  digest?: string
}

export interface OllamaStatus {
  ok: boolean
  origin: string
  manageEnabled: boolean
  binaryOk: boolean
  version?: string
  models?: OllamaListedModel[]
  error?: string
}

async function whichOllama(): Promise<boolean> {
  return new Promise(resolve => {
    const child = spawn('ollama', ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        // ignore
      }
      done(false)
    }, 3_000)
    child.on('error', () => {
      clearTimeout(timer)
      done(false)
    })
    child.on('close', code => {
      clearTimeout(timer)
      done(code === 0)
    })
  })
}

export async function getOllamaStatus(localBaseUrl?: string | null): Promise<OllamaStatus> {
  const manageEnabled = isOllamaManageEnabled()
  const binaryOk = await whichOllama()
  let origin: string
  try {
    origin = await resolveOllamaOrigin(localBaseUrl)
  } catch (error) {
    return {
      ok: false,
      origin: '',
      manageEnabled,
      binaryOk,
      error: error instanceof Error ? error.message : 'Invalid local model base URL',
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS)
  try {
    const versionRes = await fetch(`${origin}/api/version`, { signal: controller.signal })
    let version: string | undefined
    if (versionRes.ok) {
      const body = (await versionRes.json().catch(() => ({}))) as { version?: string }
      version = typeof body.version === 'string' ? body.version : undefined
    }

    const tagsRes = await fetch(`${origin}/api/tags`, { signal: controller.signal })
    if (!tagsRes.ok) {
      return {
        ok: false,
        origin,
        manageEnabled,
        binaryOk,
        version,
        error: `Ollama returned HTTP ${tagsRes.status} from /api/tags`,
      }
    }
    const tagsBody = (await tagsRes.json()) as {
      models?: Array<{ name?: string; size?: number; modified_at?: string; digest?: string }>
    }
    const models = (tagsBody.models || [])
      .map(m => ({
        id: m.name || '',
        size: typeof m.size === 'number' ? m.size : undefined,
        modifiedAt: typeof m.modified_at === 'string' ? m.modified_at : undefined,
        digest: typeof m.digest === 'string' ? m.digest : undefined,
      }))
      .filter(m => m.id)

    return { ok: true, origin, manageEnabled, binaryOk, version, models }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return {
      ok: false,
      origin,
      manageEnabled,
      binaryOk,
      error: aborted
        ? 'Timed out reaching Ollama. Is `ollama serve` running on this host?'
        : `Could not reach Ollama at ${origin}. Is it running?`,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function listOllamaModels(localBaseUrl?: string | null): Promise<OllamaListedModel[]> {
  const status = await getOllamaStatus(localBaseUrl)
  if (!status.ok) {
    throw new OllamaManageError(status.error || 'Ollama is unreachable', 503)
  }
  return status.models || []
}

export async function deleteOllamaModel(
  name: string,
  localBaseUrl?: string | null
): Promise<void> {
  if (!isOllamaManageEnabled()) {
    throw new OllamaManageError('Ollama model management is disabled (OLLAMA_MANAGE_ENABLED=0).', 403)
  }
  const safe = assertSafeOllamaModelName(name)
  const origin = await resolveOllamaOrigin(localBaseUrl)
  const res = await fetch(`${origin}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: safe }),
  })
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    let detail = raw.trim()
    try {
      const parsed = JSON.parse(raw) as { error?: string }
      if (typeof parsed.error === 'string' && parsed.error) detail = parsed.error
    } catch {
      // keep raw text
    }
    throw new OllamaManageError(
      detail || `Failed to delete model "${safe}" (HTTP ${res.status})`,
      res.status >= 400 && res.status < 500 ? res.status : 502
    )
  }
}

export interface OllamaPullProgress {
  status?: string
  digest?: string
  total?: number
  completed?: number
  error?: string
}

/**
 * Stream an Ollama pull. Yields parsed NDJSON progress objects until complete.
 */
export async function* pullOllamaModel(
  name: string,
  localBaseUrl?: string | null
): AsyncGenerator<OllamaPullProgress> {
  if (!isOllamaManageEnabled()) {
    throw new OllamaManageError('Ollama model management is disabled (OLLAMA_MANAGE_ENABLED=0).', 403)
  }
  const safe = assertSafeOllamaModelName(name)
  const origin = await resolveOllamaOrigin(localBaseUrl)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PULL_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${origin}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: safe, stream: true }),
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OllamaManageError('Ollama pull timed out.', 504)
    }
    throw new OllamaManageError(
      `Could not reach Ollama at ${origin} to pull "${safe}". Is it running?`,
      503
    )
  }

  if (!response.ok || !response.body) {
    clearTimeout(timeoutId)
    const detail = await response.text().catch(() => '')
    throw new OllamaManageError(
      detail.trim() || `Ollama pull failed (HTTP ${response.status})`,
      response.status >= 400 && response.status < 500 ? response.status : 502
    )
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        let parsed: OllamaPullProgress
        try {
          parsed = JSON.parse(trimmed) as OllamaPullProgress
        } catch {
          continue
        }
        if (parsed.error) {
          throw new OllamaManageError(String(parsed.error), 400)
        }
        yield parsed
      }
    }
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim()) as OllamaPullProgress
        if (parsed.error) throw new OllamaManageError(String(parsed.error), 400)
        yield parsed
      } catch (error) {
        if (error instanceof OllamaManageError) throw error
      }
    }
  } finally {
    clearTimeout(timeoutId)
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }
}

export interface ImportGgufResult {
  name: string
  stdout: string
  stderr: string
}

/**
 * Import a staged .gguf with `ollama create` and a Modelfile that points at the
 * absolute path. Argv is fixed — never shell-interpolated.
 */
export async function importGgufViaOllamaCreate(options: {
  name: string
  ggufPath: string
  localBaseUrl?: string | null
}): Promise<ImportGgufResult> {
  if (!isOllamaManageEnabled()) {
    throw new OllamaManageError('Ollama model management is disabled (OLLAMA_MANAGE_ENABLED=0).', 403)
  }
  const safe = assertSafeOllamaModelName(options.name)

  // Ensure management target is still a permitted loopback host before spawning.
  await resolveOllamaOrigin(options.localBaseUrl)

  const ggufAbs = path.resolve(options.ggufPath)
  const importsRoot = path.resolve(getOllamaImportsDir())
  if (!ggufAbs.startsWith(importsRoot + path.sep) && ggufAbs !== importsRoot) {
    throw new OllamaManageError('Import path is outside the allowed staging directory.', 400)
  }

  let st: Awaited<ReturnType<typeof fs.stat>>
  try {
    st = await fs.stat(ggufAbs)
  } catch {
    throw new OllamaManageError('Uploaded model file is missing on disk.', 400)
  }
  if (!st.isFile()) {
    throw new OllamaManageError('Uploaded path is not a file.', 400)
  }

  const workDir = path.dirname(ggufAbs)
  const modelfilePath = path.join(workDir, 'Modelfile')
  // Absolute FROM path so create does not depend on cwd relative resolution quirks.
  await fs.writeFile(modelfilePath, `FROM ${ggufAbs}\n`, 'utf8')

  const binaryOk = await whichOllama()
  if (!binaryOk) {
    throw new OllamaManageError(
      'The `ollama` CLI was not found on PATH. Install Ollama on this host to import .gguf files.',
      503
    )
  }

  const result = await new Promise<ImportGgufResult>((resolve, reject) => {
    const child = spawn('ollama', ['create', safe, '-f', modelfilePath], {
      cwd: workDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        // ignore
      }
      reject(new OllamaManageError('ollama create timed out.', 504))
    }, CREATE_TIMEOUT_MS)

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', err => {
      clearTimeout(timer)
      reject(
        new OllamaManageError(
          `Failed to spawn ollama: ${err.message}. Is the CLI installed on PATH?`,
          503
        )
      )
    })
    child.on('close', code => {
      clearTimeout(timer)
      if (code === 0) {
        resolve({ name: safe, stdout, stderr })
        return
      }
      const detail = (stderr || stdout).trim() || `ollama create exited with code ${code}`
      reject(new OllamaManageError(detail, 400))
    })
  })

  return result
}

/** Best-effort cleanup of a staging directory under ollama-imports. */
export async function cleanupImportStaging(stagingDir: string): Promise<void> {
  const abs = path.resolve(stagingDir)
  const root = path.resolve(getOllamaImportsDir())
  if (!abs.startsWith(root + path.sep)) return
  await fs.rm(abs, { recursive: true, force: true }).catch(() => undefined)
}

/** Re-export for routes that need the SSRF error type. */
export { InvalidBaseUrlError }

/** Optional DNS warm-up helper for diagnostics (unused by routes). */
export async function resolveHostnameAddresses(hostname: string): Promise<string[]> {
  const entries = await lookup(hostname, { all: true })
  return entries.map(e => e.address)
}
