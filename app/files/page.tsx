'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import SecurityIndicator from '@/components/SecurityIndicator'
import FileUploader from '@/components/FileUploader'
import FileList from '@/components/FileList'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { UploadedFile } from '@/types/files'
import { addLog } from '@/lib/logging'
import { ownerHeaders, apiFetchOptions } from '@/lib/owner-client'
import { safeFetchJson } from '@/lib/safe-fetch'
import { getAssociatedRisksFromLakeraDecision } from '@/types/risks'
import { CheckPointTEResponse } from '@/types/checkpoint-te'

/** Mirrors server `getTeSubmitStrategy()` — parsed from GET /api/te/config (do not import lib/checkpoint-te in client). */
type TeSubmitStrategy = 'auto' | 'hash_only' | 'upload_only'

function parseTeSubmitStrategyFromConfig(cfg: {
  teSubmitStrategy?: string
  hashLookupOnly?: boolean
}): TeSubmitStrategy {
  const s = cfg.teSubmitStrategy
  if (s === 'hash_only' || s === 'upload_only' || s === 'auto') return s
  if (cfg.hashLookupOnly === true) return 'hash_only'
  if (cfg.hashLookupOnly === false) return 'upload_only'
  return 'auto'
}

type TeVerdict = 'safe' | 'malicious' | 'pending' | 'unknown'

async function parseTeQueryFailureMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as {
      error?: string
      message?: string
      troubleshooting?: string
    }
    let msg =
      (typeof data.error === 'string' && data.error.trim()) ||
      (typeof data.message === 'string' && data.message.trim()) ||
      `Check Point TE query failed (${res.status})`
    if (typeof data.troubleshooting === 'string' && data.troubleshooting.trim()) {
      msg = `${msg.trim()}\n\n${data.troubleshooting.trim()}`
    }
    return msg
  } catch {
    try {
      const t = await res.text()
      return t.trim()
        ? `Check Point TE query failed (${res.status}): ${t.slice(0, 400)}`
        : `Check Point TE query failed (${res.status} ${res.statusText})`
    } catch {
      return `Check Point TE query failed (${res.status} ${res.statusText})`
    }
  }
}

/** Poll POST /api/te/query until a non-pending verdict or attempts exhausted. */
async function checkpointTePollQuery(params: {
  sha256?: string
  sha1?: string
  md5?: string
  teImageId?: string
  teRevision?: number
  teResolvedBase?: string
  maxAttempts: number
  pollIntervalMs: number
  skipDelayOnFirstAttempt: boolean
}): Promise<{ verdict: TeVerdict; teResult: CheckPointTEResponse | null }> {
  const {
    sha256,
    sha1,
    md5,
    teImageId,
    teRevision,
    teResolvedBase,
    maxAttempts,
    pollIntervalMs,
    skipDelayOnFirstAttempt,
  } = params

  let effectiveTeApiBase = teResolvedBase

  const pollTimeout = maxAttempts * pollIntervalMs
  const pollStartTime = Date.now()
  let attempts = 0
  let verdict: TeVerdict = 'pending'
  let teResult: CheckPointTEResponse | null = null

  while (attempts < maxAttempts && verdict === 'pending') {
    if (Date.now() - pollStartTime > pollTimeout) {
      console.warn('Check Point TE polling timeout exceeded', {
        attempts,
        duration: Date.now() - pollStartTime,
        timeout: pollTimeout,
      })
      verdict = 'unknown'
      break
    }
    if (attempts > 0 || !skipDelayOnFirstAttempt) {
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }
    attempts++

    const queryBody: {
      sha256?: string
      sha1?: string
      md5?: string
      features: string[]
      teApiBase?: string
      /** TPAPI te.images[] (server also accepts legacy te.image). */
      te?: { images?: Array<{ id?: string; revision?: number }> }
    } = { features: ['te'] }

    if (typeof effectiveTeApiBase === 'string' && effectiveTeApiBase.trim().length > 0) {
      queryBody.teApiBase = effectiveTeApiBase.trim()
    }
    if (sha256) queryBody.sha256 = sha256
    else if (sha1) queryBody.sha1 = sha1
    else if (md5) queryBody.md5 = md5
    if (teImageId && teRevision != null) {
      queryBody.te = { images: [{ id: teImageId, revision: teRevision }] }
    }

    const queryResponse = await fetch('/api/te/query', {
      credentials: 'include',
      cache: 'no-store',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryBody),
    })

    if (!queryResponse.ok) {
      const failMsg = await parseTeQueryFailureMessage(queryResponse.clone())
      const failFast = [400, 401, 403, 404].includes(queryResponse.status)
      if (failFast || attempts >= maxAttempts) {
        throw new Error(failMsg)
      }
      continue
    }

    const queryData = (await queryResponse.json()) as CheckPointTEResponse
    if (
      typeof queryData.teResolvedBase === 'string' &&
      queryData.teResolvedBase.trim().length > 0
    ) {
      effectiveTeApiBase = queryData.teResolvedBase.trim()
    }
    verdict = queryData.verdict as TeVerdict
    teResult = queryData
    if (verdict !== 'pending' && verdict !== 'unknown') break
  }

  return { verdict, teResult }
}

const VALID_SCAN_STATUSES: UploadedFile['scanStatus'][] = [
  'pending',
  'scanning',
  'safe',
  'flagged',
  'error',
  'not_scanned',
]

/** Type guard: validate all required UploadedFile properties so partial objects are filtered out. */
function isUploadedFile(f: unknown): f is UploadedFile {
  if (f == null || typeof f !== 'object') return false
  const o = f as Record<string, unknown>
  const scanStatus = o.scanStatus
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.size === 'number' &&
    typeof o.type === 'string' &&
    typeof o.content === 'string' &&
    o.uploadedAt !== undefined &&
    (typeof o.uploadedAt === 'string' || o.uploadedAt instanceof Date) &&
    typeof scanStatus === 'string' &&
    VALID_SCAN_STATUSES.includes(scanStatus as UploadedFile['scanStatus'])
  )
}

/** Trigger RAG indexing for file(s) after store/scan when safe. Server runs Lakera on extracted text before embedding. */
async function triggerRagEmbed(fileIds: string[]): Promise<void> {
  if (fileIds.length === 0) return
  const res = await safeFetchJson<{ success?: boolean }>('/api/rag/embed', {
    ...apiFetchOptions,
    method: 'POST',
    headers: { ...ownerHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds }),
  })
  if (!res.ok) {
    console.warn('RAG embed (indexing) request failed:', res.error?.message ?? res.data)
  }
}

