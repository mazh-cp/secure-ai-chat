import { CheckPointTELogFields } from './checkpoint-te'

export type LogType = 'chat' | 'file_scan' | 'error' | 'system'
export type ActionType = 'request' | 'blocked' | 'allowed' | 'scanned' | 'error' | 'api_failure' | 'api_success' | 'configuration'

export interface LogEntry {
  id: string
  timestamp: Date
  type: LogType
  action: ActionType
  userIP?: string
  source: 'chat' | 'file_upload'
  requestDetails?: {
    message?: string
    fileName?: string
    fileType?: string
    fileSize?: number
    threatLevel?: 'low' | 'medium' | 'high' | 'critical'
    detectedPatterns?: string[]
  }
  lakeraDecision?: {
    scanned: boolean
    flagged: boolean
    categories?: Record<string, boolean>
    scores?: Record<string, number>
    message?: string
    // Official payload data (detected threats with locations)
    payload?: Array<{
      start: number
      end: number
      text: string
      detector_type: string
      labels: string[]
      message_id: number
    }>
    // Official breakdown data (detector results)
    breakdown?: Array<{
      project_id: string
      policy_id: string
      detector_id: string
      detector_type: string
      detected: boolean
      message_id: number
    }>
  }
  checkpointTeDecision?: {
    scanned: boolean
    flagged: boolean
    verdict: 'safe' | 'malicious' | 'pending' | 'unknown'
    status: string
    logFields: CheckPointTELogFields
    message?: string
  }
  associatedRisks?: string[] // OWASP risk IDs (e.g., ['llm01', 'llm02'])
  error?: string
  success: boolean
  systemDetails?: {
    service?: string // e.g., 'checkpoint_te', 'lakera', 'openai'
    endpoint?: string
    method?: string
    statusCode?: number
    requestId?: string
    duration?: number // milliseconds
    stackTrace?: string
    responseBody?: string
    requestHeaders?: Record<string, string>
  }
}

