import { NextRequest, NextResponse } from 'next/server'
import { getTeApiKeySync, createTeAuthHeader, getTeApiBaseUrl, buildTeQueryRequest } from '@/lib/checkpoint-te'
import { CheckPointTELogFields, CheckPointTEResponse } from '@/types/checkpoint-te'
import { systemLog } from '@/lib/system-logging'

interface QueryRequestBody {
  sha256?: string
  sha1?: string
  md5?: string
  features: string[]
  te?: {
    image?: {
      id?: string
      revision?: number
    }
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
  const queryUrl = `${getTeApiBaseUrl()}/query`
  
  try {
    let apiKey = getTeApiKeySync()
    
    if (!apiKey) {
      await systemLog.error('checkpoint_te', 'API key not configured for query', {
        endpoint: queryUrl,
        method: 'POST',
        statusCode: 400,
      }, { requestId })
      
      return NextResponse.json(
        { error: 'Check Point TE API key is not configured. Please configure it in Settings.' },
        { status: 400 }
      )
    }
    
    // Ensure API key is trimmed (remove any leading/trailing whitespace)
    apiKey = apiKey.trim()
    
    if (!apiKey || apiKey.length === 0) {
      await systemLog.error('checkpoint_te', 'API key is empty for query', {
        endpoint: queryUrl,
        method: 'POST',
        statusCode: 400,
      }, { requestId })
      
      return NextResponse.json(
        { error: 'Check Point TE API key is empty. Please configure a valid API key in Settings.' },
        { status: 400 }
      )
    }

    const body: QueryRequestBody = await request.json()

    if (!body.features || !body.features.includes('te')) {
      return NextResponse.json(
        { error: 'features must include "te"' },
        { status: 400 }
      )
    }

    // Need at least one hash or te image info
    if (!body.sha256 && !body.sha1 && !body.md5 && !body.te?.image?.id) {
      return NextResponse.json(
        { error: 'Either a hash (sha256/sha1/md5) or te image id is required' },
        { status: 400 }
      )
    }

    const authHeader = createTeAuthHeader(apiKey)

    // Build request payload with correct wrapper format
    const requestPayload = buildTeQueryRequest({
      sha256: body.sha256,
      sha1: body.sha1,
      md5: body.md5,
      features: body.features,
      imageId: body.te?.image?.id,
      revision: body.te?.image?.revision,
    })

    console.log('Querying Check Point TE for file analysis:', {
      sha256: body.sha256,
      teImageId: requestPayload.request.te?.image?.id,
      teRevision: requestPayload.request.te?.image?.revision,
      url: queryUrl,
      requestId,
    })

    // Set timeout for the fetch request (30 seconds)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    let response: Response
    try {
      response = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      
      // Handle timeout or abort
      if (fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('aborted'))) {
        await systemLog.error('checkpoint_te', 'Query request timeout (30s)', {
          endpoint: queryUrl,
          method: 'POST',
          statusCode: 504,
          error: 'Request timeout after 30 seconds',
          duration: Date.now() - startTime,
        }, { requestId, sha256: body.sha256 })
        
        return NextResponse.json(
          { 
            error: 'Request timeout: Check Point TE API did not respond within 30 seconds. The service may be unavailable.',
            type: 'timeout_error',
          },
          { status: 504 }
        )
      }
      
      // Re-throw other fetch errors to be handled by outer catch
      throw fetchError
    }

    const queryDuration = Date.now() - startTime
    
    if (!response.ok) {
      let errorMessage = `Check Point TE query failed: ${response.status} ${response.statusText}`
      let errorDetails: unknown = null

      try {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          errorDetails = await response.json()
          const msg = (errorDetails as { message?: string; error?: string })?.message || 
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
      await systemLog.error('checkpoint_te', `Query failed: ${errorMessage}`, {
        endpoint: queryUrl,
        method: 'POST',
        statusCode: response.status,
        error: errorMessage,
        responseBody: typeof errorDetails === 'string' ? errorDetails.substring(0, 1000) : JSON.stringify(errorDetails).substring(0, 1000),
        duration: queryDuration,
      }, {
        requestId,
        sha256: body.sha256,
        teImageId: body.te?.image?.id,
      })

      if (response.status === 401) {
        return NextResponse.json(
          { 
            error: 'Invalid Check Point TE API key. Please verify your API key in Settings. The API key may be incorrect or expired.',
            details: errorDetails,
            troubleshooting: 'Please verify that: 1) Your API key is correct, 2) The key has not expired, 3) The key format is correct (should not include the TE_API_KEY_ prefix when entering in Settings).',
          },
          { status: 401 }
        )
      }

      if (response.status === 403) {
        return NextResponse.json(
          { 
            error: 'Check Point TE API access denied. This could be due to: 1) API key does not have file query permissions, 2) Your server IP address is not allowed to access the API, 3) API key restrictions or policy limits.',
            details: errorDetails,
            troubleshooting: 'Please check: 1) API key permissions in Check Point management console, 2) IP address restrictions (may need to allow your server IP in SmartConsole > Management API > Advanced Settings), 3) API subscription/plan limits.',
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
    
    // Parse the response and extract all relevant log fields
    // Check Point TE API response structure may vary, so we handle multiple formats
    const data = rawData as {
      data?: {
        status?: string
        te?: Record<string, unknown>
        [key: string]: unknown
      }
      [key: string]: unknown
    }

    console.log('Check Point TE query response:', {
      status: data.data?.status,
      verdict: data.data?.te?.['verdict'],
      hasTeData: !!data.data?.te,
    })

    // Extract log fields from the response
    // Map Check Point TE API response fields to our log fields structure
    const teData = data.data?.te || {}
    const logFields: CheckPointTELogFields = {
      // Core fields
      verdict: teData['verdict'] as CheckPointTELogFields['verdict'] || 
               (data.data?.status === 'FOUND' ? 'Malicious' : undefined),
      status: (data.data?.status || teData['status']) as CheckPointTELogFields['status'],
      
      // Analysis details - map from various possible field names
      analyzed_on: teData['analyzed_on'] as string || 
                   teData['analyzedOn'] as string || 
                   'Check Point Threat Emulation Cloud',
      te_verdict_determined_by: teData['te_verdict_determined_by'] as string || 
                                teData['teVerdictDeterminedBy'] as string ||
                                teData['determined_by'] as string ||
                                teData['determinedBy'] as string,
      confidence_level: teData['confidence_level'] as CheckPointTELogFields['confidence_level'] ||
                        teData['confidenceLevel'] as CheckPointTELogFields['confidence_level'],
      severity: teData['severity'] as CheckPointTELogFields['severity'] ||
                teData['severity_level'] as CheckPointTELogFields['severity'],
      
      // Protection information
      protection_type: teData['protection_type'] as string ||
                       teData['protectionType'] as string,
      protection_name: teData['protection_name'] as string ||
                       teData['protectionName'] as string,
      attack: teData['attack'] as string ||
              teData['attack_name'] as string ||
              teData['attackName'] as string,
      attack_info: teData['attack_info'] as string ||
                   teData['attackInfo'] as string,
      attack_status: teData['attack_status'] as string ||
                     teData['attackStatus'] as string,
      
      // Action taken
      action: teData['action'] as CheckPointTELogFields['action'],
      action_details: teData['action_details'] as string ||
                      teData['actionDetails'] as string,
      
      // File risk information
      file_risk: typeof teData['file_risk'] === 'number' ? teData['file_risk'] :
                 typeof teData['fileRisk'] === 'number' ? teData['fileRisk'] :
                 typeof teData['risk'] === 'number' ? teData['risk'] : undefined,
      content_risk: typeof teData['content_risk'] === 'number' ? teData['content_risk'] :
                    typeof teData['contentRisk'] === 'number' ? teData['contentRisk'] : undefined,
      scrubbed_content: teData['scrubbed_content'] as string ||
                        teData['scrubbedContent'] as string,
      suspicious_content: teData['suspicious_content'] as string ||
                          teData['suspiciousContent'] as string,
      
      // Threat profile
      threat_profile: teData['threat_profile'] as string ||
                      teData['threatProfile'] as string,
      smartdefense_profile: teData['smartdefense_profile'] as string ||
                            teData['smartdefenseProfile'] as string,
      triggered_by: teData['triggered_by'] as string ||
                    teData['triggeredBy'] as string,
      
      // Vendor information
      vendor_list: teData['vendor_list'] as string ||
                   teData['vendorList'] as string ||
                   'Check Point ThreatCloud',
      
      // Confidence score (numeric)
      confidence: typeof teData['confidence'] === 'number' ? teData['confidence'] :
                  typeof teData['confidence_score'] === 'number' ? teData['confidence_score'] :
                  typeof teData['confidenceScore'] === 'number' ? teData['confidenceScore'] : undefined,
      
      // Additional metadata
      description: teData['description'] as string,
      reason: teData['reason'] as string,
      
      // Hash information
      sha256: teData['sha256'] as string || data.data?.['sha256'] as string,
      sha1: teData['sha1'] as string || data.data?.['sha1'] as string,
      md5: teData['md5'] as string || data.data?.['md5'] as string,
    }

    // Determine verdict and status
    const verdict = (logFields.verdict?.toLowerCase() || 
                    (data.data?.status === 'FOUND' ? 'malicious' : 
                     data.data?.status === 'NOT_FOUND' ? 'benign' : undefined)) as string
    const status = (logFields.status?.toUpperCase() || 
                   data.data?.status?.toUpperCase() || 
                   'UNKNOWN') as string
    
    // Determine if file is safe or malicious
    const isSafe = verdict === 'benign' || status === 'NOT_FOUND'
    const isMalicious = verdict === 'malicious' || verdict === 'suspicious' || status === 'FOUND'
    const isPending = status === 'IN_PROGRESS' || status === 'QUEUED' || !status || !verdict

    const result: CheckPointTEResponse = {
      success: true,
      verdict: isPending ? 'pending' : (isMalicious ? 'malicious' : (isSafe ? 'safe' : 'unknown')),
      status: status,
      logFields: logFields,
      rawResponse: rawData, // Include raw response for debugging and future enhancements
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
    await systemLog.info('checkpoint_te', 'Query successful', {
      endpoint: queryUrl,
      method: 'POST',
      statusCode: 200,
      duration: successDuration,
    }, {
      requestId,
      sha256: body.sha256,
      verdict: result.verdict,
    })

    return NextResponse.json(result)
  } catch (error) {
    const errorDuration = Date.now() - startTime
    console.error('Check Point TE query error:', error)
    
    let errorMessage = 'An error occurred during query to Check Point TE'
    let statusCode = 500
    let stackTrace: string | undefined

    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        errorMessage = 'Network error: Could not connect to Check Point TE API. Check your internet connection and firewall settings.'
        statusCode = 503
      }
      stackTrace = error.stack
    } else if (error instanceof Error) {
      errorMessage = error.message
      stackTrace = error.stack
    }

    // Log error to system logs
    await systemLog.error('checkpoint_te', `Query exception: ${errorMessage}`, {
      endpoint: queryUrl,
      method: 'POST',
      statusCode,
      error: errorMessage,
      stackTrace,
      duration: errorDuration,
    }, {
      requestId,
      errorType: error instanceof TypeError ? 'TypeError' : error?.constructor?.name || 'Unknown',
    })

    return NextResponse.json(
      { 
        error: errorMessage,
        type: error instanceof TypeError ? 'network_error' : 'unknown_error',
      },
      { status: statusCode }
    )
  }
}
