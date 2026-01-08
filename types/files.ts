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
}

export interface ScanResult {
  flagged: boolean
  message: string
  details?: {
    categories?: Record<string, boolean>
    score?: number
  }
}

