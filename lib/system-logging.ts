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

/**
 * Redact sensitive information from headers (Authorization, API keys)
 * SECURITY: Prevents API keys from appearing in logs
 */
function redactHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  if (!headers) return headers
  
  const redacted = { ...headers }
  
  // Redact Authorization headers
  if (redacted.Authorization) {
    const auth = redacted.Authorization
    if (auth.length > 30) {
      redacted.Authorization = auth.substring(0, 30) + '***[REDACTED]***'
    } else {
      redacted.Authorization = '***[REDACTED]***'
    }
  }
  
  if (redacted.authorization) {
    const auth = redacted.authorization
    if (auth.length > 30) {
      redacted.authorization = auth.substring(0, 30) + '***[REDACTED]***'
    } else {
      redacted.authorization = '***[REDACTED]***'
    }
  }
  
  // Redact any header containing "api-key" or "apikey"
  Object.keys(redacted).forEach(key => {
    if (key.toLowerCase().includes('api-key') || key.toLowerCase().includes('apikey')) {
      redacted[key] = '***[REDACTED]***'
    }
  })
  
  return redacted
}

/**
 * Redact sensitive information from request/response bodies
 * SECURITY: Prevents API keys from appearing in logs
 */
function redactBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body
  
  try {
    const bodyStr = JSON.stringify(body)
    // Redact any patterns that look like API keys (sk- followed by 48+ characters)
    const redacted = bodyStr.replace(/sk-[a-zA-Z0-9]{32,}/g, 'sk-***[REDACTED]***')
    // Redact any patterns that look like bearer tokens
    const redacted2 = redacted.replace(/Bearer\s+[a-zA-Z0-9_-]{32,}/g, 'Bearer ***[REDACTED]***')
    return JSON.parse(redacted2)
  } catch {
    // If JSON parsing fails, return as-is (better to log something than nothing)
    return body
  }
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
    
    // SECURITY: Redact sensitive information from details before logging
    const safeDetails: SystemLogDetails | undefined = details ? {
      ...details,
      requestHeaders: redactHeaders(details.requestHeaders),
      requestBody: redactBody(details.requestBody),
      responseBody: redactBody(details.responseBody),
    } : undefined
    
    const newLog: SystemLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      service,
      message,
      details: safeDetails,
      metadata,
    }

    const updatedLogs = [newLog, ...logs].slice(0, MAX_SYSTEM_LOGS)
    await writeSystemLogs(updatedLogs)

    // Also log to console for immediate visibility (with redaction)
    const logPrefix = `[System ${level.toUpperCase()}] ${service}`
    if (level === 'error') {
      console.error(logPrefix + ':', message, safeDetails || '')
    } else if (level === 'warning') {
      console.warn(logPrefix + ':', message, safeDetails || '')
    } else {
      console.log(logPrefix + ':', message, safeDetails || '')
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