/** Build JSON body for POST /api/files/store (v1.0.12 JSON-only store). */
function buildStoreBody(
  file: UploadedFile,
  scanStatus: string,
  extra?: {
    scanResult?: string
    scanDetails?: unknown
    checkpointTeDetails?: unknown
    /** Merge registry only; do not re-run Lakera (Check Point TE / Lakera stay independent). */
    skipServerLakeraScan?: boolean
    /** When false, server skips Lakera even if API key is set (Lakera file-scan toggle off). */
    lakeraScanRequested?: boolean
  }
): string {
  return JSON.stringify({
    fileId: file.id,
    fileName: file.name,
    fileContent: file.content,
    fileType: file.type || 'text/plain',
    fileSize: file.size,
    scanStatus,
    ...(extra?.scanResult != null && { scanResult: extra.scanResult }),
    ...(extra?.scanDetails != null && { scanDetails: extra.scanDetails }),
    ...(extra?.checkpointTeDetails != null && { checkpointTeDetails: extra.checkpointTeDetails }),
    ...(extra?.skipServerLakeraScan === true && { skipServerLakeraScan: true }),
    ...(extra?.lakeraScanRequested === false && { lakeraScanRequested: false }),
  })
}

/** Lowercase SHA-256 hex of file bytes (browser-only; never sent to Check Point as raw file). */
async function sha256HexFromBlob(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Check Point hash-only mode requires Web Crypto. Use HTTPS or localhost.')
  }
  const buf = await blob.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Same bytes the TE upload path would send — used for hashing without uploading. */
async function uploadedFileToBlob(file: UploadedFile): Promise<Blob> {
  if (file.content.startsWith('data:')) {
    const response = await fetch(file.content)
    return response.blob()
  }
  const isBase64 = /^[A-Za-z0-9+/=]+$/.test(file.content) && file.content.length > 0
  if (isBase64 && file.content.length > 100) {
    let base64Content = file.content
    if (base64Content.includes(',')) {
      base64Content = base64Content.split(',')[1] ?? base64Content
    }
    while (base64Content.length % 4) {
      base64Content += '='
    }
    try {
      const byteCharacters = atob(base64Content)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      return new Blob([new Uint8Array(byteNumbers)], {
        type: file.type || 'application/octet-stream',
      })
    } catch {
      return new Blob([file.content], { type: file.type || 'text/plain' })
    }
  }
  return new Blob([file.content], { type: file.type || 'text/plain' })
}

