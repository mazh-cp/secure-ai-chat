import { NextRequest, NextResponse } from 'next/server'
import { getUserIP } from '@/lib/logging'
import { sendLakeraTelemetryFromLog } from '@/lib/lakera-telemetry'
import {
  lakeraGuardHttpUserHint,
  lakeraProjectIdForGuard,
  resolveLakeraGuardEndpoint,
} from '@/lib/lakera-guard-endpoint'
import { prepareContentForFileScan, screenTextAsFileUpload } from '@/lib/lakera/guard-client'
import {
  effectiveLakeraAiKey,
  effectiveLakeraEndpoint,
  effectiveLakeraProjectId,
} from '@/lib/effective-lakera-client-merge'

function lakeraHttpErrorNextResponse(
  status: number,
  errorDetails: Record<string, unknown> | string | null | undefined
): NextResponse {
  let errorMessage = `Lakera API error: ${status}`
  if (errorDetails && typeof errorDetails === 'object' && !Array.isArray(errorDetails)) {
    const jsonError = errorDetails as Record<string, unknown>
    const msg = jsonError.message || jsonError.error || jsonError.detail
    errorMessage = (typeof msg === 'string' ? msg : errorMessage) || errorMessage
    if (jsonError.errors) {
      errorMessage += ` - ${JSON.stringify(jsonError.errors)}`
    }
  } else if (typeof errorDetails === 'string' && errorDetails) {
    errorMessage += ` - ${errorDetails.substring(0, 200)}`
  }

  if (status === 401) {
    const hint = lakeraGuardHttpUserHint(401)
    return NextResponse.json(
      {
        error: hint
          ? `Invalid Lakera API key (401). ${hint}`
          : 'Invalid Lakera API key. Please verify your API key in Settings.',
        details: errorDetails,
      },
      { status: 401 }
    )
  }
  if (status === 403) {
    return NextResponse.json(
      {
        error:
          'Lakera API access denied. Check your API key, project ID, and permissions in Settings.',
        details: errorDetails,
      },
      { status: 403 }
    )
  }
  if (status === 400) {
    return NextResponse.json(
      {
        error: `Bad request: ${errorMessage}. Please check your API configuration and file content.`,
        details: errorDetails,
      },
      { status: 400 }
    )
  }
  if (status === 404) {
    const hint = lakeraGuardHttpUserHint(404)
    return NextResponse.json(
      {
        error: hint
          ? `Lakera endpoint not found (404). ${hint}`
          : 'Lakera endpoint not found. Please check your endpoint URL in Settings.',
        details: errorDetails,
      },
      { status: 404 }
    )
  }
  if (status === 429) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment and try again.', details: errorDetails },
      { status: 429 }
    )
  }
  if (status >= 500) {
    return NextResponse.json(
      { error: 'Lakera API server error. Please try again later.', details: errorDetails },
      { status: 500 }
    )
  }
  return NextResponse.json({ error: errorMessage, details: errorDetails }, { status })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileContent, fileName, apiKeys: clientApiKeys } = body

    if (!fileContent) {
      return NextResponse.json({ error: 'File content is required' }, { status: 400 })
    }

    const { getApiKeys } = await import('@/lib/api-keys-storage')
    const serverKeys = await getApiKeys()

    const apiKeys = {
      lakeraAiKey: effectiveLakeraAiKey(serverKeys.lakeraAiKey, clientApiKeys?.lakeraAiKey),
      lakeraProjectId: effectiveLakeraProjectId(
        serverKeys.lakeraProjectId,
        clientApiKeys?.lakeraProjectId
      ),
      lakeraEndpoint: effectiveLakeraEndpoint(
        serverKeys.lakeraEndpoint,
        clientApiKeys?.lakeraEndpoint
      ),
    }

    if (!apiKeys.lakeraAiKey) {
      return NextResponse.json(
        { error: 'Lakera API key is not configured. Please add it in Settings.' },
        { status: 400 }
      )
    }

    const { contentToScan, isBase64Placeholder } = prepareContentForFileScan(fileContent, fileName)

    const guardUrl = resolveLakeraGuardEndpoint(apiKeys.lakeraEndpoint)
    if (!guardUrl.startsWith('http://') && !guardUrl.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Invalid Lakera endpoint. Must start with http:// or https://' },
        { status: 400 }
      )
    }

    const scanProjectId = lakeraProjectIdForGuard(apiKeys.lakeraProjectId)
    if (process.env.NODE_ENV !== 'production' && !scanProjectId) {
      console.warn(
        '[Lakera Guard scan] No project_id — Lakera uses default policy. Set Project ID in Settings or LAKERA_PROJECT_ID.'
      )
    }

    const userIP = getUserIP(request)
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    if (process.env.NODE_ENV !== 'production') {
      console.log('Scanning with Lakera (canonical guard client):', {
        endpoint: guardUrl,
        contentLength: contentToScan.length,
        projectId: apiKeys.lakeraProjectId ? 'configured' : 'not configured',
        fileType: isBase64Placeholder ? 'binary' : 'text',
        requestId,
      })
    }

    const fr = await screenTextAsFileUpload({
      contentToScan,
      lakeraKey: apiKeys.lakeraAiKey,
      lakeraEndpoint: apiKeys.lakeraEndpoint,
      lakeraProjectId: apiKeys.lakeraProjectId,
      metadata: {
        ip_address: userIP,
        internal_request_id: requestId,
        session_id: requestId,
      },
      extraHighRiskCategories: ['code_injection'],
    })

    if (fr.lakeraSkipped && fr.lakeraHttpStatus) {
      return lakeraHttpErrorNextResponse(fr.lakeraHttpStatus, fr.lakeraErrorDetails)
    }

    const flagged = fr.flagged
    const categories = fr.categories
    const scores = fr.scores
    const payload = fr.payload
    const breakdown = fr.breakdown
    const threatLevel = fr.threatLevel

    const logData = {
      userIP,
      type: 'file_scan',
      action: flagged ? 'blocked' : 'scanned',
      source: 'file_upload',
      projectId: apiKeys.lakeraProjectId,
      sessionId: requestId,
      internalRequestId: requestId,
      requestDetails: {
        fileName,
        fileType: fileName?.split('.').pop() || 'unknown',
        fileSize: typeof fileContent === 'string' ? fileContent.length : 0,
        threatLevel: flagged ? threatLevel : undefined,
        detectedPatterns: fr.prescanPatterns,
        lakeraRequestUuid: fr.requestUuid,
      },
      lakeraDecision: {
        scanned: fr.scanned,
        flagged,
        categories,
        scores,
        message: flagged
          ? `Security threats detected (${threatLevel})`
          : 'File content appears safe',
        requestUuid: fr.requestUuid,
        payload,
        breakdown,
      },
      success: true,
      timestamp: new Date().toISOString(),
    }

    if (apiKeys.lakeraAiKey) {
      sendLakeraTelemetryFromLog(logData, apiKeys.lakeraAiKey, apiKeys.lakeraProjectId).catch(
        error => {
          console.error('Failed Lakera audit/telemetry (non-blocking):', error)
        }
      )
    }

    return NextResponse.json({
      flagged,
      message: flagged
        ? `Security threats detected (${threatLevel}): ${
            categories
              ? Object.keys(categories)
                  .filter(k => categories![k])
                  .join(', ')
              : 'unknown'
          }`
        : 'File content appears safe',
      details: {
        categories,
        score:
          scores && Object.keys(scores).length > 0 ? Math.max(...Object.values(scores)) : undefined,
        threatLevel,
        payload,
        breakdown,
      },
      logData,
    })
  } catch (error) {
    console.error('Scan API error:', error)

    let errorMessage = 'An error occurred during scanning'
    let statusCode = 500

    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        errorMessage =
          'Network error: Could not connect to Lakera API. Check your internet connection, API endpoint, and firewall settings.'
        statusCode = 503
      } else if (error.message.includes('JSON')) {
        errorMessage = 'Failed to parse response. Check your API endpoint configuration.'
        statusCode = 500
      }
    } else if (error instanceof Error) {
      errorMessage = error.message
    }

    const userIP = getUserIP(request)

    return NextResponse.json(
      {
        error: errorMessage,
        type: error instanceof TypeError ? 'network_error' : 'unknown_error',
        logData: {
          userIP,
          type: 'error',
          action: 'error',
          source: 'file_upload',
          error: errorMessage,
          success: false,
        },
      },
      { status: statusCode }
    )
  }
}
