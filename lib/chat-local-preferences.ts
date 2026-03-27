/**
 * Client-only preferences for chat + RAG. Keys are read in the browser when calling /api/chat.
 */

export const LS_CHAT_USE_UPLOADS = 'chatUseUploadedFilesContext'
/** Upload pipeline + per-chunk Lakera on retrieval (Files page) */
export const LS_LAKERA_RAG_SCAN = 'lakeraRagScanEnabled'
/** Lakera manual / upload scanning enabled (Files page first toggle) */
export const LS_LAKERA_FILE_SCAN = 'lakeraFileScanEnabled'

function parseLsBool(key: string, defaultTrue: boolean): boolean {
  if (typeof window === 'undefined') return defaultTrue
  const raw = localStorage.getItem(key)
  if (raw === null) return defaultTrue
  try {
    const v = JSON.parse(raw) as unknown
    if (v === false) return false
    if (v === true) return true
    return defaultTrue
  } catch {
    return defaultTrue
  }
}

/** Include uploaded file text in chat answers (independent of Lakera / Check Point upload scans). Default ON. */
export function readChatUseUploadsInChat(): boolean {
  return parseLsBool(LS_CHAT_USE_UPLOADS, true)
}

/** Run Lakera Guard on each retrieved RAG chunk before sending to the model. Default ON. */
export function readLakeraRagRetrievalScanPreference(): boolean {
  return parseLsBool(LS_LAKERA_RAG_SCAN, true)
}

/** Files page “Lakera Scan” — when false, skip per-chunk Lakera in chat (file text can still be used). Default ON. */
export function readLakeraFileScanEnabled(): boolean {
  return parseLsBool(LS_LAKERA_FILE_SCAN, true)
}

/**
 * Effective per-chunk retrieval scan: both “Lakera after upload” and base Lakera scan must be ON in UI.
 */
export function readEffectiveLakeraRetrievalScan(): boolean {
  return readLakeraRagRetrievalScanPreference() && readLakeraFileScanEnabled()
}
