/**
 * Safe fetch that never throws on non-JSON or network errors.
 * Returns a structured result so callers can handle errors without try/catch.
 * Use for all API calls where a non-JSON response (e.g. HTML error page) would crash response.json().
 */

export interface SafeFetchResult<T = unknown> {
  ok: boolean
  status: number
  data?: T
  error?: { code: string; message: string; details?: unknown }
}

/** Supports `{ error: "string" }`, `{ error: { code, message, details } }`, and top-level `message`. */
function parseApiErrorBody(data: unknown, httpStatus: number): { code: string; message: string; details?: unknown } {
  const fallback = `Request failed with status ${httpStatus}`
  if (data == null || typeof data !== 'object') {
    return { code: `HTTP_${httpStatus}`, message: fallback }
  }
  const d = data as Record<string, unknown>
  const nested = d.error
  if (typeof nested === 'string') {
    return { code: `HTTP_${httpStatus}`, message: nested }
  }
  if (nested && typeof nested === 'object') {
    const o = nested as Record<string, unknown>
    const code = typeof o.code === 'string' ? o.code : `HTTP_${httpStatus}`
    const message = typeof o.message === 'string' ? o.message : fallback
    return { code, message, details: o.details }
  }
  if (typeof d.message === 'string') {
    return { code: `HTTP_${httpStatus}`, message: d.message }
  }
  return { code: `HTTP_${httpStatus}`, message: fallback }
}

export async function safeFetchJson<T = unknown>(
  url: string,
  opts?: RequestInit
): Promise<SafeFetchResult<T>> {
  let response: Response
  try {
    response = await fetch(url, opts)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network request failed'
    return {
      ok: false,
      status: 0,
      error: { code: 'NETWORK_ERROR', message, details: undefined },
    }
  }

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')

  if (!isJson) {
    let text = ''
    try {
      text = await response.text()
    } catch {
      text = '(failed to read body)'
    }
    return {
      ok: false,
      status: response.status,
      error: {
        code: 'NOT_JSON',
        message: `Server returned non-JSON (${response.status}). Check server logs.`,
        details: text.substring(0, 300),
      },
    }
  }

  try {
    const data = (await response.json()) as T
    if (!response.ok) {
      const parsed = parseApiErrorBody(data, response.status)
      return {
        ok: false,
        status: response.status,
        data,
        error: {
          code: parsed.code,
          message: parsed.message,
          details: parsed.details,
        },
      }
    }
    return { ok: true, status: response.status, data }
  } catch (parseErr) {
    const message = parseErr instanceof Error ? parseErr.message : 'Invalid JSON'
    return {
      ok: false,
      status: response.status,
      error: { code: 'PARSE_ERROR', message, details: undefined },
    }
  }
}
