import { NextRequest, NextResponse } from 'next/server'

/**
 * Check Point WAF Integration Middleware
 * 
 * This middleware:
 * 1. Captures request metadata for Check Point WAF logging
 * 2. Extracts Check Point WAF-specific headers
 * 3. Logs API calls for WAF security monitoring
 * 4. Handles reverse proxy headers correctly
 */

interface WAFRequestMetadata {
  method: string
  path: string
  query: string
  userAgent: string
  ipAddress: string
  checkPointHeaders: Record<string, string>
  timestamp: string
  requestSize?: number
}

interface WAFResponseMetadata {
  statusCode: number
  responseSize?: number
  duration: number
  threatDetected: boolean
  blocked: boolean
}

/**
 * Extract Check Point WAF-specific headers
 */
function extractCheckPointHeaders(headers: Headers): Record<string, string> {
  const cpHeaders: Record<string, string> = {}
  
  // Check Point WAF may set custom headers
  const cpHeaderPrefixes = [
    'x-checkpoint-',
    'x-cp-',
    'checkpoint-',
    'cp-waf-',
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
  ]
  
  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase()
    if (cpHeaderPrefixes.some(prefix => lowerKey.startsWith(prefix))) {
      // Redact sensitive headers but keep structure
      if (lowerKey.includes('auth') || lowerKey.includes('key') || lowerKey.includes('token')) {
        cpHeaders[key] = '***[REDACTED]***'
      } else {
        cpHeaders[key] = value
      }
    }
  })
  
  return cpHeaders
}

/**
 * Get client IP address with Check Point WAF support
 */
function getClientIP(request: NextRequest): string {
  // Check Point WAF typically sets these headers
  const cpIP = request.headers.get('x-checkpoint-client-ip')
  if (cpIP) return cpIP
  
  // Standard reverse proxy headers
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // Take first IP in chain (original client)
    return forwarded.split(',')[0].trim()
  }
  
  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) return cfConnectingIP
  
  // Fallback to connection remote address (if available)
  return 'unknown'
}

/**
 * Determine if request was blocked by security checks
 */
function isSecurityBlocked(response: NextResponse): boolean {
  // Check if response indicates security block
  if (response.status === 403 || response.status === 401) {
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      // Could parse response body here if needed
      return true
    }
  }
  return false
}

export async function middleware(request: NextRequest) {
  const startTime = Date.now()
  const url = request.nextUrl.clone()
  
  // Only process API routes (for WAF logging)
  if (!url.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }
  
  // Extract request metadata
  const metadata: WAFRequestMetadata = {
    method: request.method,
    path: url.pathname,
    query: url.search,
    userAgent: request.headers.get('user-agent') || 'unknown',
    ipAddress: getClientIP(request),
    checkPointHeaders: extractCheckPointHeaders(request.headers),
    timestamp: new Date().toISOString(),
  }
  
  // Get request size if available
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    metadata.requestSize = parseInt(contentLength, 10)
  }
  
  // Process request and capture response
  const response = NextResponse.next()
  
  // Add Check Point WAF response headers (if needed)
  // These help Check Point WAF track the application
  response.headers.set('X-Application-Name', 'secure-ai-chat')
  response.headers.set('X-Application-Version', process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0')
  
  // Log API call asynchronously (non-blocking)
  const duration = Date.now() - startTime
  
  // Get response status
  const statusCode = response.status
  
  // Determine if security threat was detected
  const blocked = isSecurityBlocked(response)
  const threatDetected = statusCode === 403 || statusCode === 401
  
  // Log to system logs for Check Point WAF to read
  // Note: System logging uses Node.js APIs which aren't available in Edge Runtime
  // So we'll use a dynamic import that only runs when needed (server-side only)
  if (typeof window === 'undefined') {
    // Only attempt to log on server-side (not in Edge Runtime)
    // System logging will be handled by API routes that have full Node.js access
    try {
      // Log minimal info to console for Edge Runtime (non-blocking)
      if (blocked || threatDetected) {
        console.warn('[WAF] Security event:', {
          method: request.method,
          path: url.pathname,
          statusCode,
          ipAddress: metadata.ipAddress,
          blocked,
          threatDetected,
        })
      }
    } catch (error) {
      // Silently fail - logging is non-critical in middleware
    }
  }
  
  return response
}

/**
 * Configure which routes this middleware applies to
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}