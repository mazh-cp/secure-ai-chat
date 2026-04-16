/**
 * Decode JSON `fileContent` from POST /api/files/store into bytes for disk.
 * Text files are UTF-8; binary uploads from the client are base64 (FileUploader uses ArrayBuffer → btoa).
 */

function extensionOf(fileName: string): string {
  const p = fileName.split('.').pop()?.toLowerCase() ?? ''
  return p ? `.${p}` : ''
}

/** True when we should treat body as plain text (never base64-decode). */
function isExplicitTextFile(fileType: string, ext: string): boolean {
  if (fileType.startsWith('text/') || fileType === 'application/json') return true
  return ['.txt', '.md', '.csv', '.json'].includes(ext)
}

/**
 * Heuristic: client sends long single-line base64 for binary files (no newlines in payload).
 */
function looksLikeBase64Payload(s: string): boolean {
  const t = s.trim()
  if (t.length < 80) return false
  if (/[\r\n]/.test(t.slice(0, 500))) return false
  const noWs = t.replace(/\s/g, '')
  if (noWs.length < 80) return false
  if (!/^[A-Za-z0-9+/]+=*$/.test(noWs)) return false
  return true
}

export function decodeUploadBodyToBuffer(
  fileContent: unknown,
  fileName: string,
  fileType: string
): Buffer {
  const raw = typeof fileContent === 'string' ? fileContent : String(fileContent ?? '')
  const ext = extensionOf(fileName)

  let payload = raw
  if (payload.includes(',') && /^\s*data:/i.test(payload)) {
    payload = payload.split(',')[1] ?? payload
  }

  const textFile = isExplicitTextFile(fileType, ext)

  if (!textFile && looksLikeBase64Payload(payload)) {
    try {
      const noWs = payload.replace(/\s/g, '')
      return Buffer.from(noWs, 'base64')
    } catch {
      return Buffer.from(raw, 'utf-8')
    }
  }

  return Buffer.from(raw, 'utf-8')
}
