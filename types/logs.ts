export type LogType = 'chat' | 'file_scan' | 'error'
export type ActionType = 'request' | 'blocked' | 'allowed' | 'scanned' | 'error'

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
  }
  lakeraDecision?: {
    scanned: boolean
    flagged: boolean
    categories?: Record<string, boolean>
    scores?: Record<string, number>
    message?: string
  }
  associatedRisks?: string[] // OWASP risk IDs (e.g., ['llm01', 'llm02'])
  error?: string
  success: boolean
}

