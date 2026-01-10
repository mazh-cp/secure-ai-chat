/**
 * Server-side system logging utility
 * Logs system-level events (API failures, configuration issues, etc.)
 */

import { promises as fs } from 'fs'
import path from 'path'

export type SystemLogLevel = 'info' | 'warning' | 'error' | 'debug'

export interface SystemLogDetails {
  endpoint?: string
  method?: string
  statusCode?: number
  error?: string
  stackTrace?: string
  requestBody?: unknown
  responseBody?: unknown
  requestHeaders?: Record<string, string>
  duration?: number
}

const SYSTEM_LOGS_FILE = path.join(process.cwd(), '.secure-storage', 'system-logs.json')
const MAX_SYSTEM_LOGS = 500

export interface SystemLogEntry {
  id: string
  timestamp: string
  level: SystemLogLevel
  service: string
  message: string
  details?: SystemLogDetails
  metadata?: Record<string, unknown>
}

async function ensureLogsFile(): Promise<void> {
  const logDir = path.dirname(SYSTEM_LOGS_FILE)
  try {
    await fs.mkdir(logDir, { recursive: true, mode: 0o700 })
  } catch (error) {
    console.error('Failed to create logs directory:', error)
  }
}

export async function readSystemLogs(): Promise<SystemLogEntry[]> {
  try {
    await ensureLogsFile()
    const content = await fs.readFile(SYSTEM_LOGS_FILE, 'utf8')
    return JSON.parse(content)
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'ENOENT') {
      return []
    }
    console.error('Failed to read system logs:', error)
    return []
  }
}

export async function writeSystemLogs(logs: SystemLogEntry[]): Promise<void> {
  try {
    await ensureLogsFile()
    await fs.writeFile(SYSTEM_LOGS_FILE, JSON.stringify(logs, null, 2), { mode: 0o600 })
  } catch (error) {
    console.error('Failed to write system logs:', error)
  }
}

/**
 * Add a system log entry (server-side only)
 */
export async function addSystemLog(
  level: SystemLogLevel,
  service: string,
  message: string,
  details?: SystemLogDetails,
  metadata?: Record<string, unknown>
): Promise<void> {
  // Only log on server-side
  if (typeof window !== 'undefined') {
    console.warn('addSystemLog called from client-side - this should only be called server-side')
    return
  }

  try {
    const logs = await readSystemLogs()
    const newLog: SystemLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      service,
      message,
      details,
      metadata,
    }

    const updatedLogs = [newLog, ...logs].slice(0, MAX_SYSTEM_LOGS)
    await writeSystemLogs(updatedLogs)

    // Also log to console for immediate visibility
    const logPrefix = `[System ${level.toUpperCase()}] ${service}`
    if (level === 'error') {
      console.error(logPrefix + ':', message, details || '')
    } else if (level === 'warning') {
      console.warn(logPrefix + ':', message, details || '')
    } else {
      console.log(logPrefix + ':', message, details || '')
    }
  } catch (error) {
    // Fallback to console if file logging fails
    console.error(`[System Log ${level.toUpperCase()}] ${service}: ${message}`, details || '', error)
  }
}

/**
 * Convenience functions for different log levels
 */
export const systemLog = {
  info: (service: string, message: string, details?: SystemLogDetails, metadata?: Record<string, unknown>) =>
    addSystemLog('info', service, message, details, metadata),
  
  warning: (service: string, message: string, details?: SystemLogDetails, metadata?: Record<string, unknown>) =>
    addSystemLog('warning', service, message, details, metadata),
  
  error: (service: string, message: string, details?: SystemLogDetails, metadata?: Record<string, unknown>) =>
    addSystemLog('error', service, message, details, metadata),
  
  debug: (service: string, message: string, details?: SystemLogDetails, metadata?: Record<string, unknown>) =>
    addSystemLog('debug', service, message, details, metadata),
}
