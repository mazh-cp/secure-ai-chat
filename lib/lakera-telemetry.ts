/**
 * Lakera Telemetry / Logging Integration
 * Sends scan results and logs back to Platform.lakera.ai for analytics and monitoring
 */

interface LakeraTelemetryPayload {
  timestamp: string
  event_type: 'scan' | 'blocked' | 'allowed'
  context: {
    type: 'chat' | 'file_upload'
    source: string
  }
  scan_result: {
    flagged: boolean
    categories?: Record<string, boolean>
    scores?: Record<string, number>
    threat_level?: 'low' | 'medium' | 'high' | 'critical'
  }
  metadata?: {
    user_ip?: string
    file_name?: string
    file_type?: string
    file_size?: number
    message_length?: number
    detected_patterns?: string[]
  }
  project_id?: string
}

interface LakeraTelemetryResponse {
  success: boolean
  message?: string
  error?: string
}

/**
 * Send log data to Lakera Platform
 * 
 * @param payload - Telemetry payload to send
 * @param lakeraApiKey - Lakera API key for authentication
 * @param lakeraProjectId - Optional Lakera Project ID
 * @returns Promise with telemetry response
 */
export async function sendLakeraTelemetry(
  payload: LakeraTelemetryPayload,
  lakeraApiKey: string,
  lakeraProjectId?: string
): Promise<LakeraTelemetryResponse> {
  // Platform.lakera.ai telemetry endpoint
  // Note: This endpoint may not be publicly documented yet
  // Default to the same base as the guard API, but with /telemetry path
  // If this doesn't work, you may need to use S3 log export via Platform.lakera.ai Settings
  const TELEMETRY_ENDPOINT = process.env.LAKERA_TELEMETRY_ENDPOINT || 
    'https://api.lakera.ai/v2/telemetry'

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${lakeraApiKey.trim()}`,
    }

    // Add project ID as header if provided
    if (lakeraProjectId && lakeraProjectId.trim()) {
      headers['X-Lakera-Project'] = lakeraProjectId.trim()
    }

    // Prepare request body with project_id if available
    const requestBody: LakeraTelemetryPayload & { project_id?: string } = {
      ...payload,
    }

    if (lakeraProjectId && lakeraProjectId.trim()) {
      requestBody.project_id = lakeraProjectId.trim()
    }

    console.log('Sending telemetry to Lakera Platform:', {
      endpoint: TELEMETRY_ENDPOINT,
      event_type: payload.event_type,
      flagged: payload.scan_result.flagged,
      hasProjectId: !!lakeraProjectId,
    })

    const response = await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('Lakera telemetry error:', response.status, errorText)
      
      // Don't throw - telemetry failures shouldn't break the main flow
      return {
        success: false,
        error: `Telemetry API error: ${response.status} ${errorText.substring(0, 100)}`,
      }
    }

    const data = await response.json().catch(() => ({}))
    
    console.log('Telemetry sent successfully to Lakera Platform')
    
    return {
      success: true,
      message: 'Telemetry sent successfully',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to send telemetry to Lakera Platform:', errorMessage)
    
    // Don't throw - telemetry failures shouldn't break the main flow
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Convert application log entry to Lakera telemetry payload
 * 
 * @param logEntry - Application log entry
 * @param userIP - Optional user IP address
 * @returns Lakera telemetry payload
 */
export function convertLogToTelemetry(
  logEntry: {
    type: string
    action: string
    source: string
    lakeraDecision?: {
      scanned: boolean
      flagged: boolean
      categories?: Record<string, boolean>
      scores?: Record<string, number>
      message?: string
    }
    requestDetails?: {
      fileName?: string
      fileType?: string
      fileSize?: number
      message?: string
      threatLevel?: 'low' | 'medium' | 'high' | 'critical'
      detectedPatterns?: string[]
    }
    userIP?: string
    timestamp?: string
  }
): LakeraTelemetryPayload | null {
  // Only send telemetry for Lakera-related scans
  if (!logEntry.lakeraDecision?.scanned) {
    return null
  }

  const eventType = logEntry.action === 'blocked' ? 'blocked' : 
                   logEntry.action === 'scanned' ? 'scan' : 'allowed'

  return {
    timestamp: logEntry.timestamp || new Date().toISOString(),
    event_type: eventType as 'scan' | 'blocked' | 'allowed',
    context: {
      type: logEntry.type === 'file_scan' ? 'file_upload' : 'chat',
      source: logEntry.source || 'unknown',
    },
    scan_result: {
      flagged: logEntry.lakeraDecision.flagged || false,
      categories: logEntry.lakeraDecision.categories,
      scores: logEntry.lakeraDecision.scores,
      threat_level: logEntry.requestDetails?.threatLevel,
    },
    metadata: {
      user_ip: logEntry.userIP,
      file_name: logEntry.requestDetails?.fileName,
      file_type: logEntry.requestDetails?.fileType,
      file_size: logEntry.requestDetails?.fileSize,
      message_length: logEntry.requestDetails?.message?.length,
      detected_patterns: logEntry.requestDetails?.detectedPatterns,
    },
  }
}

/**
 * Send telemetry for a Lakera scan result
 * 
 * @param logEntry - Application log entry with Lakera decision
 * @param lakeraApiKey - Lakera API key
 * @param lakeraProjectId - Optional Lakera Project ID
 * @returns Promise with telemetry response (fire and forget, doesn't throw)
 */
export async function sendLakeraTelemetryFromLog(
  logEntry: {
    type: string
    action: string
    source: string
    lakeraDecision?: {
      scanned: boolean
      flagged: boolean
      categories?: Record<string, boolean>
      scores?: Record<string, number>
      message?: string
    }
    requestDetails?: {
      fileName?: string
      fileType?: string
      fileSize?: number
      message?: string
      threatLevel?: 'low' | 'medium' | 'high' | 'critical'
      detectedPatterns?: string[]
    }
    userIP?: string
    timestamp?: string
  },
  lakeraApiKey: string,
  lakeraProjectId?: string
): Promise<void> {
  // Only send if telemetry is enabled (can be controlled via environment variable)
  const TELEMETRY_ENABLED = process.env.LAKERA_TELEMETRY_ENABLED !== 'false'
  
  if (!TELEMETRY_ENABLED) {
    console.log('Lakera telemetry is disabled')
    return
  }

  if (!lakeraApiKey || !lakeraApiKey.trim()) {
    console.log('Lakera API key not configured, skipping telemetry')
    return
  }

  const payload = convertLogToTelemetry(logEntry)
  if (!payload) {
    return
  }

  try {
    // Fire and forget - don't block on telemetry
    sendLakeraTelemetry(payload, lakeraApiKey, lakeraProjectId).catch((error) => {
      console.error('Failed to send Lakera telemetry (non-blocking):', error)
    })
  } catch (error) {
    console.error('Error preparing Lakera telemetry (non-blocking):', error)
  }
}
