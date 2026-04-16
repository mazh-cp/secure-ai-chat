import { NextRequest, NextResponse } from 'next/server'
import {
  getTeApiKeySync,
  buildTeFetchHeaders,
  captureTeStickyFromResponse,
  getTeApiBaseUrl,
  buildTeQueryRequest,
  normalizeTeApiKeyInput,
  getTeCloud403Troubleshooting,
  normalizeTeCloudBaseUrl,
  isAllowedTeFileBaseUrl,
  getTeUploadCandidateBases,
} from '@/lib/checkpoint-te'
import { CheckPointTELogFields, CheckPointTEResponse } from '@/types/checkpoint-te'
import { systemLog } from '@/lib/system-logging'

/** TPAPI may nest TE under `data.features.te` or `data.te`. */
function extractTpapiTeFeature(raw: Record<string, unknown>): Record<string, unknown> {
  const data = raw.data as Record<string, unknown> | undefined
  if (data?.te && typeof data.te === 'object' && !Array.isArray(data.te)) {
    return data.te as Record<string, unknown>
  }
  const features = data?.features as Record<string, unknown> | undefined
  if (features?.te && typeof features.te === 'object' && !Array.isArray(features.te)) {
    return features.te as Record<string, unknown>
  }
  return {}
}

/** TPAPI te.severity: integer 1 (low) … 4 (critical). */
function mapTpapiSeverity(n: unknown): CheckPointTELogFields['severity'] | undefined {
  const v = typeof n === 'number' ? n : typeof n === 'string' ? parseInt(n, 10) : NaN
  if (Number.isNaN(v)) return undefined
  if (v >= 4) return 'Critical'
  if (v === 3) return 'High'
  if (v === 2) return 'Medium'
  if (v === 1) return 'Low'
  return undefined
}

/** TPAPI te.confidence: integer 1–3 (doc: block medium+). */
function mapTpapiConfidenceLevel(
  n: unknown
): CheckPointTELogFields['confidence_level'] | undefined {
  const v = typeof n === 'number' ? n : typeof n === 'string' ? parseInt(n, 10) : NaN
  if (Number.isNaN(v)) return undefined
  if (v >= 3) return 'High'
  if (v === 2) return 'Medium'
  if (v === 1) return 'Low'
  return undefined
}

interface QueryRequestBody {
  sha256?: string
  sha1?: string
  md5?: string
  features: string[]
  /** Same host used for a successful upload (allowlisted); required when upload used a 403-fallback TE gateway. */
  teApiBase?: string
  /** TPAPI uses `te.images[]`; legacy client may send `te.image`. */
  te?: {
    image?: { id?: string; revision?: number }
    images?: Array<{ id?: string; revision?: number }>
  }
}

