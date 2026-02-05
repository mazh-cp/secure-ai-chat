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
      const err = data as { error?: string; message?: string; details?: unknown }
      return {
        ok: false,
        status: response.status,
        data,
        error: {
          code: `HTTP_${response.status}`,
          message: typeof err?.error === 'string' ? err.error : typeof err?.message === 'string' ? err.message : `Request failed with status ${response.status}`,
          details: err?.details,
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
