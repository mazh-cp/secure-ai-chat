import { NextRequest, NextResponse } from 'next/server'

import { requireSecureChatSession } from '@/lib/app-login'
import { getApiKeys } from '@/lib/api-keys-storage'
import { config } from '@/lib/config'
import {
  normalizeGuardResultsToOverlay,
  postLakeraGuardResults,
} from '@/lib/lakera/guard-results-client'
import { lakeraProjectIdForGuard, resolveLakeraGuardResultsEndpoint } from '@/lib/lakera-guard-endpoint'

const MAX_MESSAGES = 32
const MAX_CONTENT_PER_MESSAGE = 120_000

const ALLOWED_ROLES = new Set(['system', 'user', 'assistant', 'tool', 'developer'])

function pickString(draft: unknown, stored: string | undefined | null): string | null {
  const d = typeof draft === 'string' ? draft.trim() : ''
  if (d && d !== 'configured') return d
  const s = typeof stored === 'string' ? stored.trim() : ''
  return s || null
}

function parseMessages(body: Record<string, unknown>): Array<{ role: string; content: string }> | null {
  const raw = body.messages
  if (!Array.isArray(raw) || raw.length === 0) return null
  if (raw.length > MAX_MESSAGES) return null
  const out: Array<{ role: string; content: string }> = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null
    const m = item as Record<string, unknown>
    const role = typeof m.role === 'string' ? m.role.trim().toLowerCase() : ''
    const content = typeof m.content === 'string' ? m.content : ''
    if (!ALLOWED_ROLES.has(role) || content.length === 0) return null
    if (content.length > MAX_CONTENT_PER_MESSAGE) return null
    out.push({ role, content })
  }
  return out
}

/**
 * POST — Call Lakera `POST /v2/guard/results` for detector-level confidence (not logged as Guard screening).
 * For calibration, dashboards, and tooling — **not** a substitute for `/v2/guard` blocking decisions.
 *
 * Body: { messages: [{ role, content }, ...], lakeraAiKey?, lakeraEndpoint?, lakeraProjectId?, metadata? }
 * When `SECURE_CHAT_LOGIN_PASSWORD` is set, requires a valid session cookie (same as `GET /api/lakera/last`).
 */
export async function POST(request: NextRequest) {
  const auth = requireSecureChatSession(request)
  if (auth) return auth

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const messages = parseMessages(body)
    if (!messages) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid body: messages must be a non-empty array (max ${MAX_MESSAGES}) of { role, content } with allowed roles and content length 1–${MAX_CONTENT_PER_MESSAGE}.`,
        },
        { status: 400 }
      )
    }

    const stored = await getApiKeys(true)
    const lakeraKey = pickString(body.lakeraAiKey, stored.lakeraAiKey)
    if (!lakeraKey) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Lakera API key is required (Settings or LAKERA_AI_KEY / LAKERA_API_KEY).',
        },
        { status: 400 }
      )
    }

    const endpointDraft = pickString(body.lakeraEndpoint, stored.lakeraEndpoint)
    const resultsUrl = resolveLakeraGuardResultsEndpoint(endpointDraft ?? undefined)
    if (!resultsUrl.startsWith('http://') && !resultsUrl.startsWith('https://')) {
      return NextResponse.json({ ok: false, error: 'Invalid Lakera results URL.' }, { status: 400 })
    }

    const projectRaw = pickString(body.lakeraProjectId, stored.lakeraProjectId)
    const projectId = lakeraProjectIdForGuard(projectRaw)

    if (config.lakeraRequireProjectId && !projectId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'LAKERA_REQUIRE_PROJECT_ID or LAKERA_ENFORCE_STRICT is enabled: set Lakera Project ID before calling this endpoint.',
          projectIdConfigured: false,
          resultsUrl,
        },
        { status: 400 }
      )
    }

    const meta = body.metadata
    const metadata =
      meta && typeof meta === 'object' && !Array.isArray(meta)
        ? {
            user_id: typeof (meta as Record<string, unknown>).user_id === 'string' ? String((meta as Record<string, unknown>).user_id) : undefined,
            session_id:
              typeof (meta as Record<string, unknown>).session_id === 'string'
                ? String((meta as Record<string, unknown>).session_id)
                : undefined,
            ip_address:
              typeof (meta as Record<string, unknown>).ip_address === 'string'
                ? String((meta as Record<string, unknown>).ip_address)
                : undefined,
            internal_request_id:
              typeof (meta as Record<string, unknown>).internal_request_id === 'string'
                ? String((meta as Record<string, unknown>).internal_request_id)
                : `results-${Date.now()}`,
          }
        : { internal_request_id: `results-${Date.now()}` }

    const posted = await postLakeraGuardResults({
      resultsUrl,
      lakeraKey,
      messages,
      projectId,
      metadata,
    })

    if (!posted.ok) {
      const msg =
        typeof posted.errorDetails === 'object' &&
        posted.errorDetails !== null &&
        !Array.isArray(posted.errorDetails)
          ? String(
              (posted.errorDetails as Record<string, unknown>).message ||
                (posted.errorDetails as Record<string, unknown>).error ||
                ''
            )
          : typeof posted.errorDetails === 'string'
            ? posted.errorDetails
            : ''
      return NextResponse.json(
        {
          ok: false,
          error: msg || `Lakera Guard Results returned HTTP ${posted.status}`,
          httpStatus: posted.status,
          resultsUrl,
          projectIdConfigured: Boolean(projectId),
        },
        { status: posted.status >= 500 ? 503 : 400 }
      )
    }

    const overlay = normalizeGuardResultsToOverlay(posted.data)

    return NextResponse.json({
      ok: true,
      resultsUrl,
      projectIdConfigured: Boolean(projectId),
      overlay: {
        flagged: overlay.flagged,
        rowCount: overlay.rowCount,
        breakdown: overlay.breakdown,
      },
      note:
        'Lakera `/v2/guard/results` is for analysis and UI overlays; it does not log as a Guard screening request. Use `POST /v2/guard` (chat pipeline) for authoritative policy blocks.',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    const aborted = e instanceof Error && (e.name === 'AbortError' || message.includes('aborted'))
    return NextResponse.json(
      {
        ok: false,
        error: aborted
          ? 'Lakera request timed out or was aborted. Check LAKERA_TIMEOUT_MS and network.'
          : message,
      },
      { status: 503 }
    )
  }
}
