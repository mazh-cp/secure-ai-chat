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

