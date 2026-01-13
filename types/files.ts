import { CheckPointTELogFields } from './checkpoint-te'

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  content: string
  uploadedAt: Date
  scanStatus: 'pending' | 'scanning' | 'safe' | 'flagged' | 'error' | 'not_scanned'
  scanResult?: string
  scanDetails?: {
    categories?: Record<string, boolean>
    score?: number
    threatLevel?: 'low' | 'medium' | 'high' | 'critical'
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
  // Check Point TE specific details
  checkpointTeDetails?: {
    logFields: CheckPointTELogFields
    verdict: 'safe' | 'malicious' | 'pending' | 'unknown'
    status: string
  }
}

export interface ScanResult {
  flagged: boolean
  message: string
  details?: {
    categories?: Record<string, boolean>
    score?: number
  }
}

