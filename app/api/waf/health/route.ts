import { NextRequest, NextResponse } from 'next/server'
import { readSystemLogs } from '@/lib/system-logging'

/**
 * Check Point WAF Health Check Endpoint
 * 
 * Provides health and status information for Check Point WAF integration
 * This endpoint can be used by Check Point WAF to verify the application
 * is running and properly integrated.
 */
export async function GET(request: NextRequest) {
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
    
    // Get recent WAF logs for statistics
    const allLogs = await readSystemLogs()
    const wafLogs = allLogs.filter(log => 
      log.service === 'checkpoint-waf' ||
      (log.metadata as any)?.waf
    )
    
    // Calculate statistics
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentLogs = wafLogs.filter(log => new Date(log.timestamp) >= last24Hours)
    
    const stats = {
      total: wafLogs.length,
      last24Hours: recentLogs.length,
      blocked: recentLogs.filter(log => (log.metadata as any)?.waf?.blocked).length,
      threats: recentLogs.filter(log => (log.metadata as any)?.waf?.threatDetected).length,
      errors: recentLogs.filter(log => log.level === 'error').length,
      warnings: recentLogs.filter(log => log.level === 'warning').length,
    }
    
    // Get recent activity (last 10 logs)
    const recentActivity = recentLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
      .map(log => ({
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
        endpoint: log.details?.endpoint,
        statusCode: log.details?.statusCode,
        blocked: (log.metadata as any)?.waf?.blocked || false,
      }))
    
    return NextResponse.json({
      status: 'ok',
      service: 'secure-ai-chat',
      waf: {
        integrated: true,
        logsEndpoint: '/api/waf/logs',
        healthEndpoint: '/api/waf/health',
        authentication: authEnabled ? 'enabled' : 'disabled',
      },
      statistics: stats,
      recentActivity,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to get WAF health:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to retrieve health information',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}