/**
 * POST - Query Check Point Threat Emulation for file analysis results
 * Body: {
 *   sha256?: string (or sha1/md5),
 *   features: ['te'],
 *   te: { image: { id: string, revision: number } }
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const defaultQueryEndpoint = `${getTeApiBaseUrl()}/query`

  try {
    let apiKey = getTeApiKeySync()

    if (!apiKey) {
      await systemLog.error(
        'checkpoint_te',
        'API key not configured for query',
        {
          endpoint: defaultQueryEndpoint,
          method: 'POST',
          statusCode: 400,
        },
        { requestId }
      )

      return NextResponse.json(
        { error: 'Check Point TE API key is not configured. Please configure it in Settings.' },
        { status: 400 }
      )
    }

    apiKey = normalizeTeApiKeyInput(apiKey)

    if (!apiKey || apiKey.length === 0) {
      await systemLog.error(
        'checkpoint_te',
        'API key is empty for query',
        {
          endpoint: defaultQueryEndpoint,
          method: 'POST',
          statusCode: 400,
        },
        { requestId }
      )

      return NextResponse.json(
        { error: 'Check Point TE API key is empty. Please configure a valid API key in Settings.' },
        { status: 400 }
      )
    }

    const body: QueryRequestBody = await request.json()

    if (!body.features || !body.features.includes('te')) {
      return NextResponse.json({ error: 'features must include "te"' }, { status: 400 })
    }

    const teImageId = body.te?.image?.id ?? body.te?.images?.[0]?.id
    // Need at least one hash or te image info (TPAPI te.images)
    if (!body.sha256 && !body.sha1 && !body.md5 && !teImageId) {
      return NextResponse.json(
        { error: 'Either a hash (sha256/sha1/md5) or te image id is required' },
        { status: 400 }
      )
    }

    const clientPinnedBase = isAllowedTeFileBaseUrl(body.teApiBase)
      ? normalizeTeCloudBaseUrl(body.teApiBase!)
      : null
    const queryBases: string[] = clientPinnedBase ? [clientPinnedBase] : getTeUploadCandidateBases()

    // Build request payload (TPAPI: te.images[], optional te.reports)
    const requestPayload = buildTeQueryRequest({
      sha256: body.sha256,
      sha1: body.sha1,
      md5: body.md5,
      features: body.features,
      imageId: body.te?.image?.id ?? body.te?.images?.[0]?.id,
      revision: body.te?.image?.revision ?? body.te?.images?.[0]?.revision,
    })

    let response: Response | undefined
    let queryUrl = `${queryBases[0] ?? getTeApiBaseUrl()}/query`
    let teResolvedBaseForResponse: string | undefined

    for (let bi = 0; bi < queryBases.length; bi++) {
      const base = queryBases[bi]
      queryUrl = `${base}/query`

      console.log('Querying Check Point TE for file analysis:', {
        sha256: body.sha256,
        teImageId: requestPayload.request.te?.images?.[0]?.id,
        teRevision: requestPayload.request.te?.images?.[0]?.revision,
        url: queryUrl,
        requestId,
        hostIndex: bi,
      })

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      try {
        response = await fetch(queryUrl, {
          method: 'POST',
          headers: buildTeFetchHeaders(apiKey, base, { 'Content-Type': 'application/json' }),
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
      } catch (fetchError) {
        clearTimeout(timeoutId)

        if (
          fetchError instanceof Error &&
          (fetchError.name === 'AbortError' || fetchError.message.includes('aborted'))
        ) {
          await systemLog.error(
            'checkpoint_te',
            'Query request timeout (30s)',
            {
              endpoint: queryUrl,
              method: 'POST',
              statusCode: 504,
              error: 'Request timeout after 30 seconds',
              duration: Date.now() - startTime,
            },
            { requestId, sha256: body.sha256 }
          )

          return NextResponse.json(
            {
              error:
                'Request timeout: Check Point TE API did not respond within 30 seconds. The service may be unavailable.',
              type: 'timeout_error',
            },
            { status: 504 }
          )
        }

        throw fetchError
      }

      if (!response) {
        break
      }

      if (response.ok) {
        captureTeStickyFromResponse(base, response)
        teResolvedBaseForResponse = base
        if (bi > 0 && !clientPinnedBase) {
          console.warn(
            `[checkpoint-te] Query succeeded using alternate TE host (set CHECKPOINT_TECLOUD_BASE_URL=${base} to skip retries): ${base}`
          )
        }
        break
      }

      const canRetry403 =
        response.status === 403 &&
        bi < queryBases.length - 1 &&
        !clientPinnedBase &&
        !process.env.CHECKPOINT_TECLOUD_BASE_URL?.trim()

      if (canRetry403) {
        try {
          await response.text()
        } catch {
          /* drain body */
        }
        console.warn(
          `[checkpoint-te] 403 from ${queryUrl}; retrying next TE Cloud host for query...`
        )
        continue
      }

      break
    }

    if (!response) {
      return NextResponse.json(
        { error: 'Check Point TE query failed: no response from gateway', type: 'te_query_error' },
        { status: 502 }
      )
    }

    const queryDuration = Date.now() - startTime

    if (!response.ok) {
      let errorMessage = `Check Point TE query failed: ${response.status} ${response.statusText}`
      let errorDetails: unknown = null

      try {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          errorDetails = await response.json()
          const msg =
            (errorDetails as { message?: string; error?: string })?.message ||
            (errorDetails as { message?: string; error?: string })?.error
          if (msg) errorMessage = msg as string
        } else {
          const text = await response.text()
          errorDetails = text
          errorMessage += ` - ${text.substring(0, 200)}`
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError)
      }

      // Log error to system logs
      await systemLog.error(
        'checkpoint_te',
        `Query failed: ${errorMessage}`,
        {
          endpoint: queryUrl,
          method: 'POST',
          statusCode: response.status,
          error: errorMessage,
          responseBody:
            typeof errorDetails === 'string'
              ? errorDetails.substring(0, 1000)
              : JSON.stringify(errorDetails).substring(0, 1000),
          duration: queryDuration,
        },
        {
          requestId,
          sha256: body.sha256,
          teImageId: teImageId,
        }
      )

      if (response.status === 401) {
        return NextResponse.json(
          {
            error:
              'Invalid Check Point TE API key. Please verify your API key in Settings. The API key may be incorrect or expired.',
            details: errorDetails,
            troubleshooting:
              'Verify the key in Settings (raw key only). If 401 persists, set CHECKPOINT_TE_AUTH_FORMAT=raw (TPAPI) or te_api_key (TE_API_KEY_ prefix).',
          },
          { status: 401 }
        )
      }

      if (response.status === 403) {
        const base = getTeApiBaseUrl()
        return NextResponse.json(
          {
            error: 'Check Point TE access denied (403).',
            details: errorDetails,
            teBaseUrl: base,
            teQueryUrl: queryUrl,
            diagnosticPath: '/api/te/diagnostic',
            troubleshooting: getTeCloud403Troubleshooting(),
          },
          { status: 403 }
        )
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: errorDetails,
        },
        { status: response.status }
      )
    }

    const rawData = await response.json()

    const rawRecord = rawData as Record<string, unknown>
    const data = rawRecord as {
      data?: {
        status?: string
        te?: Record<string, unknown>
        [key: string]: unknown
      }
    }

    const nestedTe = extractTpapiTeFeature(rawRecord)
    const flatTe = (
      data.data?.te && typeof data.data.te === 'object' && !Array.isArray(data.data.te)
        ? data.data.te
        : {}
    ) as Record<string, unknown>
    const teData: Record<string, unknown> = { ...flatTe, ...nestedTe }

    const teStatusRaw = teData['status']
    let teStatusFromNested: string | undefined
    if (
      teStatusRaw &&
      typeof teStatusRaw === 'object' &&
      teStatusRaw !== null &&
      !Array.isArray(teStatusRaw)
    ) {
      const o = teStatusRaw as Record<string, unknown>
      teStatusFromNested =
        (typeof o.label === 'string' ? o.label : undefined) ||
        (typeof o.message === 'string' ? o.message : undefined)
    } else if (typeof teStatusRaw === 'string') {
      teStatusFromNested = teStatusRaw
    }

    const combinedRaw = teData['combined_verdict']
    const combined = typeof combinedRaw === 'string' ? combinedRaw.toLowerCase().trim() : ''

    const severityMapped = mapTpapiSeverity(teData['severity'])
    const confidenceMapped = mapTpapiConfidenceLevel(teData['confidence'])

    console.log('Check Point TE query response:', {
      status: data.data?.status,
      combined_verdict: combinedRaw,
      verdict: teData['verdict'],
      hasTeData: Object.keys(teData).length > 0,
    })

    const logFields: CheckPointTELogFields = {
      combined_verdict: typeof combinedRaw === 'string' ? combinedRaw : undefined,
      verdict:
        (teData['verdict'] as CheckPointTELogFields['verdict']) ||
        (combined === 'benign' ? 'Benign' : undefined) ||
        (combined === 'malicious' ? 'Malicious' : undefined) ||
        (data.data?.status === 'FOUND' ? 'Malicious' : undefined),
      status: (data.data?.status || teStatusFromNested) as CheckPointTELogFields['status'],

      analyzed_on:
        (teData['analyzed_on'] as string) ||
        (teData['analyzedOn'] as string) ||
        'Check Point Threat Emulation Cloud',
      te_verdict_determined_by:
        (teData['te_verdict_determined_by'] as string) ||
        (teData['teVerdictDeterminedBy'] as string) ||
        (teData['determined_by'] as string) ||
        (teData['determinedBy'] as string),
      confidence_level:
        confidenceMapped ||
        (teData['confidence_level'] as CheckPointTELogFields['confidence_level']) ||
        (teData['confidenceLevel'] as CheckPointTELogFields['confidence_level']),
      severity:
        severityMapped ||
        (teData['severity'] as CheckPointTELogFields['severity']) ||
        (teData['severity_level'] as CheckPointTELogFields['severity']),

      // Protection information
      protection_type:
        (teData['protection_type'] as string) || (teData['protectionType'] as string),
      protection_name:
        (teData['protection_name'] as string) || (teData['protectionName'] as string),
      attack:
        (teData['attack'] as string) ||
        (teData['attack_name'] as string) ||
        (teData['attackName'] as string),
      attack_info: (teData['attack_info'] as string) || (teData['attackInfo'] as string),
      attack_status: (teData['attack_status'] as string) || (teData['attackStatus'] as string),

      // Action taken
      action: teData['action'] as CheckPointTELogFields['action'],
      action_details: (teData['action_details'] as string) || (teData['actionDetails'] as string),

      // File risk information
      file_risk:
        typeof teData['file_risk'] === 'number'
          ? teData['file_risk']
          : typeof teData['fileRisk'] === 'number'
            ? teData['fileRisk']
            : typeof teData['risk'] === 'number'
              ? teData['risk']
              : undefined,
      content_risk:
        typeof teData['content_risk'] === 'number'
          ? teData['content_risk']
          : typeof teData['contentRisk'] === 'number'
            ? teData['contentRisk']
            : undefined,
      scrubbed_content:
        (teData['scrubbed_content'] as string) || (teData['scrubbedContent'] as string),
      suspicious_content:
        (teData['suspicious_content'] as string) || (teData['suspiciousContent'] as string),

      // Threat profile
      threat_profile: (teData['threat_profile'] as string) || (teData['threatProfile'] as string),
      smartdefense_profile:
        (teData['smartdefense_profile'] as string) || (teData['smartdefenseProfile'] as string),
      triggered_by: (teData['triggered_by'] as string) || (teData['triggeredBy'] as string),

      // Vendor information
      vendor_list:
        (teData['vendor_list'] as string) ||
        (teData['vendorList'] as string) ||
        'Check Point ThreatCloud',

      // Confidence score (numeric)
      confidence:
        typeof teData['confidence'] === 'number'
          ? teData['confidence']
          : typeof teData['confidence_score'] === 'number'
            ? teData['confidence_score']
            : typeof teData['confidenceScore'] === 'number'
              ? teData['confidenceScore']
              : undefined,

      // Additional metadata
      description: teData['description'] as string,
      reason: teData['reason'] as string,

      // Hash information
      sha256: (teData['sha256'] as string) || (data.data?.['sha256'] as string),
      sha1: (teData['sha1'] as string) || (data.data?.['sha1'] as string),
      md5: (teData['md5'] as string) || (data.data?.['md5'] as string),
    }

    const verdict =
      (logFields.verdict?.toLowerCase() as string | undefined) ||
      (combined === 'benign' ? 'benign' : combined === 'malicious' ? 'malicious' : '') ||
      (data.data?.status === 'FOUND'
        ? 'malicious'
        : data.data?.status === 'NOT_FOUND'
          ? 'benign'
          : '') ||
      ''
    const status = (logFields.status?.toUpperCase() ||
      data.data?.status?.toUpperCase() ||
      teStatusFromNested?.toUpperCase().replace(/\s+/g, '_') ||
      'UNKNOWN') as string

    const isSafe = verdict === 'benign' || status === 'NOT_FOUND' || combined === 'benign'
    const isMalicious =
      verdict === 'malicious' ||
      verdict === 'suspicious' ||
      status === 'FOUND' ||
      combined === 'malicious'
    const isPending =
      status === 'IN_PROGRESS' ||
      status === 'QUEUED' ||
      (!verdict && !isMalicious && !isSafe && status !== 'NOT_FOUND')

    const result: CheckPointTEResponse = {
      success: true,
      verdict: isPending ? 'pending' : isMalicious ? 'malicious' : isSafe ? 'safe' : 'unknown',
      status: status,
      logFields: logFields,
      rawResponse: rawData, // Include raw response for debugging and future enhancements
      ...(teResolvedBaseForResponse ? { teResolvedBase: teResolvedBaseForResponse } : {}),
    }

    console.log('Parsed Check Point TE log fields:', {
      verdict: result.verdict,
      status: result.status,
      severity: logFields.severity,
      confidence: logFields.confidence,
      protectionName: logFields.protection_name,
      attack: logFields.attack,
    })

    const successDuration = Date.now() - startTime

    // Log successful query
    await systemLog.info(
      'checkpoint_te',
      'Query successful',
      {
        endpoint: queryUrl,
        method: 'POST',
        statusCode: 200,
        duration: successDuration,
      },
      {
        requestId,
        sha256: body.sha256,
        verdict: result.verdict,
      }
    )

    return NextResponse.json(result)
  } catch (error) {
    const errorDuration = Date.now() - startTime
    console.error('Check Point TE query error:', error)

    let errorMessage = 'An error occurred during query to Check Point TE'
    let statusCode = 500
    let stackTrace: string | undefined

    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        errorMessage =
          'Network error: Could not connect to Check Point TE API. Check your internet connection and firewall settings.'
        statusCode = 503
      }
      stackTrace = error.stack
    } else if (error instanceof Error) {
      errorMessage = error.message
      stackTrace = error.stack
    }

    // Log error to system logs
    await systemLog.error(
      'checkpoint_te',
      `Query exception: ${errorMessage}`,
      {
        endpoint: defaultQueryEndpoint,
        method: 'POST',
        statusCode,
        error: errorMessage,
        stackTrace,
        duration: errorDuration,
      },
      {
        requestId,
        errorType: error instanceof TypeError ? 'TypeError' : error?.constructor?.name || 'Unknown',
      }
    )

    return NextResponse.json(
      {
        error: errorMessage,
        type: error instanceof TypeError ? 'network_error' : 'unknown_error',
      },
      { status: statusCode }
    )
  }
}
