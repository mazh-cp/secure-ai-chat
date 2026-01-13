export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  scanResult?: ScanResult
}

export interface ScanResult {
  scanned: boolean
  flagged: boolean
  categories?: Record<string, boolean>
  scores?: Record<string, number>
  message?: string
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

export interface ChatSession {
  id: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}
