import { NextRequest, NextResponse } from 'next/server'
import { readSystemLogs } from '@/lib/system-logging'

/**
 * Check Point WAF Logs API
 * 
 * This endpoint allows Check Point WAF to read API call logs and security events.
 * It provides a structured format that Check Point WAF can consume for:
 * - Security monitoring
 * - Threat detection
 * - Incident response
 * - Audit trails
 * 
 * Authentication: Uses API key or basic auth (configure via environment)
 */

interface WAFLogFilter {
  level?: 'info' | 'warning' | 'error' | 'debug'
  service?: string
  startTime?: string // ISO timestamp
  endTime?: string   // ISO timestamp
  clientIP?: string
  endpoint?: string
  blocked?: boolean
  threatDetected?: boolean
  limit?: number
}

interface WAFLogEntry {
  id: string
  timestamp: string
  level: string
  service: string
  message: string
  metadata: {
    waf?: {
      clientIP?: string
      userAgent?: string
      requestSize?: number
      blocked?: boolean
      threatDetected?: boolean
    }
  }
  details?: {
    endpoint?: string
    method?: string
    statusCode?: number
    duration?: number
    error?: string
  }
}

/**
 * GET - Retrieve logs for Check Point WAF
 * 
 * Query Parameters:
 * - level: Filter by log level (info, warning, error, debug)
 * - service: Filter by service name (e.g., 'checkpoint-waf', 'chat', 'scan')
 * - startTime: ISO timestamp - only return logs after this time
 * - endTime: ISO timestamp - only return logs before this time
 * - clientIP: Filter by client IP address
 * - endpoint: Filter by API endpoint path
 * - blocked: Filter by blocked requests (true/false)
 * - threatDetected: Filter by threat detection (true/false)
 * - limit: Maximum number of logs to return (default: 100, max: 1000)
 * 
 * Headers:
 * - Authorization: Bearer token or API key (if WAF_AUTH_ENABLED=true)
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authentication for Check Point WAF
    const authEnabled = process.env.WAF_AUTH_ENABLED === 'true'
    const authToken = process.env.WAF_API_KEY
    
    if (authEnabled && authToken) {
      const authHeader = request.headers.get('authorization')
      if (!authHeader) {
        return NextResponse.json(
          { error: 'Authorization required' },
          { status: 401 }
        )
      }
      
      // Support Bearer token or API key
      const providedToken = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader
        
      if (providedToken !== authToken) {
        return NextResponse.json(
          { error: 'Invalid authorization token' },
          { status: 403 }
        )
      }
    }
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const filter: WAFLogFilter = {
      level: searchParams.get('level') as WAFLogFilter['level'] || undefined,
      service: searchParams.get('service') || undefined,
      startTime: searchParams.get('startTime') || undefined,
      endTime: searchParams.get('endTime') || undefined,
      clientIP: searchParams.get('clientIP') || undefined,
      endpoint: searchParams.get('endpoint') || undefined,
      blocked: searchParams.get('blocked') === 'true' ? true : 
               searchParams.get('blocked') === 'false' ? false : undefined,
      threatDetected: searchParams.get('threatDetected') === 'true' ? true :
                      searchParams.get('threatDetected') === 'false' ? false : undefined,
      limit: parseInt(searchParams.get('limit') || '100', 10),
    }
    
    // Enforce maximum limit
    if (filter.limit && filter.limit > 1000) {
      filter.limit = 1000
    }
    
    // Read all system logs
    let logs = await readSystemLogs()
    
    // Apply filters
    if (filter.level) {
      logs = logs.filter(log => log.level === filter.level)
    }
    
    if (filter.service) {
      logs = logs.filter(log => log.service === filter.service)
    }
    
    if (filter.startTime) {
      const startDate = new Date(filter.startTime)
      logs = logs.filter(log => new Date(log.timestamp) >= startDate)
    }
    
    if (filter.endTime) {
      const endDate = new Date(filter.endTime)
      logs = logs.filter(log => new Date(log.timestamp) <= endDate)
    }
    
    if (filter.clientIP) {
      logs = logs.filter(log => {
        const wafMeta = (log.metadata as any)?.waf
        return wafMeta?.clientIP === filter.clientIP
      })
    }
    
    if (filter.endpoint) {
      logs = logs.filter(log => log.details?.endpoint === filter.endpoint)
    }
    
    if (filter.blocked !== undefined) {
      logs = logs.filter(log => {
        const wafMeta = (log.metadata as any)?.waf
        return wafMeta?.blocked === filter.blocked
      })
    }
    
    if (filter.threatDetected !== undefined) {
      logs = logs.filter(log => {
        const wafMeta = (log.metadata as any)?.waf
        return wafMeta?.threatDetected === filter.threatDetected
      })
    }
    
    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    // Apply limit
    if (filter.limit) {
      logs = logs.slice(0, filter.limit)
    }
    
    // Format logs for Check Point WAF consumption
    const wafLogs: WAFLogEntry[] = logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      level: log.level,
      service: log.service,
      message: log.message,
      metadata: log.metadata || {},
      details: log.details,
    }))
    
    // Return response in Check Point WAF-friendly format
    return NextResponse.json({
      success: true,
      count: wafLogs.length,
      filtered: {
        level: filter.level,
        service: filter.service,
        startTime: filter.startTime,
        endTime: filter.endTime,
        clientIP: filter.clientIP,
        endpoint: filter.endpoint,
        blocked: filter.blocked,
        threatDetected: filter.threatDetected,
      },
      logs: wafLogs,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to retrieve WAF logs:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to retrieve logs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Export logs in Check Point WAF format
 * Allows Check Point WAF to request logs in a specific format
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication
    const authEnabled = process.env.WAF_AUTH_ENABLED === 'true'
    const authToken = process.env.WAF_API_KEY
    
    if (authEnabled && authToken) {
      const authHeader = request.headers.get('authorization')
      if (!authHeader) {
        return NextResponse.json(
          { error: 'Authorization required' },
          { status: 401 }
        )
      }
      
      const providedToken = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader
        
      if (providedToken !== authToken) {
        return NextResponse.json(
          { error: 'Invalid authorization token' },
          { status: 403 }
        )
      }
    }
    
    const body = await request.json().catch(() => ({}))
    const {
      format = 'json',
      startTime,
      endTime,
      services = [],
      includeDetails = true,
    } = body
    
    // Read logs
    let logs = await readSystemLogs()
    
    // Apply time filters
    if (startTime) {
      const startDate = new Date(startTime)
      logs = logs.filter(log => new Date(log.timestamp) >= startDate)
    }
    
    if (endTime) {
      const endDate = new Date(endTime)
      logs = logs.filter(log => new Date(log.timestamp) <= endDate)
    }
    
    // Filter by services if specified
    if (services.length > 0) {
      logs = logs.filter(log => services.includes(log.service))
    }
    
    // Sort by timestamp
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    // Format based on requested format
    if (format === 'csv') {
      // CSV format for Check Point WAF import
      const csvHeaders = ['timestamp', 'level', 'service', 'message', 'endpoint', 'method', 'statusCode', 'clientIP', 'blocked', 'threatDetected']
      const csvRows = logs.map(log => {
        const wafMeta = (log.metadata as any)?.waf || {}
        return [
          log.timestamp,
          log.level,
          log.service,
          `"${log.message.replace(/"/g, '""')}"`, // Escape quotes
          log.details?.endpoint || '',
          log.details?.method || '',
          log.details?.statusCode || '',
          wafMeta.clientIP || '',
          wafMeta.blocked ? 'true' : 'false',
          wafMeta.threatDetected ? 'true' : 'false',
        ].join(',')
      })
      
      const csv = [csvHeaders.join(','), ...csvRows].join('\n')
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="waf-logs-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }
    
    // Default JSON format
    const wafLogs: WAFLogEntry[] = logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      level: log.level,
      service: log.service,
      message: log.message,
      metadata: log.metadata || {},
      details: includeDetails ? log.details : undefined,
    }))
    
    return NextResponse.json({
      success: true,
      format,
      count: wafLogs.length,
      logs: wafLogs,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to export WAF logs:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to export logs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}