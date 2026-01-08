import { LogEntry, LogType, ActionType } from '@/types/logs'
import type { NextRequest } from 'next/server'

const MAX_LOGS = 1000 // Keep last 1000 logs
const STORAGE_KEY = 'dashboardLogs'

/**
 * Get user's IP address (simplified - in production use proper IP detection)
 */
export function getUserIP(request?: Request | NextRequest): string {
  // Server-side only function
  if (typeof window !== 'undefined') {
    // Client-side: we can't get real IP
    return 'N/A'
  }
  
  if (request) {
    // Server-side: try to get IP from headers
    const headers = request.headers as Headers
    const forwarded = headers.get('x-forwarded-for')
    const realIP = headers.get('x-real-ip')
    const cfConnectingIP = headers.get('cf-connecting-ip')
    
    if (cfConnectingIP) return cfConnectingIP
    if (realIP) return realIP
    if (forwarded) return forwarded.split(',')[0].trim()
  }
  
  return 'Unknown'
}

/**
 * Add a log entry
 */
export function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
  if (typeof window === 'undefined') {
    // Server-side: we'll handle this in API routes
    return
  }

  const newEntry: LogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  }

  try {
    const existingLogs = getLogs()
    const updatedLogs = [newEntry, ...existingLogs].slice(0, MAX_LOGS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs))
  } catch (error) {
    console.error('Failed to save log:', error)
  }
}

/**
 * Get all logs
 */
export function getLogs(): LogEntry[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    
    const logs = JSON.parse(stored) as Array<Omit<LogEntry, 'timestamp'> & { timestamp: string }>
    // Convert timestamp strings back to Date objects
    return logs.map((log) => ({
      ...log,
      timestamp: new Date(log.timestamp),
    }))
  } catch (error) {
    console.error('Failed to load logs:', error)
    return []
  }
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear logs:', error)
  }
}

/**
 * Filter logs by type
 */
export function filterLogs(logs: LogEntry[], type?: LogType, action?: ActionType): LogEntry[] {
  let filtered = logs
  
  if (type) {
    filtered = filtered.filter(log => log.type === type)
  }
  
  if (action) {
    filtered = filtered.filter(log => log.action === action)
  }
  
  return filtered
}