export default function FilesPage() {
  const [isSecure, setIsSecure] = useState(true)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [lakeraScanEnabled, setLakeraScanEnabled] = useState(true)
  const [ragScanEnabled, setRagScanEnabled] = useState(true)
  const [checkpointTeSandboxEnabled, setCheckpointTeSandboxEnabled] = useState(false)
  const [checkpointTeConfigured, setCheckpointTeConfigured] = useState<boolean>(false)
  /** Server TE mode from GET /api/te/config (auto = hash-first then upload if needed). */
  const [teSubmitStrategy, setTeSubmitStrategy] = useState<TeSubmitStrategy>('upload_only')
  const [serverSyncWarning, setServerSyncWarning] = useState<string | null>(null)
  const [storeError, setStoreError] = useState<string | null>(null)
  const filesCountRef = useRef(0)

  // Load files from server; returns list or null. Uses safeFetchJson so non-JSON response never crashes.
  const loadFilesFromServer = useCallback(async (): Promise<UploadedFile[] | null> => {
    const result = await safeFetchJson<{ success?: boolean; files?: unknown[] }>(
      '/api/files/list',
      {
        ...apiFetchOptions,
        headers: { ...ownerHeaders() },
      }
    )
    if (!result.ok || !result.data?.success || !Array.isArray(result.data.files)) return null
    const filesWithDates = result.data.files.filter(isUploadedFile).map((f: UploadedFile) => ({
      ...f,
      uploadedAt: f.uploadedAt != null ? new Date(f.uploadedAt) : new Date(),
    }))
    return filesWithDates
  }, [])

  // Check Check Point TE API key configuration status
  const checkCheckpointTeStatus = useCallback(async () => {
    try {
      // Add cache-busting to force fresh check
      const response = await fetch(`/api/te/config?t=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setCheckpointTeConfigured(data.configured || false)
        setTeSubmitStrategy(parseTeSubmitStrategyFromConfig(data))
        // If API key not configured but toggle is enabled, disable it
        setCheckpointTeSandboxEnabled(prev => {
          if (!data.configured && prev) {
            return false
          }
          return prev
        })
      } else {
        setCheckpointTeConfigured(false)
        setTeSubmitStrategy('upload_only')
        setCheckpointTeSandboxEnabled(prev => {
          if (prev) {
            return false
          }
          return prev
        })
      }
    } catch (error) {
      // Silently handle errors - service may not be ready yet
      // Don't break the UI if status check fails
      console.error('Failed to check Check Point TE status:', error)
      setCheckpointTeConfigured(false)
      setTeSubmitStrategy('upload_only')
      setCheckpointTeSandboxEnabled(prev => {
        if (prev) {
          return false
        }
        return prev
      })
    }
  }, [])

  // Keep ref in sync for refetch logic
  useEffect(() => {
    filesCountRef.current = files.length
  }, [files])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSecure(window.location.protocol === 'https:' || window.location.hostname === 'localhost')

      // Establish owner_id cookie from our X-Client-ID before list/store (same as smoke scripts; fixes list empty after nav)
      const establishOwner = async () => {
        await fetch('/api/owner', {
          ...apiFetchOptions,
          headers: ownerHeaders(),
        }).catch(() => {})
      }

      establishOwner().then(() => {
        // Load files from server (persistent storage)
        return loadFilesFromServer()
          .then(list => {
            if (list !== null) {
              if (list.length > 0) {
                setFiles(list)
                setServerSyncWarning(null)
                localStorage.setItem('uploadedFiles', JSON.stringify(list))
              } else {
                // Server returned empty list—preserve local cache so files don't vanish after navigation
                const stored = localStorage.getItem('uploadedFiles')
                if (stored) {
                  try {
                    const parsed = JSON.parse(stored)
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      const filesWithDates = parsed
                        .filter(isUploadedFile)
                        .map((f: UploadedFile) => ({
                          ...f,
                          uploadedAt: f.uploadedAt != null ? new Date(f.uploadedAt) : new Date(),
                        }))
                      setFiles(filesWithDates)
                      setServerSyncWarning(
                        'Files loaded from local cache. Server list was empty—re-upload or check storage.'
                      )
                      return
                    }
                  } catch (e) {
                    console.error('Failed to parse cached files:', e)
                  }
                }
                setFiles([])
                setServerSyncWarning(null)
                localStorage.setItem('uploadedFiles', JSON.stringify([]))
              }
            } else {
              const stored = localStorage.getItem('uploadedFiles')
              if (stored) {
                try {
                  const parsed = JSON.parse(stored)
                  if (!Array.isArray(parsed)) return
                  const filesWithDates = parsed.filter(isUploadedFile).map((f: UploadedFile) => ({
                    ...f,
                    uploadedAt: f.uploadedAt != null ? new Date(f.uploadedAt) : new Date(),
                  }))
                  setFiles(filesWithDates)
                } catch (e) {
                  console.error('Failed to load files from localStorage:', e)
                }
              }
            }
          })
          .catch(err => {
            console.error('Failed to load files from server:', err)
            const stored = localStorage.getItem('uploadedFiles')
            if (stored) {
              try {
                const parsed = JSON.parse(stored)
                if (!Array.isArray(parsed)) return
                const filesWithDates = parsed.filter(isUploadedFile).map((f: UploadedFile) => ({
                  ...f,
                  uploadedAt: f.uploadedAt != null ? new Date(f.uploadedAt) : new Date(),
                }))
                setFiles(filesWithDates)
              } catch (e) {
                console.error('Failed to load files from localStorage:', e)
              }
            }
          })
      })

      // Load Lakera scan toggle state from localStorage
      const scanToggle = localStorage.getItem('lakeraFileScanEnabled')
      if (scanToggle !== null) {
        setLakeraScanEnabled(JSON.parse(scanToggle))
      }

      // Load RAG scan toggle state from localStorage
      const ragToggle = localStorage.getItem('lakeraRagScanEnabled')
      if (ragToggle !== null) {
        setRagScanEnabled(JSON.parse(ragToggle))
      } else {
        // Default to true if not set
        setRagScanEnabled(true)
      }

      // Load Check Point TE sandboxing toggle state from localStorage
      const teSandboxToggle = localStorage.getItem('checkpointTeSandboxEnabled')
      if (teSandboxToggle !== null) {
        setCheckpointTeSandboxEnabled(JSON.parse(teSandboxToggle))
      }

      // Check if Check Point TE API key is configured
      // Use setTimeout to avoid blocking page load if endpoint is slow
      // Also check periodically to catch updates from Settings page
      const checkStatus = () => {
        checkCheckpointTeStatus().catch(err => {
          // Silently handle - don't break page load
          console.error('Check Point TE status check failed:', err)
        })
      }

      // Initial check
      const initialTimeout = setTimeout(checkStatus, 500)

      // Periodic check every 5 seconds to catch updates from Settings page
      const statusInterval = setInterval(checkStatus, 5000)

      // Cleanup interval and timeout on unmount
      return () => {
        clearTimeout(initialTimeout)
        clearInterval(statusInterval)
      }
    }
  }, [loadFilesFromServer, checkCheckpointTeStatus])

  // Refetch file list when user returns to this tab/window; do NOT overwrite with [] when server returns empty but we have local files (avoids "file vanished" when server storage fails)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const refetch = async () => {
      // Match initial page load: sync owner cookie with X-Client-ID so list/store use the same owner_id
      await fetch('/api/owner', {
        ...apiFetchOptions,
        headers: ownerHeaders(),
      }).catch(() => {})

      const list = await loadFilesFromServer().catch(() => null)
      if (list === null) {
        if (filesCountRef.current > 0) {
          setServerSyncWarning(
            'Could not refresh the file list from the server (network error, login session expired, or server error). Files shown may be outdated—retry after signing in or check server logs.'
          )
        }
        return
      }
      if (list.length > 0) {
        setFiles(list)
        setServerSyncWarning(null)
        if (typeof window !== 'undefined') {
          localStorage.setItem('uploadedFiles', JSON.stringify(list))
        }
      } else if (filesCountRef.current > 0) {
        setServerSyncWarning(
          'The server returned no files for this browser session, but the page still shows a previous list. Common causes: the server data directory was reset or moved (self-host: ensure ./data or DATA_DIR is persistent and writable), you opened another browser/profile, or the site data / owner id changed. Re-upload files or verify permissions on data/app.db and data/uploads.'
        )
      } else {
        setFiles([])
        setServerSyncWarning(null)
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refetch)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refetch)
    }
  }, [loadFilesFromServer])

  // Update file metadata on server. Uses safeFetchJson so non-JSON response never crashes.
  const updateFileMetadataOnServer = async (file: UploadedFile) => {
    const res = await safeFetchJson<{ ok?: boolean; error?: { message?: string } | string }>(
      '/api/files/store',
      {
        ...apiFetchOptions,
        method: 'POST',
        headers: { ...ownerHeaders(), 'Content-Type': 'application/json' },
        body: buildStoreBody(file, file.scanStatus, {
          scanResult: file.scanResult,
          scanDetails: file.scanDetails,
          checkpointTeDetails: file.checkpointTeDetails,
          skipServerLakeraScan: true,
          lakeraScanRequested: false,
        }),
      }
    )
    if (!res.ok) {
      const msg =
        res.error?.message ??
        (typeof res.data?.error === 'string'
          ? res.data.error
          : res.data?.error && typeof res.data.error === 'object' && 'message' in res.data.error
            ? String((res.data.error as { message?: string }).message)
            : 'Unknown error')
      console.error('Failed to update file metadata on server:', msg)
    }
  }

  // Save toggle states to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lakeraFileScanEnabled', JSON.stringify(lakeraScanEnabled))
    }
  }, [lakeraScanEnabled])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lakeraRagScanEnabled', JSON.stringify(ragScanEnabled))
    }
  }, [ragScanEnabled])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('checkpointTeSandboxEnabled', JSON.stringify(checkpointTeSandboxEnabled))
    }
  }, [checkpointTeSandboxEnabled])

  // Check TE status when toggle is enabled
  useEffect(() => {
    if (checkpointTeSandboxEnabled && !checkpointTeConfigured) {
      checkCheckpointTeStatus()
    }
  }, [checkpointTeSandboxEnabled, checkpointTeConfigured, checkCheckpointTeStatus])

  // Save files to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && files.length >= 0) {
      localStorage.setItem('uploadedFiles', JSON.stringify(files))
    }
  }, [files])

  const handleFileUpload = async (newFile: UploadedFile) => {
    // Two independent engines (configure separately in Settings / toggles):
    // - Check Point Threat Emulation (TE): malware / malicious code in the file binary.
    // - Lakera Guard: prompt injection, system override, and other LLM/content policy signals in extracted text.
    // When both are on, TE runs first on the client, then Lakera runs after TE is safe (or in parallel with server Lakera on first store if enabled).

    setFiles(prev => [...prev, newFile])
    setStoreError(null)

    const headers = { ...ownerHeaders(), 'Content-Type': 'application/json' }
    const storeResult = await safeFetchJson<{
      ok?: boolean
      error?: { message?: string } | string
    }>('/api/files/store', {
      ...apiFetchOptions,
      method: 'POST',
      headers,
      body: buildStoreBody(newFile, 'pending', { lakeraScanRequested: lakeraScanEnabled }),
    })
    if (storeResult.ok) {
      setStoreError(null)
      // Sync with server so list/store use same owner and file persists after navigation
      loadFilesFromServer().then(list => {
        if (list !== null) setFiles(list)
      })
    } else {
      const dataErr = storeResult.data?.error
      const msg =
        storeResult.error?.message ??
        (typeof dataErr === 'string'
          ? dataErr
          : dataErr && typeof dataErr === 'object' && 'message' in dataErr
            ? String((dataErr as { message?: string }).message)
            : 'Failed to save file to server')
      console.error('Failed to store file on server:', msg)
      setStoreError(msg)
    }

    if (checkpointTeSandboxEnabled && checkpointTeConfigured) {
      setTimeout(() => handleCheckpointTeSandbox(newFile.id), 300)
      return
    }
    if (lakeraScanEnabled) {
      setTimeout(() => handleFileScan(newFile.id), 300)
      return
    }

    setFiles(prev =>
      prev.map(f => (f.id === newFile.id ? { ...f, scanStatus: 'not_scanned' as const } : f))
    )
    const res = await safeFetchJson<{ ok?: boolean; error?: { message?: string } | string }>(
      '/api/files/store',
      {
        ...apiFetchOptions,
        method: 'POST',
        headers: { ...ownerHeaders(), 'Content-Type': 'application/json' },
        body: buildStoreBody(newFile, 'not_scanned', { lakeraScanRequested: false }),
      }
    )
    if (res.ok) {
      setStoreError(null)
      triggerRagEmbed([newFile.id]).catch(err => console.warn('RAG embed after store:', err))
      // Sync with server so file list persists after navigation
      loadFilesFromServer().then(list => {
        if (list !== null) setFiles(list)
      })
    } else {
      const dataErr = res.data?.error
      setStoreError(
        res.error?.message ??
          (typeof dataErr === 'string'
            ? dataErr
            : dataErr && typeof dataErr === 'object' && 'message' in dataErr
              ? String((dataErr as { message?: string }).message)
              : 'Failed to save file to server')
      )
    }
  }

  const handleFileRemove = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/delete?fileId=${encodeURIComponent(fileId)}`, {
        ...apiFetchOptions,
        method: 'DELETE',
        headers: ownerHeaders(),
      })

      if (response.ok) {
        const list = await loadFilesFromServer()
        if (list !== null) {
          setFiles(list)
          if (typeof window !== 'undefined')
            localStorage.setItem('uploadedFiles', JSON.stringify(list))
        } else {
          setFiles(prev => prev.filter(f => f.id !== fileId))
          if (typeof window !== 'undefined') {
            const rest = JSON.parse(localStorage.getItem('uploadedFiles') || '[]').filter(
              (f: { id: string }) => f.id !== fileId
            )
            localStorage.setItem('uploadedFiles', JSON.stringify(rest))
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to delete file from server:', errorData.error || 'Unknown error')
        // Show error but don't remove from UI if server deletion fails
        alert(`Failed to delete file: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting file from server:', error)
      alert(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Handle Clear All Files
  const handleClearAll = async () => {
    if (files.length === 0) {
      return
    }

    if (
      !confirm(
        `Are you sure you want to delete all ${files.length} file(s)? This action cannot be undone.`
      )
    ) {
      return
    }

    try {
      const result = await safeFetchJson<{ ok?: boolean; error?: { message?: string } | string }>(
        '/api/files/clear',
        {
          ...apiFetchOptions,
          method: 'POST',
          headers: ownerHeaders(),
        }
      )
      if (result.ok) {
        const list = await loadFilesFromServer()
        setFiles(list !== null ? list : [])
        if (typeof window !== 'undefined') localStorage.setItem('uploadedFiles', '[]')
      } else {
        const msg =
          result.error?.message ??
          (typeof result.data?.error === 'string'
            ? result.data.error
            : result.data?.error &&
                typeof result.data.error === 'object' &&
                'message' in result.data.error
              ? String((result.data.error as { message?: string }).message)
              : 'Unknown error')
        alert(`Failed to clear all files: ${msg}`)
      }
    } catch (error) {
      console.error('Error clearing all files:', error)
      alert(
        `Failed to clear all files: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  // Handle Check Point TE sandboxing
  const handleCheckpointTeSandbox = async (fileId: string) => {
    // Get file from current state - need to wait for state update
    const currentFiles =
      files.length > 0 ? files : JSON.parse(localStorage.getItem('uploadedFiles') || '[]')
    let file = currentFiles.find((f: UploadedFile) => f.id === fileId)

    // If still not found, wait a bit and try again
    if (!file) {
      await new Promise(resolve => setTimeout(resolve, 100))
      const updatedFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]')
      file = updatedFiles.find((f: UploadedFile) => f.id === fileId)
    }

    if (!file) {
      console.error('File not found for Check Point TE sandboxing:', fileId)
      return
    }

    // Update file status to scanning
    setFiles(prev =>
      prev.map(f =>
        f.id === fileId ? { ...f, scanStatus: 'scanning' as const, scanResult: undefined } : f
      )
    )

    try {
      setIsScanning(true)

      const cfgRes = await fetch(`/api/te/config?t=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      const cfgJson = cfgRes.ok
        ? ((await cfgRes.json().catch(() => ({}))) as {
            teSubmitStrategy?: string
            hashLookupOnly?: boolean
          })
        : {}
      const strategy = parseTeSubmitStrategyFromConfig(cfgJson)

      let fileBlob: Blob
      try {
        fileBlob = await uploadedFileToBlob(file)
      } catch (error) {
        throw new Error(
          `Failed to read file for Check Point TE: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }

      let sha256: string | undefined
      let sha1: string | undefined
      let md5: string | undefined
      let teImageId: string | undefined
      let teRevision: number | undefined
      let teResolvedBase: string | undefined
      let verdict: TeVerdict = 'pending'
      let teResult: CheckPointTEResponse | null = null

      let resolvedWithoutUpload = false
      if (strategy === 'auto') {
        sha256 = await sha256HexFromBlob(fileBlob)
        const pre = await checkpointTePollQuery({
          sha256,
          maxAttempts: 8,
          pollIntervalMs: 1500,
          skipDelayOnFirstAttempt: true,
        })
        if (pre.verdict === 'safe' || pre.verdict === 'malicious') {
          verdict = pre.verdict
          teResult = pre.teResult
          resolvedWithoutUpload = true
        }
      }

      if (!resolvedWithoutUpload) {
        if (strategy === 'hash_only') {
          sha256 = await sha256HexFromBlob(fileBlob)
        } else if (strategy === 'upload_only' || strategy === 'auto') {
          const formData = new FormData()
          formData.append('file', fileBlob, file.name)

          const uploadResponse = await fetch('/api/te/upload', {
            credentials: 'include',
            cache: 'no-store',
            method: 'POST',
            body: formData,
          })

          if (!uploadResponse.ok) {
            let errorMessage = 'Failed to upload file to Check Point TE'
            try {
              const errorData = (await uploadResponse.json()) as {
                error?: string
                message?: string
                details?: unknown
                troubleshooting?: string
              }
              errorMessage = errorData.error || errorData.message || errorMessage
              if (
                typeof errorData.troubleshooting === 'string' &&
                errorData.troubleshooting.trim().length > 0
              ) {
                const extra = errorData.troubleshooting.trim()
                errorMessage = `${errorMessage.trim()}\n\n${extra}`
              }
            } catch {
              try {
                const errorText = await uploadResponse.text()
                errorMessage = `Upload failed (${uploadResponse.status}): ${errorText.substring(0, 200)}`
              } catch {
                errorMessage = `Upload failed with status ${uploadResponse.status} ${uploadResponse.statusText}`
              }
            }
            throw new Error(errorMessage)
          }

          let uploadData: {
            success?: boolean
            data?: {
              sha256?: string
              sha1?: string
              md5?: string
              teImageId?: string
              teRevision?: number
              teResolvedBase?: string
            }
            error?: string
          }
          try {
            uploadData = await uploadResponse.json()
          } catch {
            throw new Error('Invalid response format from Check Point TE upload API')
          }

          if (!uploadData.success || !uploadData.data) {
            throw new Error(uploadData.error || 'Upload succeeded but no data returned')
          }

          sha256 = uploadData.data.sha256
          sha1 = uploadData.data.sha1
          md5 = uploadData.data.md5
          teImageId = uploadData.data.teImageId
          teRevision = uploadData.data.teRevision
          teResolvedBase = uploadData.data.teResolvedBase
        }

        if (!sha256 && !sha1 && !md5) {
          throw new Error('No file hash available for Check Point TE')
        }

        const mainPoll = await checkpointTePollQuery({
          sha256,
          sha1,
          md5,
          teImageId,
          teRevision,
          teResolvedBase,
          maxAttempts: strategy === 'hash_only' ? 15 : 30,
          pollIntervalMs: 2000,
          skipDelayOnFirstAttempt: strategy === 'hash_only',
        })
        verdict = mainPoll.verdict
        teResult = mainPoll.teResult
      }

      // Step 3: Update file status based on verdict
      // Extract TE log fields from query response
      const teLogFields = teResult?.logFields || {}
      const teStatus = teResult?.status || 'unknown'
      const teVerdict = teResult?.verdict || verdict

      // Build detailed scan result message with TE findings
      let scanResultMessage = ''
      let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

      if (verdict === 'pending' || verdict === 'unknown') {
        scanResultMessage =
          strategy === 'hash_only'
            ? 'Check Point TE (hash-only): No verdict in Threat Cloud for this SHA-256. File bytes were not sent to Check Point — only reputation lookup. New or rare files will often show this; set server env CHECKPOINT_TE_HASH_LOOKUP_ONLY=false or upload_only for full sandbox, or leave unset for automatic hash-then-upload.'
            : 'Check Point TE analysis completed but verdict is unclear. File allowed.'

        setFiles(prev =>
          prev.map(f => {
            if (f.id === fileId) {
              const updatedFile = {
                ...f,
                scanStatus: 'safe' as const,
                scanResult: scanResultMessage,
                scanDetails: { categories: {}, score: 0 },
                checkpointTeDetails: {
                  logFields: teLogFields,
                  verdict: teVerdict,
                  status: teStatus,
                },
              }
              // Update server metadata asynchronously
              updateFileMetadataOnServer(updatedFile).catch(err =>
                console.error('Failed to update file metadata:', err)
              )
              return updatedFile
            }
            return f
          })
        )

        addLog({
          type: 'file_scan',
          action: 'scanned',
          source: 'file_upload',
          requestDetails: {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          },
          checkpointTeDecision: {
            scanned: true,
            flagged: false,
            verdict: teVerdict,
            status: teStatus,
            logFields: teLogFields,
            message: scanResultMessage,
          },
          success: true,
        })
      } else if (verdict === 'malicious') {
        // Block malicious file - build detailed message with findings
        const severity = teLogFields.severity || 'High'
        const protectionName = teLogFields.protection_name || 'Unknown protection'
        const attackName = teLogFields.attack || 'Malicious content'
        const attackInfo = teLogFields.attack_info || ''
        const confidence = teLogFields.confidence_level || teLogFields.confidence
        const determinedBy = teLogFields.te_verdict_determined_by || ''

        // Determine threat level from severity
        if (severity === 'Critical') threatLevel = 'critical'
        else if (severity === 'High') threatLevel = 'high'
        else if (severity === 'Medium') threatLevel = 'medium'
        else threatLevel = 'low'

        // Build detailed result message
        scanResultMessage = `File blocked by Check Point Threat Emulation`
        const details: string[] = []
        if (attackName) details.push(`Attack: ${attackName}`)
        if (attackInfo) details.push(`Details: ${attackInfo}`)
        if (protectionName) details.push(`Protection: ${protectionName}`)
        if (severity) details.push(`Severity: ${severity}`)
        if (confidence) details.push(`Confidence: ${confidence}`)
        if (determinedBy) details.push(`Analyzed by: ${determinedBy}`)
        if (details.length > 0) {
          scanResultMessage += `\n${details.join('\n')}`
        }

        setFiles(prev =>
          prev.map(f => {
            if (f.id === fileId) {
              const updatedFile = {
                ...f,
                scanStatus: 'flagged' as const,
                scanResult: scanResultMessage,
                scanDetails: {
                  categories: { malicious: true, checkpoint_te: true },
                  score: teLogFields.file_risk ? teLogFields.file_risk / 10 : 1.0,
                },
                checkpointTeDetails: {
                  logFields: teLogFields,
                  verdict: teVerdict,
                  status: teStatus,
                },
              }
              // Update server metadata asynchronously
              updateFileMetadataOnServer(updatedFile).catch(err =>
                console.error('Failed to update file metadata:', err)
              )
              return updatedFile
            }
            return f
          })
        )

        addLog({
          type: 'file_scan',
          action: 'blocked',
          source: 'file_upload',
          requestDetails: {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            threatLevel: threatLevel,
          },
          checkpointTeDecision: {
            scanned: true,
            flagged: true,
            verdict: teVerdict,
            status: teStatus,
            logFields: teLogFields,
            message: scanResultMessage,
          },
          success: false,
        })

        alert(
          `File blocked: Check Point Threat Emulation detected malicious content.\n\n${details.join('\n')}`
        )
        return // Don't proceed with other scans
      } else {
        // Safe - proceed with normal flow
        const severity = teLogFields.severity || 'Low'
        const confidence = teLogFields.confidence_level || teLogFields.confidence || 'Medium'
        const analyzedOn = teLogFields.analyzed_on || 'Check Point Threat Emulation Cloud'

        scanResultMessage = `File passed Check Point TE sandboxing`
        const details: string[] = []
        if (analyzedOn) details.push(`Analyzed on: ${analyzedOn}`)
        if (severity) details.push(`Severity: ${severity}`)
        if (confidence) details.push(`Confidence: ${confidence}`)
        if (teLogFields.protection_type)
          details.push(`Protection type: ${teLogFields.protection_type}`)
        if (details.length > 0) {
          scanResultMessage += `\n${details.join('\n')}`
        }

        setFiles(prev =>
          prev.map(f => {
            if (f.id === fileId) {
              const updatedFile = {
                ...f,
                scanStatus: 'safe' as const,
                scanResult: scanResultMessage,
                scanDetails: {
                  categories: { safe: true, checkpoint_te: true },
                  score: 0,
                },
                checkpointTeDetails: {
                  logFields: teLogFields,
                  verdict: teVerdict,
                  status: teStatus,
                },
              }
              // Update server metadata asynchronously
              updateFileMetadataOnServer(updatedFile).catch(err =>
                console.error('Failed to update file metadata:', err)
              )
              return updatedFile
            }
            return f
          })
        )

        addLog({
          type: 'file_scan',
          action: 'scanned',
          source: 'file_upload',
          requestDetails: {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          },
          checkpointTeDecision: {
            scanned: true,
            flagged: false,
            verdict: teVerdict,
            status: teStatus,
            logFields: teLogFields,
            message: scanResultMessage,
          },
          success: true,
        })

        // Lakera (content / prompt policy) is independent of Check Point TE — run when the Lakera toggle is on, regardless of RAG toggle.
        if (lakeraScanEnabled) {
          setTimeout(() => {
            handleFileScan(fileId, { teAlreadySafe: true })
          }, 300)
        } else if (ragScanEnabled) {
          triggerRagEmbed([fileId]).catch(err => console.warn('RAG embed after TE safe:', err))
        }
      }
    } catch (error) {
      let message = 'Check Point TE sandboxing failed'

      if (error instanceof Error) {
        message = error.message
        // API already appends troubleshooting with blank line — do not add generic suffixes (they duplicated 403 text and matched "API key" inside it).
        if (!message.includes('\n\n')) {
          if (/\b401\b/i.test(message) || /invalid check point te api key/i.test(message)) {
            message += ' Check your TE API key in Settings (no TE_API_KEY_ prefix).'
          } else if (message.includes('404') || message.includes('not found')) {
            message += ' Check CHECKPOINT_TECLOUD_BASE_URL and Settings.'
          } else if (message.includes('429') || message.includes('rate limit')) {
            message += ' Rate limit exceeded — wait and retry.'
          } else if (
            message.includes('network') ||
            message.includes('connect') ||
            message.includes('fetch')
          ) {
            message += ' Check network and firewall.'
          } else if (message.includes('timeout')) {
            message += ' Request timed out — file may be large or TE slow.'
          }
        }
      }

      const msg = error instanceof Error ? error.message : String(error)
      const isExpectedApiDenial =
        /\b403\b|\b401\b|access denied|Invalid Check Point TE API key/i.test(msg)
      if (isExpectedApiDenial) {
        console.warn('Check Point TE:', msg.split('\n')[0])
      } else {
        console.error('Check Point TE sandboxing error:', error)
      }

      setFiles(prev =>
        prev.map(f => {
          if (f.id === fileId) {
            const updatedFile = {
              ...f,
              scanStatus: 'error' as const,
              scanResult: message,
            }
            // Update server metadata asynchronously
            updateFileMetadataOnServer(updatedFile).catch(err =>
              console.error('Failed to update file metadata:', err)
            )
            return updatedFile
          }
          return f
        })
      )

      addLog({
        type: 'error',
        action: 'error',
        source: 'file_upload',
        requestDetails: {
          fileName: file?.name || 'unknown',
          fileType: file?.type || 'unknown',
          fileSize: file?.size || 0,
        },
        error: message,
        success: false,
      })
    } finally {
      setIsScanning(false)
    }
  }

  const handleFileScan = async (fileId: string, opts?: { teAlreadySafe?: boolean }) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return

    // Check if Lakera scanning is enabled
    if (!lakeraScanEnabled) {
      alert('Lakera scanning is disabled. Please enable it using the toggle above.')
      return
    }

    setIsScanning(true)

    const tePipelineOn = checkpointTeSandboxEnabled && checkpointTeConfigured
    const teVerdictEarly = file.checkpointTeDetails?.verdict as string | undefined
    const teClearForRag =
      opts?.teAlreadySafe === true ||
      !tePipelineOn ||
      teVerdictEarly === 'safe' ||
      teVerdictEarly === 'unknown'

    // Update file status to scanning
    setFiles(prev =>
      prev.map(f =>
        f.id === fileId ? { ...f, scanStatus: 'scanning' as const, scanResult: undefined } : f
      )
    )

    try {
      // Check if Lakera API key is configured (server-side)
      // The API route will use server-side keys if available
      // We just need to verify it's configured
      const keysResponse = await fetch('/api/keys', apiFetchOptions).catch(() => null)
      let lakeraConfigured = false

      if (keysResponse?.ok) {
        const keysData = await keysResponse.json()
        lakeraConfigured = keysData.configured?.lakeraAiKey || false
      } else {
        // Fallback: check localStorage for backward compatibility
        const apiKeys = localStorage.getItem('apiKeys')
        const keys = apiKeys ? JSON.parse(apiKeys) : {}
        lakeraConfigured = !!keys.lakeraAiKey
      }

      if (!lakeraConfigured) {
        setFiles(prev =>
          prev.map(f =>
            f.id === fileId
              ? {
                  ...f,
                  scanStatus: 'error' as const,
                  scanResult: 'Lakera API key not configured. Please add it in Settings.',
                }
              : f
          )
        )
        setIsScanning(false)
        return
      }

      // Get keys for endpoint validation
      let endpoint = 'https://api.lakera.ai/v2/guard'

      // Try to get endpoint from server-side or localStorage
      if (keysResponse?.ok) {
        const keysData = await keysResponse.json()
        // Fix: Correct operator precedence - check if endpoint is configured OR source is storage
        const shouldFetchEndpoint =
          keysData.configured?.lakeraEndpoint || keysData.source?.lakeraEndpoint === 'storage'
        endpoint = shouldFetchEndpoint
          ? await fetch('/api/keys/retrieve', apiFetchOptions)
              .then(r => r.json())
              .then(d => d.keys?.lakeraEndpoint || endpoint)
              .catch(() => endpoint)
          : endpoint
      } else {
        // Fallback: check localStorage
        const apiKeys = localStorage.getItem('apiKeys')
        const localKeys = apiKeys ? JSON.parse(apiKeys) : {}
        endpoint = localKeys.lakeraEndpoint || endpoint
      }

      // Validate endpoint
      if (!endpoint || !endpoint.startsWith('http')) {
        setFiles(prev =>
          prev.map(f =>
            f.id === fileId
              ? {
                  ...f,
                  scanStatus: 'error' as const,
                  scanResult: 'Invalid Lakera endpoint. Please check Settings.',
                }
              : f
          )
        )
        setIsScanning(false)
        return
      }

      // The API route will use server-side keys if available
      // We don't need to send keys from client (server-side keys take priority)
      const response = await fetch('/api/scan', {
        ...apiFetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileContent: file.content,
          fileName: file.name,
          // Send empty object - API route will use server-side keys automatically
          apiKeys: {},
        }),
      })

      let data: {
        flagged: boolean
        message?: string
        error?: string
        details?: {
          categories?: Record<string, boolean>
          score?: number
          threatLevel?: 'low' | 'medium' | 'high' | 'critical'
          // Official payload data (detected threats with locations)
          payload?: Array<{
            start: number
            end: number
            text: string
            detector_type: string
            labels: string[]
            message_id: number
          }>
          // Official breakdown data (detector results)
          breakdown?: Array<{
            project_id: string
            policy_id: string
            detector_id: string
            detector_type: string
            detected: boolean
            message_id: number
          }>
        }
        logData?: unknown
      }

      // Clone response before reading to avoid "body stream already read" error
      // This is especially important for large files (500+ individuals)
      const responseClone = response.clone()
      const contentType = response.headers.get('content-type')
      const isJson = contentType && contentType.includes('application/json')

      if (isJson) {
        try {
          // Read from cloned response to avoid stream consumption issues
          data = await responseClone.json()
        } catch (parseError) {
          // If clone fails, try original response
          try {
            data = await response.json()
          } catch (fallbackError) {
            // If both fail, try reading as text for better error message
            const text = await response.text()
            throw new Error(
              `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Response: ${text.substring(0, 500)}`
            )
          }
        }
      } else {
        // If not JSON, read as text
        const text = await response.text()
        throw new Error(`Unexpected response format: ${text.substring(0, 200)}`)
      }

      if (!response.ok) {
        // More detailed error message with details if available
        let errorMsg = data?.error || `Scan failed with status ${response.status}`

        // Add details if available
        if (data?.details) {
          if (typeof data.details === 'string') {
            errorMsg += ` - ${data.details}`
          } else if (typeof data.details === 'object') {
            try {
              const detailsStr = JSON.stringify(data.details).substring(0, 200)
              errorMsg += ` - ${detailsStr}`
            } catch {
              errorMsg += ' - Error details available but could not be displayed'
            }
          }
        }

        throw new Error(errorMsg)
      }

      // Log the scan result
      if (data.logData) {
        const associatedRisks = getAssociatedRisksFromLakeraDecision(
          data.details?.categories,
          data.flagged ? 'blocked' : 'scanned',
          'file_scan'
        )
        const logData = data.logData as Omit<import('@/types/logs').LogEntry, 'id' | 'timestamp'>
        addLog({
          ...logData,
          associatedRisks,
        })
      } else {
        const associatedRisks = getAssociatedRisksFromLakeraDecision(
          data.details?.categories,
          data.flagged ? 'blocked' : 'scanned',
          'file_scan'
        )
        addLog({
          type: 'file_scan',
          action: data.flagged ? 'blocked' : 'scanned',
          source: 'file_upload',
          requestDetails: {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          },
          lakeraDecision: {
            scanned: true,
            flagged: data.flagged,
            categories: data.details?.categories,
            scores: data.details?.score ? { threat: data.details.score } : undefined,
            message: data.message,
            payload: data.details?.payload, // Include official payload data
            breakdown: data.details?.breakdown, // Include official breakdown data
          },
          success: true,
          associatedRisks,
        })
      }

      setFiles(prev =>
        prev.map(f => {
          if (f.id === fileId) {
            const updatedFile: UploadedFile = {
              ...f,
              scanStatus: data.flagged ? ('flagged' as const) : ('safe' as const),
              scanResult:
                data.message || (data.flagged ? 'Security threats detected' : 'File is safe'),
              scanDetails: data.details
                ? {
                    categories: data.details.categories,
                    score: data.details.score,
                    threatLevel: data.details.threatLevel,
                    payload: data.details.payload, // Include official payload data
                    breakdown: data.details.breakdown, // Include official breakdown data
                  }
                : undefined,
            }
            // Update server metadata asynchronously
            updateFileMetadataOnServer(updatedFile).catch(err =>
              console.error('Failed to update file metadata:', err)
            )
            // RAG only after Check Point TE is clear when TE sandboxing is enabled (engines are independent but both must pass).
            if (!data.flagged && teClearForRag) {
              triggerRagEmbed([fileId]).catch(err =>
                console.warn('RAG embed after Lakera safe:', err)
              )
            }
            return updatedFile
          }
          return f
        })
      )
    } catch (error) {
      let message = 'Scan failed. Please check your API configuration.'

      if (error instanceof Error) {
        message = error.message

        // Add helpful suggestions based on error type
        if (
          error.message.includes('401') ||
          error.message.includes('Invalid') ||
          error.message.includes('API key')
        ) {
          message += ' - Please check your Lakera API key in Settings.'
        } else if (error.message.includes('403') || error.message.includes('denied')) {
          message += ' - Please check your API key and project ID in Settings.'
        } else if (error.message.includes('404') || error.message.includes('not found')) {
          message += ' - Please check your Lakera endpoint URL in Settings.'
        } else if (error.message.includes('429') || error.message.includes('rate limit')) {
          message += ' - Please wait a moment and try again.'
        } else if (error.message.includes('network') || error.message.includes('connect')) {
          message += ' - Check your internet connection and API endpoint.'
        }
      }

      // Log error
      addLog({
        type: 'error',
        action: 'error',
        source: 'file_upload',
        requestDetails: {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        },
        error: message,
        success: false,
        associatedRisks: ['llm03'], // Supply Chain risk for errors
      })

      setFiles(prev =>
        prev.map(f => {
          if (f.id === fileId) {
            const updatedFile = { ...f, scanStatus: 'error' as const, scanResult: message }
            // Update server metadata asynchronously
            updateFileMetadataOnServer(updatedFile).catch(err =>
              console.error('Failed to update file metadata:', err)
            )
            return updatedFile
          }
          return f
        })
      )
    } finally {
      setIsScanning(false)
    }
  }

  const filesPageFallback = (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="glass-card rounded-xl p-6 max-w-md w-full border-red-400/30">
        <h2 className="text-xl font-semibold text-theme mb-4">File Upload error</h2>
        <p className="text-theme-muted mb-4">
          Something went wrong on this page. Please refresh or try again. If the problem continues,
          check that the server is running and your session is valid.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-brand-berry px-4 py-2 text-white hover:opacity-90"
        >
          Reload page
        </button>
      </div>
    </div>
  )

  return (
    <ErrorBoundary fallback={filesPageFallback}>
      <div className="bento-grid">
        {/* Sync / store error banners */}
        {(serverSyncWarning || storeError) && (
          <div className="bento-span-4 flex flex-col gap-2">
            {serverSyncWarning && (
              <div className="flex items-center justify-between gap-4 rounded-xl border-2 border-amber-400/50 bg-amber-500/10 px-4 py-3 text-amber-200">
                <span className="text-sm">{serverSyncWarning}</span>
                <button
                  type="button"
                  onClick={() => setServerSyncWarning(null)}
                  className="shrink-0 rounded px-2 py-1 text-xs hover:bg-amber-500/20"
                  aria-label="Dismiss"
                >
                  Dismiss
                </button>
              </div>
            )}
            {storeError && (
              <div className="flex items-center justify-between gap-4 rounded-xl border-2 border-red-400/50 bg-red-500/10 px-4 py-3 text-red-200">
                <span className="text-sm">Save failed: {storeError}</span>
                <button
                  type="button"
                  onClick={() => setStoreError(null)}
                  className="shrink-0 rounded px-2 py-1 text-xs hover:bg-red-500/20"
                  aria-label="Dismiss"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}
        {/* Header Card */}
        <div
          className="bento-card bento-span-4 glass-card p-6 liquid-shimmer border-2"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-theme drop-shadow-lg">File Upload & RAG</h1>
              <p className="mt-2 text-base text-theme-muted">
                Upload documents for RAG (Retrieval-Augmented Generation). Files are scanned by
                Lakera AI for security.
              </p>
            </div>
            <div className="mt-4">
              <SecurityIndicator isSecure={isSecure} />
            </div>
          </div>
        </div>

        {/* Upload Section Card */}
        <div
          className="bento-card bento-span-2 glass-card p-6 border-2"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-theme">Upload Files</h2>
          </div>

          {/* Toggle Options - More Visible */}
          <div className="mb-6 space-y-4">
            <div className="glass-card rounded-xl p-4 border-brand-berry/30">
              <h3 className="text-base font-semibold text-theme mb-3">Scanning Options</h3>

              {/* Lakera Scan Toggle */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-theme">Lakera Scan</span>
                    {/* Status Dot */}
                    <div
                      className={`h-2 w-2 rounded-full transition-all ${
                        lakeraScanEnabled ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      title={lakeraScanEnabled ? 'Enabled' : 'Disabled'}
                      style={{
                        boxShadow: lakeraScanEnabled
                          ? '0 0 8px rgba(34, 197, 94, 0.6)'
                          : '0 0 8px rgba(239, 68, 68, 0.6)',
                      }}
                    />
                  </div>
                  <span className="text-base text-theme-subtle mt-1">
                    Enable manual file scanning
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lakeraScanEnabled}
                      onChange={e => {
                        setLakeraScanEnabled(e.target.checked)
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-white/20 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-berry/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/30 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-berry/50"></div>
                    <span
                      className={`ml-3 text-base font-medium ${lakeraScanEnabled ? 'text-brand-berry' : 'text-white/60'}`}
                    >
                      {lakeraScanEnabled ? 'ON' : 'OFF'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Lakera after upload (upload pipeline only; chat file context is controlled on the Chat page) */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-theme">Lakera after upload</span>
                    {/* Status Dot */}
                    <div
                      className={`h-2 w-2 rounded-full transition-all ${
                        ragScanEnabled && lakeraScanEnabled ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      title={ragScanEnabled && lakeraScanEnabled ? 'Active on new uploads' : 'Off'}
                      style={{
                        boxShadow:
                          ragScanEnabled && lakeraScanEnabled
                            ? '0 0 8px rgba(34, 197, 94, 0.6)'
                            : '0 0 8px rgba(239, 68, 68, 0.6)',
                      }}
                    />
                  </div>
                  <span className="text-base text-theme-subtle mt-1 max-w-md">
                    When ON: run Lakera on each new upload before RAG indexing, and run Lakera on
                    each snippet retrieved in chat (requires Lakera Scan ON). Chat can still read
                    stored file text when this is OFF — enable &quot;Use uploaded files in
                    chat&quot; on the home page.
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ragScanEnabled}
                      onChange={e => setRagScanEnabled(e.target.checked)}
                      disabled={!lakeraScanEnabled}
                      className="sr-only peer"
                    />
                    <div
                      className={`w-14 h-7 bg-white/20 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-berry/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/30 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-berry/50 ${!lakeraScanEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    ></div>
                    <span
                      className={`ml-3 text-base font-medium ${ragScanEnabled && lakeraScanEnabled ? 'text-brand-berry' : 'text-white/60'}`}
                    >
                      {ragScanEnabled && lakeraScanEnabled ? 'ON' : 'OFF'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Check Point TE Sandboxing Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-theme">
                      File Sandboxing (Check Point TE)
                    </span>
                    {/* Status Dot */}
                    <div
                      className={`h-2 w-2 rounded-full transition-all ${
                        checkpointTeSandboxEnabled && checkpointTeConfigured
                          ? 'bg-green-500'
                          : 'bg-red-500'
                      }`}
                      title={
                        checkpointTeSandboxEnabled && checkpointTeConfigured
                          ? 'Enabled'
                          : 'Disabled'
                      }
                      style={{
                        boxShadow:
                          checkpointTeSandboxEnabled && checkpointTeConfigured
                            ? '0 0 8px rgba(34, 197, 94, 0.6)'
                            : '0 0 8px rgba(239, 68, 68, 0.6)',
                      }}
                    />
                  </div>
                  <span className="text-base text-theme-subtle mt-1">
                    {checkpointTeConfigured
                      ? teSubmitStrategy === 'hash_only'
                        ? 'TE hash-only mode: only SHA-256 is sent to Check Point (no file upload). Verdicts if the hash is already known to Threat Cloud.'
                        : teSubmitStrategy === 'auto'
                          ? 'Automatic TE mode: reputation lookup by SHA-256 first; full upload only if Threat Cloud has no verdict yet.'
                          : 'Sandbox files with Check Point Threat Emulation (full upload).'
                      : '⚠️ API key not configured in Settings'}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkpointTeSandboxEnabled && checkpointTeConfigured}
                      onChange={e => {
                        if (!checkpointTeConfigured) {
                          alert(
                            'Check Point TE API key is not configured. Please configure it in Settings first.'
                          )
                          return
                        }
                        setCheckpointTeSandboxEnabled(e.target.checked)
                      }}
                      disabled={!checkpointTeConfigured}
                      className="sr-only peer"
                    />
                    <div
                      className={`w-14 h-7 bg-white/20 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-berry/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/30 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-berry/50 ${!checkpointTeConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
                    ></div>
                    <span
                      className={`ml-3 text-base font-medium ${checkpointTeSandboxEnabled && checkpointTeConfigured ? 'text-brand-berry' : 'text-white/60'}`}
                    >
                      {checkpointTeSandboxEnabled && checkpointTeConfigured ? 'ON' : 'OFF'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <FileUploader
            onFileUpload={handleFileUpload}
            lakeraScanEnabled={lakeraScanEnabled}
            ragScanEnabled={ragScanEnabled}
          />
        </div>

        {/* Files List Section Card */}
        <div
          className="bento-card bento-span-2 bento-row-span-2 glass-card p-6 overflow-hidden flex flex-col border-2"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <h2 className="text-xl font-semibold text-theme mb-4">Uploaded Files ({files.length})</h2>
          <FileList
            files={files}
            onRemove={handleFileRemove}
            onClearAll={handleClearAll}
            onScan={handleFileScan}
            isScanning={isScanning}
            lakeraScanEnabled={lakeraScanEnabled}
          />
        </div>

        {/* Info Section Card */}
        <div
          className="bento-card bento-span-2 glass-card p-4 border-2"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <h3 className="text-brand-berry font-medium mb-2">📁 Supported Features</h3>
          <ul className="text-base text-theme-muted space-y-1">
            <li>• RAG supports up to 10 files for chat interaction</li>
            <li>• Maximum file size: 50 MB per file</li>
            <li>• Supported formats: PDF, TXT, MD, JSON, CSV, DOCX</li>
            <li>• Lakera AI security scanning for uploaded content</li>
            <li>• Files stored persistently on server</li>
          </ul>
        </div>
      </div>
    </ErrorBoundary>
  )
}
