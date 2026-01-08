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
}

export interface ChatSession {
  id: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}
