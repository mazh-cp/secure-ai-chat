import { NextRequest, NextResponse } from 'next/server'

import { getApiKeys } from '@/lib/api-keys-storage'
import { extractAggregatedFromLakeraResponse, postLakeraGuard } from '@/lib/lakera/guard-client'
import { lakeraProjectIdForGuard, resolveLakeraGuardEndpoint } from '@/lib/lakera-guard-endpoint'

const PROBE_MESSAGE = 'Secure AI Chat Lakera connectivity probe. No user content. OK to allow.'

function pickProbeString(draft: unknown, stored: string | undefined | null): string | null {
  const d = typeof draft === 'string' ? draft.trim() : ''
  if (d && d !== 'configured') return d
  const s = typeof stored === 'string' ? stored.trim() : ''
  return s || null
}

/**
 * POST — Run a minimal Guard request with the given (or stored) key, endpoint, and project_id.
 * Confirms reachability and that Lakera accepts the project; policies are evaluated server-side
 * on every Guard call — there is no separate "download policy" step to sync.
 *
 * Body (all optional): { lakeraAiKey?, lakeraEndpoint?, lakeraProjectId? }
 * Draft values from the Settings form are used when non-empty so operators can test before Save.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const stored = await getApiKeys(true)

    const lakeraKey = pickProbeString(body.lakeraAiKey, stored.lakeraAiKey)
    if (!lakeraKey) {
      return NextResponse.json(
        { ok: false, error: 'Lakera API key is required (save in Settings or set LAKERA_AI_KEY).' },
        { status: 400 }
      )
    }

    const endpointDraft = pickProbeString(body.lakeraEndpoint, stored.lakeraEndpoint)
    const guardUrl = resolveLakeraGuardEndpoint(endpointDraft ?? undefined)
    if (!guardUrl.startsWith('http://') && !guardUrl.startsWith('https://')) {
      return NextResponse.json(
        { ok: false, error: 'Invalid Lakera endpoint URL.' },
        { status: 400 }
      )
    }

    const projectRaw = pickProbeString(body.lakeraProjectId, stored.lakeraProjectId)
    const projectId = lakeraProjectIdForGuard(projectRaw)

    const posted = await postLakeraGuard({
      guardUrl,
      lakeraKey,
      messages: [{ role: 'user', content: PROBE_MESSAGE }],
      projectId,
      metadata: {
        internal_request_id: `verify-${Date.now()}`,
        session_id: 'settings-verify',
      },
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
          error: msg || `Lakera Guard returned HTTP ${posted.status}`,
          httpStatus: posted.status,
          guardUrl,
          projectIdConfigured: Boolean(projectId),
        },
        { status: posted.status >= 500 ? 503 : 400 }
      )
    }

    const extracted = extractAggregatedFromLakeraResponse(posted.data)
    const breakdown = extracted.breakdown ?? []
    const detectedTypes = breakdown
      .filter(b => b.detected)
      .map(b => b.detector_type)
      .filter(Boolean)

    const draftKey = typeof body.lakeraAiKey === 'string' ? body.lakeraAiKey.trim() : ''
    const probeUsedFormKey = !!(draftKey && draftKey !== 'configured')
    const envLakeraKey = !!process.env.LAKERA_AI_KEY?.trim()
    let mergeHint = ''
    if (envLakeraKey && probeUsedFormKey) {
      mergeHint =
        ' Chat requests use LAKERA_AI_KEY from the server environment first (overrides saved keys). If chat returns 401 but this probe succeeded, update or remove LAKERA_AI_KEY in .env.local and restart the service.'
    } else if (envLakeraKey) {
      mergeHint =
        ' Chat uses LAKERA_AI_KEY from the server environment when set (overrides Settings / secure storage).'
    }

    return NextResponse.json({
      ok: true,
      requestUuid: extracted.requestUuid ?? null,
      flagged: extracted.flagged,
      projectIdConfigured: Boolean(projectId),
      guardUrl,
      probeUsedFormKey,
      chatPrefersEnvLakeraKey: envLakeraKey,
      note:
        'Lakera applies your project policy on each Guard request; use this probe after changing policy in platform.lakera.ai to confirm connectivity and project_id.' +
        mergeHint,
      breakdownDetectorTypesSample: detectedTypes.slice(0, 12),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    const aborted = e instanceof Error && (e.name === 'AbortError' || message.includes('aborted'))
    return NextResponse.json(
      {
        ok: false,
        error: aborted
          ? 'Lakera request timed out or was aborted. Check network, endpoint, and LAKERA_TIMEOUT_MS.'
          : message,
      },
      { status: 503 }
    )
  }
}
